"""PF-042 design boundary evidence, using isolated databases and RPC only.

Real issuance, consumed human approval and signatures exercise existing services.
These tests do not implement the proposed advanced repair authority or contact a chain.
"""

from concurrent.futures import ThreadPoolExecutor

import pytest
from app.core.errors import DomainError
from app.db.models import ApprovalRecord, Base, ExecutionEnvelopeRecord, ExecutionRecord
from app.db.state import append_state, read_state
from app.execution import gate, reconcile, service
from app.execution.router import execute_internal
from sqlalchemy import select
from test_pf_014_signing import issued as _base_issued
from test_pf_014_signing import sign_calls as sign_calls
from test_pf_015 import transport as transport
from test_pf_015_reconcile import chain as chain
from test_pf_015_reconcile import count_events, poll, state
from test_pf_029 import action as action
from test_pf_029 import configured as configured
from test_pf_029 import rpc as rpc

base_issued = _base_issued


@pytest.fixture
def issued(client, base_issued):
    action = dict(base_issued[0]["payload"]["action"], id="pf042-action", amount_minor=20000)
    response = client.post("/verify", json={"action": action})
    assert response.status_code == 200
    cert = client.get("/certificates/" + response.json()["certificate_id"]).json()
    assert cert["payload"]["approval"]["required"] is True
    assert client.post(
        "/approvals",
        json={
            "certificate_id": cert["payload"]["id"],
            "action_digest": cert["payload"]["action_digest"],
            "decision": "APPROVE",
        },
    ).status_code == 200
    return cert, base_issued[1], base_issued[2].model_copy(
        update={
            "certificate_id": cert["payload"]["id"],
            "action_digest": cert["payload"]["action_digest"],
        }
    )


def persisted(database):
    """Compare every artifact/head/claim/approval/audit/envelope, including bytes."""
    with database[1]() as session:
        return {
            table.name: [dict(row) for row in session.execute(
                select(table).order_by(*table.primary_key.columns)
            ).mappings()]
            for table in Base.metadata.sorted_tables
        }


def assert_consumed(database, execution_id):
    with database[1]() as session:
        claim = session.get(ExecutionRecord, execution_id)
        approval = session.scalar(select(ApprovalRecord).where(
            ApprovalRecord.certificate_id == claim.certificate_id
        ))
        assert approval.consumed_at is not None
        assert approval.payload["consumed_at"] is not None


@pytest.mark.parametrize("failure", ["lost_bytes", "envelope_commit"])
def test_lost_handoff_restart_concurrent_retries_preserve_every_artifact(
    client, database, issued, transport, sign_calls, monkeypatch, failure
):
    if failure == "lost_bytes":
        attempt = gate.sign_authorized_once(
            client.app.state.engine, issued[2], "demo-user", policy=issued[1]
        )
        execution_id = attempt.execution.id
        del attempt  # Simulated process loss: bytes never reached the private journal.
    else:
        original = service.append_event

        def fail(session, **kwargs):
            if kwargs["event_type"] == "EXECUTION_ENVELOPE_STORED":
                raise RuntimeError("private commit diagnostic")
            return original(session, **kwargs)

        with monkeypatch.context() as patch:
            patch.setattr(service, "append_event", fail)
            with pytest.raises(DomainError) as error:
                service.prepare_execution(
                    client.app.state.engine, issued[2], "demo-user", policy=issued[1]
                )
            assert error.value.code == "UNAVAILABLE"
        with database[1]() as session:
            execution_id = session.scalar(select(ExecutionRecord)).id
    assert_consumed(database, execution_id)
    assert count_events(database, "EXECUTION_SIGNED") == 1
    assert count_events(database, "EXECUTION_ENVELOPE_STORED") == 0
    with database[1]() as session:
        assert session.scalar(select(ExecutionEnvelopeRecord)) is None
    before = persisted(database)
    client.app.state.engine.dispose()  # Reopen durable state through fresh connections.

    def retry(index):
        request = issued[2] if index % 2 == 0 else issued[2].model_copy(
            update={"idempotency_key": "pf042-forbidden-replacement"}
        )
        try:
            execute_internal(client.app.state.engine, request, "demo-user", policy=issued[1])
        except DomainError as error:
            return error.code.value
        pytest.fail("Stranded claim accepted as a fresh execution")

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(retry, range(4))) == ["ALREADY_USED"] * 2 + ["CONFLICT"] * 2
    with pytest.raises(DomainError):
        reconcile.inspect_recovery(
            client.app.state.engine, issued[2], "demo-user", policy=issued[1],
            execution_id=execution_id,
        )
    assert persisted(database) == before
    assert len(sign_calls) == 1 and transport.sent == []
    assert_consumed(database, execution_id)


@pytest.mark.parametrize("asset", ["cash", "position"])
def test_changed_asset_parallel_recovery_never_overwrites_or_resurrects_approval(
    client, database, issued, chain, transport, sign_calls, asset
):
    assert poll(client, issued, chain).status == "CONFIRMED"
    with database[1].begin() as session:
        current = read_state(session)
        assets = list(current.snapshot.assets)
        index = 0 if asset == "cash" else -1
        assets[index] = assets[index].model_copy(
            update={"amount_minor": assets[index].amount_minor + 1}
        )
        append_state(session, current.snapshot.model_copy(update={
            "version": current.snapshot.version + 1, "assets": assets,
        }), current.snapshot.version)
    chain[1].value = None
    observed = poll(client, issued, chain)
    assert observed.status == "REORGED" and observed.error.code == "CONFLICT"
    inspected = state(database)
    before = persisted(database)
    client.app.state.engine.dispose()

    def recover(_):
        with pytest.raises(DomainError) as error:
            reconcile.recover_unchanged_assets(
                client.app.state.engine, issued[2], "demo-user", policy=issued[1],
                execution_id=chain[0].id, expected_state_hash=inspected.snapshot_hash,
            )
        return error.value.code.value

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert list(pool.map(recover, range(2))) == ["CONFLICT", "CONFLICT"]
    with pytest.raises(DomainError) as error:
        service.prepare_execution(
            client.app.state.engine, issued[2], "demo-user", policy=issued[1]
        )
    assert error.value.code == "CONFLICT"
    assert persisted(database) == before
    assert count_events(database, "EXECUTION_LEDGER_APPLIED") == 1
    assert count_events(database, "EXECUTION_LEDGER_REVERSED") == 0
    assert len(sign_calls) == len(transport.sent) == 1
    assert_consumed(database, chain[0].id)


@pytest.mark.parametrize("failure", ["EXECUTION_LEDGER_REVERSED", "EXECUTION_RECONCILED"])
def test_recovery_audit_failure_rolls_back_head_effect_and_execution_together(
    client, database, issued, chain, transport, sign_calls, monkeypatch, failure
):
    assert poll(client, issued, chain).status == "CONFIRMED"
    with database[1].begin() as session:
        current = read_state(session)
        append_state(session, current.snapshot.model_copy(update={
            "version": current.snapshot.version + 1, "realized_expense_minor": 500,
        }), current.snapshot.version)
    chain[1].value = None
    assert poll(client, issued, chain).error.code == "CONFLICT"
    inspected = state(database)
    before = persisted(database)
    original = reconcile.append_event

    def fail(session, **kwargs):
        if kwargs["event_type"] == failure:
            raise RuntimeError("private audit diagnostic")
        return original(session, **kwargs)

    with monkeypatch.context() as patch:
        patch.setattr(reconcile, "append_event", fail)
        with pytest.raises(DomainError) as error:
            reconcile.recover_unchanged_assets(
                client.app.state.engine, issued[2], "demo-user", policy=issued[1],
                execution_id=chain[0].id, expected_state_hash=inspected.snapshot_hash,
            )
        assert error.value.code == "UNAVAILABLE"
        assert "private" not in error.value.message
    assert persisted(database) == before
    client.app.state.engine.dispose()
    # Only the already-supported unchanged-assets operation can now succeed.
    result = reconcile.recover_unchanged_assets(
        client.app.state.engine, issued[2], "demo-user", policy=issued[1],
        execution_id=chain[0].id, expected_state_hash=inspected.snapshot_hash,
    )
    assert result.status == "REORGED" and result.error is None
    assert state(database).snapshot.realized_expense_minor == 500
    assert count_events(database, "EXECUTION_LEDGER_REVERSED") == 1
    assert len(sign_calls) == len(transport.sent) == 1
    assert_consumed(database, chain[0].id)
