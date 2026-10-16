"""Real emergency and durable execution integration; no live send evidence."""

import pytest
from app.core.errors import DomainError
from app.db.models import ExecutionEnvelopeRecord, ExecutionRecord
from app.demo import emergency
from app.execution import service
from app.models.contracts import ErrorCode
from sqlalchemy import select
from test_pf_010 import bounds as bounds
from test_pf_014_signing import issued as issued
from test_pf_014_signing import sign_calls as sign_calls
from test_pf_015 import broadcast, prepare
from test_pf_015 import transport as transport
from test_pf_029 import action as action
from test_pf_029 import configured as configured
from test_pf_029 import rpc as rpc
from test_pf_032_routes import operational_settings as operational_settings


def test_emergency_after_signed_handoff_prevents_dispatch_and_resigning(
    client, database, issued, transport, sign_calls, bounds, monkeypatch
):
    monkeypatch.setattr(emergency, "load_chain_bounds", lambda _: bounds)
    execution = prepare(client, issued)
    certificate, _, request = issued
    certificate_id = certificate["payload"]["id"]
    with database[1]() as session:
        envelope = session.scalar(select(ExecutionEnvelopeRecord))
        original_raw = envelope.raw_transaction
        original_hash = envelope.transaction_hash
    assert len(sign_calls) == 1 and transport.sent == []

    response = client.post(
        "/demo/emergency",
        json={"expected_state_version": certificate["payload"]["state_version"]},
    )
    assert response.status_code == 200
    with pytest.raises(DomainError) as failure:
        broadcast(client, issued, execution)
    assert failure.value.code == ErrorCode.STALE_STATE
    with pytest.raises(DomainError):
        service.prepare_execution(client.app.state.engine, request, "demo-user", policy=issued[1])
    assert len(sign_calls) == 1 and transport.sent == []
    with database[1]() as session:
        stored = session.get(ExecutionRecord, execution.id)
        assert stored.status == "CLAIMED" and stored.tx_hash is None
        envelope = session.scalar(select(ExecutionEnvelopeRecord))
        assert envelope.execution_id == execution.id
        assert envelope.raw_transaction == original_raw
        assert envelope.transaction_hash == original_hash
    assert client.get("/certificates/" + certificate_id).json() == certificate
    assert (
        client.post("/certificates/" + certificate_id + "/verify").json()["status"]
        == "SIGNED_BUT_STALE"
    )
    events = client.get("/audit").json()
    assert any(e["event_type"] == "EXECUTION_ENVELOPE_STORED" for e in events)
    assert any(e["event_type"] == "EMERGENCY_EXPENSE_RECORDED" for e in events)
    assert not any(e["event_type"] == "EXECUTION_DISPATCH_RESERVED" for e in events)
