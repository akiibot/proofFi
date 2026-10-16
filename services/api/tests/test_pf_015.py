"""Isolated dispatch tests: real issuance/signatures/SQLite, substitute RPC only.

No fixture hash/acknowledgement is evidence of a real network transaction.
"""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace

import pytest
from app.core.errors import DomainError
from app.db.models import AuditRecord, ExecutionEnvelopeRecord, ExecutionRecord
from app.db.state import append_state, read_state
from app.execution import gate, service
from app.execution.rpc import BroadcastUncertain, hash_hex
from app.models.contracts import ExecuteRequest
from sqlalchemy import func, select
from test_pf_014_signing import issued as issued
from test_pf_014_signing import sign_calls as sign_calls
from test_pf_029 import action as action
from test_pf_029 import configured as configured
from test_pf_029 import rpc as rpc
from web3 import Web3


@pytest.fixture
def transport(monkeypatch, database):
    class Transport:
        sent = []
        failure = False
        mismatch = False

        def broadcast(self, raw):
            # A separate connection must see committed bytes and reservation before RPC.
            with database[1]() as session:
                row = session.scalar(select(ExecutionRecord))
                envelope = session.scalar(select(ExecutionEnvelopeRecord))
                assert row.status == "PENDING"
                assert row.tx_hash == hash_hex(Web3.keccak(raw))
                assert envelope.raw_transaction == raw
                assert envelope.transaction_hash == row.tx_hash
                events = [a.payload["event_type"] for a in session.scalars(select(AuditRecord))]
                assert "EXECUTION_DISPATCH_RESERVED" in events
            self.sent.append(raw)
            if self.failure:
                raise BroadcastUncertain(hash_hex(Web3.keccak(raw)))
            return "0x" + "0" * 64 if self.mismatch else hash_hex(Web3.keccak(raw))

    result = Transport()
    monkeypatch.setattr(service.EvmGateway, "from_rpc_url", lambda *a, **kw: result)
    return result


def prepare(client, issued):
    return service.prepare_execution(
        client.app.state.engine, issued[2], "demo-user", policy=issued[1]
    )


def broadcast(client, issued, execution, actor="demo-user"):
    return service.broadcast_once(
        client.app.state.engine, issued[2], actor, policy=issued[1], execution_id=execution.id
    )


def test_durable_bytes_before_send_and_no_receipt_claim(
    client, database, issued, transport, sign_calls
):
    execution = prepare(client, issued)
    assert execution.status == "CLAIMED" and execution.tx_hash is None
    assert transport.sent == [] and len(sign_calls) == 1
    pending = broadcast(client, issued, execution)
    assert pending.status == "PENDING" and pending.block_number is None
    assert pending.confirmations == 0 and pending.tx_hash == hash_hex(
        Web3.keccak(transport.sent[0])
    )
    with database[1]() as session:
        assert read_state(session).snapshot.version == issued[0]["payload"]["state_version"]
        raw = session.scalar(select(ExecutionEnvelopeRecord)).raw_transaction
        audit = str([r.payload for r in session.scalars(select(AuditRecord))])
        assert raw.hex() not in audit and str(raw) not in audit
    assert client.post("/execute", json=issued[2].model_dump(mode="json")).status_code == 501
    with pytest.raises(DomainError):
        broadcast(client, issued, execution)
    with pytest.raises(DomainError):
        prepare(client, issued)
    assert len(transport.sent) == len(sign_calls) == 1


@pytest.mark.parametrize("failure", ["timeout", "wrong_hash"])
def test_ambiguous_send_preserves_exact_hash_and_never_retries(
    client, database, issued, transport, sign_calls, failure
):
    execution = prepare(client, issued)
    transport.failure = failure == "timeout"
    transport.mismatch = failure == "wrong_hash"
    with pytest.raises(BroadcastUncertain):
        broadcast(client, issued, execution)
    with database[1]() as session:
        row = session.get(ExecutionRecord, execution.id)
        assert row.status == "PENDING" and row.payload["status"] == "PENDING"
        assert row.tx_hash == hash_hex(Web3.keccak(transport.sent[0]))
    with pytest.raises(DomainError):
        broadcast(client, issued, execution)
    with pytest.raises(DomainError):
        prepare(client, issued)
    assert len(transport.sent) == len(sign_calls) == 1


def test_concurrent_dispatch_sends_at_most_once(client, issued, transport, sign_calls):
    execution = prepare(client, issued)

    def call(_):
        try:
            return broadcast(client, issued, execution).status
        except DomainError:
            return "REFUSED"

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(call, range(2))) == ["PENDING", "REFUSED"]
    assert len(transport.sent) == len(sign_calls) == 1


@pytest.mark.parametrize("phase", ["envelope", "reservation"])
def test_commit_failure_never_sends_and_preserves_claim(
    client, database, issued, transport, monkeypatch, sign_calls, phase
):
    original = service.append_event

    def fail(session, **kwargs):
        if kwargs["event_type"] == (
            "EXECUTION_ENVELOPE_STORED" if phase == "envelope" else "EXECUTION_DISPATCH_RESERVED"
        ):
            raise RuntimeError("SECRET backend information")
        return original(session, **kwargs)

    execution = None if phase == "envelope" else prepare(client, issued)
    monkeypatch.setattr(service, "append_event", fail)
    with pytest.raises(DomainError) as failure:
        if execution is None:
            prepare(client, issued)
        else:
            broadcast(client, issued, execution)
    assert "SECRET" not in failure.value.message
    assert transport.sent == [] and len(sign_calls) == 1
    with database[1]() as session:
        assert session.scalar(select(ExecutionRecord)).status == "CLAIMED"
        assert session.scalar(select(func.count()).select_from(ExecutionEnvelopeRecord)) == (
            0 if phase == "envelope" else 1
        )
    with pytest.raises(DomainError):
        prepare(client, issued)
    assert len(sign_calls) == 1


@pytest.mark.parametrize("change", ["nonce", "decimals", "gas", "network", "balance"])
def test_live_change_after_journaling_strands_reservation_without_send(
    client, database, issued, transport, rpc, sign_calls, change
):
    execution = prepare(client, issued)
    setattr(
        rpc,
        {"network": "chain"}.get(change, change),
        {"nonce": 8, "decimals": 18, "gas": 100001, "network": 1, "balance": 0}[change],
    )
    with pytest.raises(DomainError):
        broadcast(client, issued, execution)
    assert transport.sent == [] and len(sign_calls) == 1
    with database[1]() as session:
        assert session.get(ExecutionRecord, execution.id).status == "PENDING"
    with pytest.raises(DomainError):
        broadcast(client, issued, execution)


@pytest.mark.parametrize("change", ["actor", "request", "state", "audit", "claim"])
def test_changed_authority_or_corruption_never_dispatches(
    client, database, issued, transport, change
):
    execution = prepare(client, issued)
    if change == "request":
        issued = (
            *issued[:2],
            ExecuteRequest(
                **{**issued[2].model_dump(), "idempotency_key": "different-request-key"}
            ),
        )
    with database[1].begin() as session:
        if change == "state":
            state = read_state(session)
            append_state(
                session,
                state.snapshot.model_copy(update={"version": state.snapshot.version + 1}),
                state.snapshot.version,
            )
        if change == "audit":
            row = session.scalar(select(AuditRecord).order_by(AuditRecord.sequence))
            row.payload = {**row.payload, "actor": "corrupt-actor"}
        if change == "claim":
            row = session.get(ExecutionRecord, execution.id)
            row.payload = {**row.payload, "certificate_id": "different-certificate"}
    with pytest.raises(DomainError):
        broadcast(
            client, issued, execution, actor="other-user" if change == "actor" else "demo-user"
        )
    assert transport.sent == []


def test_unjournaled_claim_cannot_dispatch(client, issued, transport):
    attempt = gate.sign_authorized_once(
        client.app.state.engine, issued[2], "demo-user", policy=issued[1]
    )
    with pytest.raises(DomainError):
        broadcast(client, issued, attempt.execution)
    assert transport.sent == []


@pytest.mark.parametrize("mutation", ["bytes", "execution"])
def test_forged_handoff_is_not_signing_authority(client, database, issued, transport, mutation):
    attempt = gate.sign_authorized_once(
        client.app.state.engine, issued[2], "demo-user", policy=issued[1]
    )
    if mutation == "bytes":
        attempt = replace(attempt, raw_transaction=b"forged bytes")
    else:
        attempt = replace(
            attempt, execution=attempt.execution.model_copy(update={"id": "forged-id"})
        )
    with pytest.raises(DomainError):
        service.persist_signed_attempt(
            client.app.state.engine, issued[2], "demo-user", policy=issued[1], attempt=attempt
        )
    with database[1]() as session:
        assert session.scalar(select(func.count()).select_from(ExecutionEnvelopeRecord)) == 0
    assert transport.sent == []


def test_missing_signing_evidence_rejects_valid_bytes(client, database, issued):
    attempt = gate.sign_authorized_once(
        client.app.state.engine, issued[2], "demo-user", policy=issued[1]
    )
    with database[1].begin() as session:
        last = session.scalar(select(AuditRecord).order_by(AuditRecord.sequence.desc()))
        assert last.payload["event_type"] == "EXECUTION_SIGNED"
        session.delete(last)
    with pytest.raises(DomainError):
        service.persist_signed_attempt(
            client.app.state.engine, issued[2], "demo-user", policy=issued[1], attempt=attempt
        )
    with database[1]() as session:
        assert session.scalar(select(func.count()).select_from(ExecutionEnvelopeRecord)) == 0


def test_failure_after_dispatch_commit_preserves_reservation_without_send(
    client, database, issued, transport, monkeypatch
):
    execution = prepare(client, issued)

    def unavailable(*args, **kwargs):
        raise RuntimeError("SECRET RPC setup detail")

    monkeypatch.setattr(service.EvmGateway, "from_rpc_url", unavailable)
    with pytest.raises(DomainError) as failure:
        broadcast(client, issued, execution)
    assert "SECRET" not in failure.value.message and transport.sent == []
    with database[1]() as session:
        assert session.get(ExecutionRecord, execution.id).status == "PENDING"
        assert session.scalar(select(ExecutionEnvelopeRecord)).transaction_hash is not None
    with pytest.raises(DomainError):
        broadcast(client, issued, execution)
    assert transport.sent == []


def test_expiry_during_live_check_never_dispatches(client, issued, transport, monkeypatch):
    from datetime import datetime

    execution = prepare(client, issued)
    original = service.chain_transaction
    expiry = datetime.fromisoformat(issued[0]["payload"]["expires_at"].replace("Z", "+00:00"))

    class Clock:
        @staticmethod
        def now(tz=None):
            return expiry

    def delayed(*args, **kwargs):
        result = original(*args, **kwargs)
        monkeypatch.setattr(service, "datetime", Clock)
        monkeypatch.setattr(gate, "datetime", Clock)
        return result

    monkeypatch.setattr(service, "chain_transaction", delayed)
    with pytest.raises(DomainError) as failure:
        broadcast(client, issued, execution)
    assert failure.value.code == "EXPIRED" and transport.sent == []
