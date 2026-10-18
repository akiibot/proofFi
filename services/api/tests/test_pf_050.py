"""Read-only persisted execution observations; isolated records, never live receipt evidence."""

import pytest
from app.db.models import AuditRecord, ExecutionRecord, FinancialStateRecord, User
from app.models.contracts import Execution
from sqlalchemy import func, select
from test_pf_014_signing import issued as issued
from test_pf_029 import action as action
from test_pf_029 import configured as configured
from test_pf_029 import rpc as rpc


@pytest.fixture
def observation(database, issued):
    value = Execution(
        id="execution-isolated-read", certificate_id=issued[0]["payload"]["id"], status="PENDING",
        tx_hash="0x" + "ab" * 32, block_number=100, confirmations=1, error=None,
    )
    with database[1].begin() as session:
        session.add(ExecutionRecord(
            id=value.id, certificate_id=value.certificate_id, idempotency_key="private-test-request-identity",
            status=value.status, tx_hash=value.tx_hash, payload=value.model_dump(mode="json"),
        ))
    return value


def snapshot(database):
    with database[1]() as session:
        return (
            session.scalar(select(func.count()).select_from(AuditRecord)),
            [(s.id, s.snapshot_hash) for s in session.scalars(select(FinancialStateRecord))],
            [(e.id, e.status, e.payload) for e in session.scalars(select(ExecutionRecord))],
        )


@pytest.mark.parametrize("status", ["CLAIMED", "PENDING", "CONFIRMED", "FAILED", "REORGED"])
def test_read_returns_exact_persisted_status_without_any_mutation(
    client, database, observation, status, monkeypatch
):
    # Reading must work without enabling execution, valid signer configuration or a live RPC.
    monkeypatch.setenv("EXECUTION_ENABLED", "false")
    monkeypatch.setenv("RPC_URL", "PRIVATE_invalid_rpc")
    monkeypatch.setenv("SIGNER_PRIVATE_KEY", "PRIVATE_invalid_signer")
    expected = observation.model_copy(update={
        "status": status, "tx_hash": None if status == "CLAIMED" else observation.tx_hash,
        "confirmations": 2 if status == "CONFIRMED" else 0,
        "block_number": None if status == "CLAIMED" else observation.block_number,
    })
    with database[1].begin() as session:
        row = session.get(ExecutionRecord, observation.id)
        row.status, row.tx_hash, row.payload = expected.status, expected.tx_hash, expected.model_dump(mode="json")
    before = snapshot(database)
    response = client.get("/executions/" + observation.id)
    assert response.status_code == 200, response.text
    assert response.json() == expected.model_dump(mode="json")
    assert "private-test-request-identity" not in response.text and "PRIVATE_" not in response.text
    assert snapshot(database) == before


def test_read_requires_session_and_does_not_disclose_absent_ids(client, observation):
    assert client.get("/executions/missing-execution").status_code == 409
    client.cookies.clear()
    assert client.get("/executions/" + observation.id).status_code == 401


def test_read_checks_ownership_through_certificate_state(client, database, observation, issued):
    with database[1].begin() as session:
        session.add(User(id="other-user", display_name="Isolated other owner"))
        session.flush()
        from app.db.models import CertificateRecord
        cert = session.get(CertificateRecord, observation.certificate_id)
        state = session.get(FinancialStateRecord, cert.state_id)
        state.user_id = "other-user"
    response = client.get("/executions/" + observation.id)
    assert response.status_code == 409
    assert response.json()["message"] == "Execution not found for this user"


def test_corrupt_record_refuses_without_echoing_payload(client, database, observation):
    with database[1].begin() as session:
        row = session.get(ExecutionRecord, observation.id)
        row.payload = {**row.payload, "id": "PRIVATE_wrong_identity"}
    response = client.get("/executions/" + observation.id)
    assert response.status_code == 503
    assert "PRIVATE_" not in response.text


def test_read_id_is_bounded_and_mutation_route_is_not_added(client):
    assert client.get("/executions/" + "a" * 101).status_code == 422
    assert client.post("/executions/missing-execution", json={}).status_code == 405
