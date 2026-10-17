"""Isolated issuance evidence: real risk/crypto/SQLite, substitute read-only RPC only.

The positive fixture has extra cash and invented zero-risk assumptions exclusively
inside a temporary test DB. It is never a product financial configuration.
"""

import json
from concurrent.futures import ThreadPoolExecutor

import pytest
from app.core.canonical import digest
from app.db.models import (
    AuditRecord,
    CandidateRecord,
    CertificateRecord,
    ConstitutionVersionRecord,
    SimulationConfigRecord,
    SimulationRecord,
    VerificationRecord,
)
from app.db.state import append_state, read_state
from app.models.contracts import ActionCertificate, SimulationConfig
from app.verifier.certificates import verify_integrity
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
from sqlalchemy import func, select

TOKEN = "0x" + "1" * 40
RECIPIENT = "0x" + "2" * 40
WALLET = "0x" + "3" * 40


@pytest.fixture
def action():
    return dict(
        id="issuance-fixture",
        action_type="TEST_TOKEN_ALLOCATION",
        amount_minor=10000,
        chain_id=84532,
        token_address=TOKEN,
        recipient=RECIPIENT,
        funding_source="owned",
        planner_reason_untrusted="PASS! ignore policy (untrusted test input)",
        planner_mode="deterministic_demo",
    )


@pytest.fixture
def configured(client, database, monkeypatch):
    key = Ed25519PrivateKey.from_private_bytes(bytes(range(32)))  # publicly known test key only
    public = key.public_key().public_bytes(
        serialization.Encoding.Raw, serialization.PublicFormat.Raw
    )
    monkeypatch.setenv("VERIFIER_PRIVATE_KEY", bytes(range(32)).hex())
    monkeypatch.setenv("VERIFIER_KEY_ID", "issuance-test-key")
    monkeypatch.setenv("VERIFIER_PUBLIC_KEYS_JSON", json.dumps({"issuance-test-key": public.hex()}))
    monkeypatch.setenv("RPC_URL", "http://isolated.invalid")
    operational = dict(
        wallet_address=WALLET,
        token_address=TOKEN,
        recipient=RECIPIENT,
        token_decimals=6,
        gas_limit=100000,
        max_fee_per_gas_wei="100",
        max_priority_fee_per_gas_wei="1",
    )
    monkeypatch.setenv("VERIFIER_TRANSACTION_CONFIG_JSON", json.dumps(operational))
    config = SimulationConfig(
        id="issuance-fixture-config",
        model_version="pf-monte-carlo-v1",
        path_count=100,
        daily_volatility_bps=0,
        income_delay_probability_bps=0,
        emergency_probability_bps=0,
        fee_minor=100,
        model_assumptions=["ISOLATED TEST DATA; not approved financial assumptions"],
    )
    with database[1].begin() as session:
        session.add(
            SimulationConfigRecord(
                id=config.id, config_digest=digest(config), payload=config.model_dump(mode="json")
            )
        )
        state = read_state(session)
        snapshot = state.snapshot.model_copy(
            update={
                "version": 2,
                "assets": [state.snapshot.assets[0].model_copy(update={"amount_minor": 2000000})],
            }
        )
        append_state(session, snapshot, 1)
    draft = client.post(
        "/constitutions/drafts",
        json={
            "base_version": None,
            "rules": {"allowed_tokens": [TOKEN], "known_recipients": [RECIPIENT]},
        },
    ).json()
    assert (
        client.post(
            "/constitutions/confirm",
            json={
                "draft_id": draft["id"],
                "confirmed": True,
                "expected_policy_digest": digest(draft["rules"]),
            },
        ).status_code
        == 200
    )
    return key, operational


@pytest.fixture
def rpc(monkeypatch):
    # Construct the production Web3 adapter, substitute only its HTTP transport reads.
    from web3 import Web3
    from web3.providers import BaseProvider

    class Provider(BaseProvider):
        def __init__(self):
            super().__init__()
            self.chain = 84532
            self.balance = 10**18
            self.tokens = 10**18
            self.decimals = 6
            self.code = "0x6000"
            self.gas = 50000
            self.nonce = 7
            self.base_fee = 10
            self.fail = False
            self.calls = []

        def make_request(self, method, params):
            self.calls.append((method, params))
            assert method not in {"eth_sendRawTransaction", "eth_sendTransaction", "eth_sign"}
            if self.fail:
                raise RuntimeError("SECRET RPC URL MUST NOT LEAK")
            result = {
                "eth_chainId": hex(self.chain),
                "eth_getBalance": hex(self.balance),
                "eth_getCode": self.code,
                "eth_getTransactionCount": hex(self.nonce),
                "eth_estimateGas": hex(self.gas),
            }.get(method)
            if method == "eth_call":
                value = self.decimals if params[0]["data"] == "0x313ce567" else self.tokens
                result = "0x" + f"{value:064x}"
            if method == "eth_getBlockByNumber":
                result = {"baseFeePerGas": hex(self.base_fee), "number": "0x1"}
            assert result is not None, method
            return {"jsonrpc": "2.0", "id": 1, "result": result}

    provider = Provider()
    monkeypatch.setattr(Web3, "HTTPProvider", lambda *a, **kw: provider)
    return provider


def counts(database):
    with database[1]() as session:
        return tuple(
            session.scalar(select(func.count()).select_from(m))
            for m in (
                CandidateRecord,
                SimulationRecord,
                VerificationRecord,
                CertificateRecord,
                AuditRecord,
            )
        )


def test_issues_exact_signed_certificate_from_recomputed_evidence(
    client, database, configured, rpc, action
):
    response = client.post("/verify", json={"action": action})
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["verdict"]["decision"] == "PASS"
    cert = ActionCertificate.model_validate(
        client.get("/certificates/" + result["certificate_id"]).json()
    )
    assert (
        verify_integrity(cert, {"issuance-test-key": configured[0].public_key()}).status == "VALID"
    )
    p = cert.payload
    assert p.action_digest == digest(action)
    assert p.transaction.nonce == 7
    assert p.transaction.amount_base_units == "100000000"
    assert p.transaction.data == "0xa9059cbb" + RECIPIENT[2:].rjust(64, "0") + f"{100000000:064x}"
    assert p.verdict.model_dump(mode="json") == result["verdict"]
    assert len(p.simulation.stress_results) == 4 and all(
        s.passed for s in p.simulation.stress_results
    )
    assert p.simulation.config.model_assumptions[0].startswith("ISOLATED TEST DATA")
    assert (p.expires_at - p.issued_at).total_seconds() == 300
    assert not p.approval.required
    assert counts(database)[:4] == (1, 1, 1, 1)
    assert (
        client.post(
            "/execute",
            json={
                "certificate_id": p.id,
                "action_digest": p.action_digest,
                "idempotency_key": "still-disabled-1234",
            },
        ).status_code
        == 501
    )
    assert client.post(f"/certificates/{p.id}/verify").json()["status"] == "VALID"


def test_baseline_denies_even_when_planner_claims_pass(client, database, configured, rpc, action):
    with database[1].begin() as session:
        state = read_state(session)
        original = state.snapshot.model_copy(
            update={
                "version": 3,
                "assets": [state.snapshot.assets[0].model_copy(update={"amount_minor": 1200000})],
            }
        )
        append_state(session, original, 2)
    result = client.post("/verify", json={"action": action})
    assert result.status_code == 200
    assert result.json()["verdict"]["decision"] == "DENY"
    assert result.json()["certificate_id"] is None
    assert any(c["status"] == "FAIL" for c in result.json()["verdict"]["checks"])
    assert counts(database)[:4] == (1, 1, 1, 0)
    assert rpc.calls == []


@pytest.mark.parametrize("changes", [{"amount_minor": 20000}, {"recipient": "0x" + "4" * 40}])
def test_approval_requirement_is_bound_not_granted(
    client, configured, rpc, action, monkeypatch, changes
):
    action.update(changes)
    if "recipient" in changes:
        monkeypatch.setenv(
            "VERIFIER_TRANSACTION_CONFIG_JSON",
            json.dumps({**configured[1], "recipient": changes["recipient"]}),
        )
    response = client.post("/verify", json={"action": action})
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["verdict"]["decision"] == "REQUIRES_APPROVAL"
    cert = client.get("/certificates/" + result["certificate_id"]).json()
    assert cert["payload"]["approval"]["required"] is True
    assert (
        client.post("/certificates/" + result["certificate_id"] + "/verify").json()["status"]
        == "APPROVAL_REQUIRED"
    )


@pytest.mark.parametrize(
    "change", ["network", "token", "decimals", "gas", "fee", "native", "tokens", "rpc", "nonce"]
)
def test_chain_refusals_roll_back_all_artifacts(client, database, configured, rpc, action, change):
    before = counts(database)
    if change == "network":
        rpc.chain = 1
    if change == "token":
        rpc.code = "0x"
    if change == "decimals":
        rpc.decimals = 18
    if change == "gas":
        rpc.gas = 100001
    if change == "fee":
        rpc.base_fee = 101
    if change == "native":
        rpc.balance = 1
    if change == "tokens":
        rpc.tokens = 1
    if change == "rpc":
        rpc.fail = True
    if change == "nonce":
        rpc.nonce = -1
    result = client.post("/verify", json={"action": action})
    assert result.status_code in (403, 503), result.text
    assert "SECRET" not in result.text
    assert counts(database) == before


@pytest.mark.parametrize(
    "missing",
    [
        "VERIFIER_PRIVATE_KEY",
        "VERIFIER_KEY_ID",
        "VERIFIER_PUBLIC_KEYS_JSON",
        "RPC_URL",
        "VERIFIER_TRANSACTION_CONFIG_JSON",
    ],
)
def test_missing_runtime_configuration_fails_closed(
    client, database, configured, rpc, action, monkeypatch, missing
):
    monkeypatch.setenv(missing, "")
    before = counts(database)
    result = client.post("/verify", json={"action": action})
    assert result.status_code == 503
    assert counts(database) == before


def test_unknown_authority_not_accepted(client, action):
    assert client.post("/verify", json={"action": action}).status_code == 503
    assert (
        client.post("/verify", json={"action": action, "verdict": {"decision": "PASS"}}).status_code
        == 422
    )
    assert client.post("/verify", json={"action": {**action, "simulation": {}}}).status_code == 422
    assert (
        client.post("/verify", json={"action": action}, headers={"X-CSRF-Token": "bad"}).status_code
        == 403
    )
    client.cookies.clear()
    assert client.post("/verify", json={"action": action}).status_code == 401


@pytest.mark.parametrize(
    "corruption", ["policy", "config", "multiple", "audit", "simulation", "candidate"]
)
def test_corrupt_trusted_storage_never_issues(
    client, database, configured, rpc, action, corruption
):
    if corruption in {"simulation", "candidate"}:
        assert client.post("/simulate", json={"action": action}).status_code == 200
    with database[1].begin() as session:
        if corruption == "policy":
            session.scalar(select(ConstitutionVersionRecord)).policy_digest = "f" * 64
        if corruption == "config":
            session.scalar(select(SimulationConfigRecord)).config_digest = "f" * 64
        if corruption == "multiple":
            session.add(SimulationConfigRecord(id="ambiguous", config_digest="f" * 64, payload={}))
        if corruption == "audit":
            session.scalar(select(AuditRecord)).event_hash = "f" * 64
        if corruption == "simulation":
            row = session.scalar(select(SimulationRecord))
            row.payload = {
                **row.payload,
                "metrics": {**row.payload["metrics"], "goal_satisfaction_probability_bps": 0},
            }
        if corruption == "candidate":
            session.get(CandidateRecord, action["id"]).action_digest = "f" * 64
    before = counts(database)
    result = client.post("/verify", json={"action": action})
    assert result.status_code in (409, 503), result.text
    assert counts(database) == before


def test_concurrent_issuance_preserves_unique_certificate_nonces(
    client, database, configured, rpc, action
):
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(lambda _: client.post("/verify", json={"action": action}), range(2))
        )
    assert all(r.status_code == 200 for r in results)
    ids = [r.json()["certificate_id"] for r in results]
    assert len(set(ids)) == 2
    with database[1]() as session:
        certs = list(session.scalars(select(CertificateRecord)))
        assert len({c.nonce for c in certs}) == 2
    assert counts(database)[:4] == (1, 1, 2, 2)


def test_named_stress_failure_denies_even_when_probability_policy_passes(
    client, database, configured, rpc, action
):
    with database[1].begin() as session:
        state = read_state(session)
        snapshot = state.snapshot.model_copy(
            update={
                "version": 3,
                "assets": [state.snapshot.assets[0].model_copy(update={"amount_minor": 1400000})],
            }
        )
        append_state(session, snapshot, 2)
    result = client.post("/verify", json={"action": action})
    assert result.status_code == 200
    checks = result.json()["verdict"]["checks"]
    assert next(c for c in checks if c["rule"] == "reserve_breach_probability")["status"] == "PASS"
    assert next(c for c in checks if c["rule"] == "named_stresses")["status"] == "FAIL"
    assert result.json()["verdict"]["decision"] == "DENY"
    assert result.json()["certificate_id"] is None
    assert rpc.calls == []


@pytest.mark.parametrize(
    "change",
    [
        "bad-seed",
        "wrong-key",
        "zero-wallet",
        "wrong-recipient",
        "wrong-token",
        "bad-gas",
        "bad-fees",
    ],
)
def test_invalid_server_configuration_does_not_authorize(
    client, database, configured, rpc, action, monkeypatch, change
):
    if change == "bad-seed":
        monkeypatch.setenv("VERIFIER_PRIVATE_KEY", "SECRET-INVALID-KEY")
    if change == "wrong-key":
        monkeypatch.setenv(
            "VERIFIER_PUBLIC_KEYS_JSON",
            json.dumps(
                {
                    "issuance-test-key": Ed25519PrivateKey.generate()
                    .public_key()
                    .public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
                    .hex()
                }
            ),
        )
    changes = {
        "zero-wallet": {"wallet_address": "0x" + "0" * 40},
        "wrong-recipient": {"recipient": "0x" + "9" * 40},
        "wrong-token": {"token_address": "0x" + "9" * 40},
        "bad-gas": {"gas_limit": 21000.5},
        "bad-fees": {"max_priority_fee_per_gas_wei": "101"},
    }
    if change in changes:
        monkeypatch.setenv(
            "VERIFIER_TRANSACTION_CONFIG_JSON", json.dumps({**configured[1], **changes[change]})
        )
    before = counts(database)
    result = client.post("/verify", json={"action": action})
    assert result.status_code in (403, 503)
    assert "SECRET" not in result.text
    assert counts(database) == before


def test_signing_failure_rolls_back_new_simulation_and_verification(
    client, database, configured, rpc, action, monkeypatch
):
    from app.verifier import service

    def fail(*args, **kwargs):
        raise RuntimeError("SECRET KEY MUST NOT LEAK")

    monkeypatch.setattr(service, "sign_certificate", fail)
    before = counts(database)
    result = client.post("/verify", json={"action": action})
    assert result.status_code == 503
    assert "SECRET" not in result.text
    assert counts(database) == before


def test_certificate_audit_failure_rolls_back_certificate_and_all_new_artifacts(
    client, database, configured, rpc, action, monkeypatch
):
    from app.verifier import service

    original = service.append_event

    def fail(session, **kwargs):
        if kwargs["event_type"] == "CERTIFICATE_ISSUED":
            raise RuntimeError("simulated database write failure")
        return original(session, **kwargs)

    monkeypatch.setattr(service, "append_event", fail)
    before = counts(database)
    assert client.post("/verify", json={"action": action}).status_code == 503
    assert counts(database) == before


def test_simulator_failure_rolls_back_and_redacts(
    client, database, configured, rpc, action, monkeypatch
):
    from app.verifier import service

    def fail(*args):
        raise RuntimeError("SECRET SIMULATOR DETAIL")

    monkeypatch.setattr(service, "simulate", fail)
    before = counts(database)
    response = client.post("/verify", json={"action": action})
    assert response.status_code == 503 and "SECRET" not in response.text
    assert counts(database) == before


def test_real_issuance_integrates_with_independent_claim_recheck(
    client, database, configured, rpc, action
):
    from app.execution.gate import claim_execution
    from app.execution.signer import TestnetPolicy
    from app.models.contracts import ExecuteRequest
    from app.verifier.service import recompute

    response = client.post("/verify", json={"action": action})
    assert response.status_code == 200
    cert = client.get("/certificates/" + response.json()["certificate_id"]).json()
    policy = TestnetPolicy(
        wallet_address=WALLET,
        token_address=TOKEN,
        recipient=RECIPIENT,
        token_decimals=6,
        max_gas_limit=100000,
        max_fee_per_gas_wei="100",
    )
    execution = claim_execution(
        client.app.state.engine,
        ExecuteRequest(
            certificate_id=cert["payload"]["id"],
            action_digest=cert["payload"]["action_digest"],
            idempotency_key="real-recompute-fixture",
        ),
        "demo-user",
        policy=policy,
        recheck=recompute,
    )
    assert execution.status == "CLAIMED" and execution.tx_hash is None
    assert (
        client.post("/certificates/" + cert["payload"]["id"] + "/verify").json()["status"]
        == "ALREADY_USED"
    )


def test_reused_candidate_id_cannot_bind_new_state_or_different_action(
    client, database, configured, rpc, action
):
    assert client.post("/verify", json={"action": action}).status_code == 200
    before = counts(database)
    changed = {**action, "amount_minor": 10001}
    assert client.post("/verify", json={"action": changed}).status_code == 409
    assert counts(database) == before
    with database[1].begin() as session:
        state = read_state(session)
        append_state(session, state.snapshot.model_copy(update={"version": 3}), 2)
    assert client.post("/verify", json={"action": action}).status_code == 409
    assert counts(database) == before


@pytest.mark.parametrize("corruption", ["hash", "metadata"])
def test_corrupt_financial_state_refuses_before_issuance(
    client, database, configured, rpc, action, corruption
):
    from app.db.models import FinancialStateRecord

    with database[1].begin() as session:
        state = read_state(session)
        row = session.get(FinancialStateRecord, state.id)
        if corruption == "hash":
            row.snapshot_hash = "f" * 64
        else:
            row.version = 99
    before = counts(database)
    assert client.post("/verify", json={"action": action}).status_code == 503
    assert counts(database) == before


def test_confirmed_policy_still_requires_explicit_simulation_configuration(
    client, database, configured, rpc, action
):
    with database[1].begin() as session:
        session.delete(session.scalar(select(SimulationConfigRecord)))
    before = counts(database)
    result = client.post("/verify", json={"action": action})
    assert result.status_code == 503
    assert counts(database) == before
    assert rpc.calls == []


@pytest.mark.parametrize("duplicate", [False, True])
def test_incomplete_stress_evidence_refuses_atomically(
    client, database, configured, rpc, action, monkeypatch, duplicate
):
    from app.verifier import service

    original = service.simulate

    def incomplete(value):
        result = original(value)
        stresses = list(result.stress_results)
        if duplicate:
            stresses[-1] = stresses[0]
        else:
            stresses.pop()
        return result.model_copy(update={"stress_results": stresses})

    monkeypatch.setattr(service, "simulate", incomplete)
    before = counts(database)
    assert client.post("/verify", json={"action": action}).status_code == 503
    assert counts(database) == before


@pytest.mark.parametrize("stage", ["lock", "commit"])
def test_transaction_boundary_failure_is_sanitized_and_rolls_back(
    client, database, configured, rpc, action, stage
):
    from sqlalchemy import event
    from sqlalchemy.exc import OperationalError

    engine = client.app.state.engine
    before = counts(database)

    def fail_lock(connection, cursor, statement, parameters, context, executemany):
        if statement == "BEGIN IMMEDIATE":
            raise OperationalError(statement, {}, Exception("SECRET DATABASE DETAIL"))

    def fail_commit(connection):
        raise OperationalError("COMMIT", {}, Exception("SECRET DATABASE DETAIL"))

    name = "before_cursor_execute" if stage == "lock" else "commit"
    listener = fail_lock if stage == "lock" else fail_commit
    event.listen(engine, name, listener)
    try:
        result = client.post("/verify", json={"action": action})
    finally:
        event.remove(engine, name, listener)
    assert result.status_code == 503
    assert result.json()["code"] == "UNAVAILABLE"
    assert "SECRET" not in result.text
    assert counts(database) == before
