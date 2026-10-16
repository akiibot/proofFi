"""Internal signing only: isolated finances/RPC, real Ed25519 and EVM signing.

No browser route is enabled; no transaction is broadcast or claimed confirmed.
"""

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import pytest
from app.core.errors import DomainError
from app.db.models import (
    ApprovalRecord,
    AuditRecord,
    CertificateRecord,
    ExecutionRecord,
    SimulationConfigRecord,
)
from app.db.state import append_state, read_state
from app.execution import gate
from app.execution.signer import LocalTestnetSigner
from app.execution.signer import TestnetPolicy as OperationalPolicy
from app.models.contracts import ExecuteRequest
from eth_account import Account
from eth_account.typed_transactions import TypedTransaction
from hexbytes import HexBytes
from sqlalchemy import func, select
from test_pf_029 import action as action
from test_pf_029 import configured as configured
from test_pf_029 import rpc as rpc


@pytest.fixture
def issued(client, configured, rpc, action, monkeypatch):
    # Publicly known test-only EVM key. Never a runtime/demo wallet.
    key = "0x" + "44" * 32
    wallet = Account.from_key(key).address.lower()
    operational = {**configured[1], "wallet_address": wallet}
    monkeypatch.setenv("VERIFIER_TRANSACTION_CONFIG_JSON", json.dumps(operational))
    monkeypatch.setenv("SIGNER_PRIVATE_KEY", key)
    response = client.post("/verify", json={"action": action})
    assert response.status_code == 200, response.text
    certificate = client.get("/certificates/" + response.json()["certificate_id"]).json()
    policy = OperationalPolicy(
        wallet_address=wallet,
        token_address=operational["token_address"],
        recipient=operational["recipient"],
        token_decimals=6,
        max_gas_limit=100000,
        max_fee_per_gas_wei="100",
    )
    request = ExecuteRequest(
        certificate_id=certificate["payload"]["id"],
        action_digest=certificate["payload"]["action_digest"],
        idempotency_key="one-attempt-signing-123",
    )
    return certificate, policy, request


@pytest.fixture
def sign_calls(monkeypatch):
    original = LocalTestnetSigner.sign
    calls = []

    def counted(self, transaction):
        calls.append(transaction)
        return original(self, transaction)

    monkeypatch.setattr(LocalTestnetSigner, "sign", counted)
    return calls


def sign_once(client, issued):
    _, policy, request = issued
    return gate.sign_authorized_once(client.app.state.engine, request, "demo-user", policy=policy)


def execution_count(database):
    with database[1]() as session:
        return session.scalar(select(func.count()).select_from(ExecutionRecord))


def test_real_signing_matches_exact_certificate_and_preserves_claim(
    client, database, issued, sign_calls
):
    certificate, _, _ = issued
    signed = sign_once(client, issued)
    raw = signed.raw_transaction
    assert (
        Account.recover_transaction(raw).lower() == certificate["payload"]["transaction"]["sender"]
    )
    decoded = TypedTransaction.from_bytes(HexBytes(raw)).as_dict()
    assert decoded["nonce"] == 7 and decoded["chainId"] == 84532
    assert decoded["gas"] == 100000 and decoded["maxFeePerGas"] == 100
    assert bytes(decoded["data"]).hex() == certificate["payload"]["transaction"]["data"][2:]
    assert len(sign_calls) == 1 and execution_count(database) == 1
    assert signed.execution.status == "CLAIMED" and signed.execution.tx_hash is None
    assert raw.hex() not in repr(signed)
    with database[1]() as session:
        assert session.get(CertificateRecord, certificate["payload"]["id"]).payload == certificate
        row = session.scalar(select(ExecutionRecord))
        assert row.status == "CLAIMED" and row.tx_hash is None
        assert row.payload == signed.execution.model_dump(mode="json")
        assert raw.hex() not in str([r.payload for r in session.scalars(select(AuditRecord))])
    assert client.post("/execute", json=issued[2].model_dump(mode="json")).status_code == 501


def test_concurrent_calls_sign_at_most_once(client, database, issued, sign_calls):
    def attempt(_):
        try:
            return sign_once(client, issued).execution.status
        except DomainError as error:
            return error.code.value

    with ThreadPoolExecutor(max_workers=2) as pool:
        result = list(pool.map(attempt, range(2)))
    assert sorted(result) == ["ALREADY_USED", "CLAIMED"]
    assert len(sign_calls) == 1 and execution_count(database) == 1


@pytest.mark.parametrize("phase", ["signer", "audit"])
def test_failure_after_signing_never_allows_another_attempt(
    client, database, issued, sign_calls, monkeypatch, phase
):
    if phase == "signer":
        original = LocalTestnetSigner.sign

        def fail(self, transaction):
            original(self, transaction)
            raise RuntimeError("SECRET SIGNER DETAIL")

        monkeypatch.setattr(LocalTestnetSigner, "sign", fail)
    else:
        original = gate.append_event

        def fail(session, **kwargs):
            if kwargs["event_type"] == "EXECUTION_SIGNED":
                raise RuntimeError("SECRET AUDIT DETAIL")
            return original(session, **kwargs)

        monkeypatch.setattr(gate, "append_event", fail)
    with pytest.raises(DomainError) as failure:
        sign_once(client, issued)
    assert "SECRET" not in failure.value.message
    assert execution_count(database) == 1 and len(sign_calls) == 1
    with pytest.raises(DomainError) as replay:
        sign_once(client, issued)
    assert replay.value.code == "ALREADY_USED" and len(sign_calls) == 1


@pytest.mark.parametrize("change", ["state", "config", "approval", "claim", "expired"])
def test_changes_between_durable_claim_and_signing_refuse(
    client, database, issued, sign_calls, monkeypatch, change
):
    original = gate.claim_execution

    def change_after_claim(*args, **kwargs):
        claim = original(*args, **kwargs)
        with database[1].begin() as session:
            if change == "state":
                state = read_state(session)
                append_state(
                    session,
                    state.snapshot.model_copy(update={"version": state.snapshot.version + 1}),
                    state.snapshot.version,
                )
            if change == "config":
                session.add(
                    SimulationConfigRecord(
                        id="second-selected-config", config_digest="f" * 64, payload={}
                    )
                )
            if change == "claim":
                row = session.get(ExecutionRecord, claim.id)
                row.payload = {**row.payload, "certificate_id": "different"}
            if change == "approval":
                row = session.scalar(select(ApprovalRecord))
                row.payload = {**row.payload, "decision": "DENY"}
        if change == "expired":
            expiration = datetime.fromisoformat(
                issued[0]["payload"]["expires_at"].replace("Z", "+00:00")
            )

            class Clock:
                @staticmethod
                def now(tz=None):
                    return expiration

            monkeypatch.setattr(gate, "datetime", Clock)
        return claim

    # Approval-bearing fixture for the approval mutation case.
    if change == "approval":
        # Build a new genuine approval-required action through issuance, never forge policy output.
        action = dict(
            issued[0]["payload"]["action"], id="approval-signing-case", amount_minor=20000
        )
        response = client.post("/verify", json={"action": action})
        assert response.status_code == 200
        cert = client.get("/certificates/" + response.json()["certificate_id"]).json()
        assert (
            client.post(
                "/approvals",
                json={
                    "certificate_id": cert["payload"]["id"],
                    "action_digest": cert["payload"]["action_digest"],
                    "decision": "APPROVE",
                },
            ).status_code
            == 200
        )
        issued = (
            cert,
            issued[1],
            issued[2].model_copy(
                update={
                    "certificate_id": cert["payload"]["id"],
                    "action_digest": cert["payload"]["action_digest"],
                }
            ),
        )
    monkeypatch.setattr(gate, "claim_execution", change_after_claim)
    with pytest.raises(DomainError):
        sign_once(client, issued)
    assert len(sign_calls) == 0 and execution_count(database) == 1


@pytest.mark.parametrize("change", ["nonce", "decimals", "gas", "network", "balance"])
def test_live_chain_changes_since_issuance_refuse_signer(
    client, database, issued, rpc, sign_calls, change
):
    if change == "nonce":
        rpc.nonce = 8
    if change == "decimals":
        rpc.decimals = 18
    if change == "gas":
        rpc.gas = 100001
    if change == "network":
        rpc.chain = 1
    if change == "balance":
        rpc.balance = 0
    with pytest.raises(DomainError):
        sign_once(client, issued)
    assert len(sign_calls) == 0 and execution_count(database) == 1


def test_missing_signer_key_preserves_claim_without_signing(
    client, database, issued, sign_calls, monkeypatch
):
    monkeypatch.setenv("SIGNER_PRIVATE_KEY", "")
    with pytest.raises(DomainError):
        sign_once(client, issued)
    assert len(sign_calls) == 0 and execution_count(database) == 1
    with pytest.raises(DomainError) as replay:
        sign_once(client, issued)
    assert replay.value.code == "ALREADY_USED"


def test_unconfigured_or_tampered_certificate_never_reaches_signer(
    client, database, issued, sign_calls
):
    cert, _, _ = issued
    with database[1].begin() as session:
        row = session.get(CertificateRecord, cert["payload"]["id"])
        row.payload = {**row.payload, "certificate_hash": "f" * 64}
    with pytest.raises(DomainError):
        sign_once(client, issued)
    assert sign_calls == [] and execution_count(database) == 0


def test_two_certificates_at_same_wallet_nonce_cannot_both_sign(
    client, database, issued, rpc, action, sign_calls
):
    second = client.post("/verify", json={"action": action}).json()
    assert second["certificate_id"] != issued[0]["payload"]["id"]
    sign_once(client, issued)
    request = issued[2].model_copy(
        update={
            "certificate_id": second["certificate_id"],
            "idempotency_key": "second-attempt-signing-123",
        }
    )
    with pytest.raises(DomainError) as conflict:
        gate.sign_authorized_once(client.app.state.engine, request, "demo-user", policy=issued[1])
    assert conflict.value.code == "CONFLICT"
    assert len(sign_calls) == 1 and execution_count(database) == 1


@pytest.mark.parametrize("mutation", ["nonce", "fee", "gas", "malformed"])
def test_incorrect_actual_signer_output_is_rejected(
    client, database, issued, sign_calls, monkeypatch, mutation
):
    original = LocalTestnetSigner.sign

    def altered(self, transaction):
        if mutation == "malformed":
            return b"not-signed-eip1559"
        updates = {
            "nonce": {"nonce": transaction.nonce + 1},
            "fee": {"max_fee_per_gas_wei": "99"},
            "gas": {"gas_limit": 50000},
        }[mutation]
        return original(self, transaction.model_copy(update=updates))

    monkeypatch.setattr(LocalTestnetSigner, "sign", altered)
    with pytest.raises(DomainError) as error:
        sign_once(client, issued)
    assert error.value.code == "INVALID_CERTIFICATE"
    assert execution_count(database) == 1
    with pytest.raises(DomainError) as replay:
        sign_once(client, issued)
    assert replay.value.code == "ALREADY_USED"


def test_ambiguous_configuration_before_claim_never_calls_signer(
    client, database, issued, sign_calls
):
    with database[1].begin() as session:
        session.add(
            SimulationConfigRecord(
                id="second-config-before-claim", config_digest="f" * 64, payload={}
            )
        )
    with pytest.raises(DomainError) as error:
        sign_once(client, issued)
    assert error.value.code == "UNAVAILABLE"
    assert execution_count(database) == 0 and sign_calls == []


def test_expiry_during_live_chain_check_prevents_signing(
    client, database, issued, sign_calls, monkeypatch
):
    original = gate.chain_transaction

    def elapsed(*args, **kwargs):
        transaction = original(*args, **kwargs)
        expiration = datetime.fromisoformat(
            issued[0]["payload"]["expires_at"].replace("Z", "+00:00")
        )

        class Clock:
            @staticmethod
            def now(tz=None):
                return expiration

        monkeypatch.setattr(gate, "datetime", Clock)
        return transaction

    monkeypatch.setattr(gate, "chain_transaction", elapsed)
    with pytest.raises(DomainError) as error:
        sign_once(client, issued)
    assert error.value.code == "EXPIRED"
    assert execution_count(database) == 1 and sign_calls == []


def test_exact_consumed_approval_is_required_at_signing(
    client, database, issued, sign_calls, monkeypatch
):
    action = dict(issued[0]["payload"]["action"], id="consumed-approval-case", amount_minor=20000)
    response = client.post("/verify", json={"action": action})
    assert response.status_code == 200
    cert = client.get("/certificates/" + response.json()["certificate_id"]).json()
    assert (
        client.post(
            "/approvals",
            json={
                "certificate_id": cert["payload"]["id"],
                "action_digest": cert["payload"]["action_digest"],
                "decision": "APPROVE",
            },
        ).status_code
        == 200
    )
    issued = (
        cert,
        issued[1],
        issued[2].model_copy(
            update={
                "certificate_id": cert["payload"]["id"],
                "action_digest": cert["payload"]["action_digest"],
            }
        ),
    )
    original = gate.claim_execution

    def clear_consumption(*args, **kwargs):
        result = original(*args, **kwargs)
        with database[1].begin() as session:
            row = session.scalar(select(ApprovalRecord))
            row.consumed_at = None
            row.payload = {**row.payload, "consumed_at": None}
        return result

    monkeypatch.setattr(gate, "claim_execution", clear_consumption)
    with pytest.raises(DomainError) as error:
        sign_once(client, issued)
    assert error.value.code == "APPROVAL_REQUIRED"
    assert execution_count(database) == 1 and sign_calls == []
