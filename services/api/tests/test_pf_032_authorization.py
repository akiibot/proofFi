"""Emergency invalidation: real authority/crypto/risk, isolated test finances/RPC.

Extra cash and zero-risk settings come from temporary test fixtures only, never
an approved runtime financial configuration or a live transfer.
"""

import pytest
from app.core.errors import DomainError
from app.db.models import ApprovalRecord, CertificateRecord, ExecutionRecord
from app.demo import emergency
from app.execution import gate
from app.models.contracts import CandidateAction, EmergencyRequest, ExecuteRequest
from app.optimizer.service import ChainBounds, optimize
from app.verifier.service import load_trusted
from sqlalchemy import func, select
from test_pf_014_signing import issued as issued
from test_pf_014_signing import sign_calls as sign_calls
from test_pf_029 import action as action
from test_pf_029 import configured as configured
from test_pf_029 import rpc as rpc


@pytest.fixture
def emergency_ready(issued, monkeypatch):
    tx = issued[0]["payload"]["transaction"]
    for key, value in {
        "WALLET_ADDRESS": tx["sender"],
        "TEST_TOKEN_ADDRESS": tx["token_address"],
        "APPROVED_RECIPIENT": tx["recipient"],
        "OPTIMIZER_GAS_LIMIT": "100000",
        "OPTIMIZER_MAX_FEE_PER_GAS_WEI": "100",
    }.items():
        monkeypatch.setenv(key, value)
    bounds = ChainBounds(2000000, 10000000, 100000, 10)
    monkeypatch.setattr(emergency, "load_chain_bounds", lambda _: bounds)
    return bounds


def test_real_emergency_invalidates_existing_certificate_and_approved_action(
    client, database, issued, emergency_ready, sign_calls
):
    action = {
        **issued[0]["payload"]["action"],
        "id": "approved-before-emergency",
        "amount_minor": 20000,
    }
    verified = client.post("/verify", json={"action": action})
    assert verified.status_code == 200
    cert = client.get("/certificates/" + verified.json()["certificate_id"]).json()
    assert cert["payload"]["approval"]["required"] is True
    response = client.post(
        "/approvals",
        json={
            "certificate_id": cert["payload"]["id"],
            "action_digest": cert["payload"]["action_digest"],
            "decision": "APPROVE",
        },
    )
    assert response.status_code == 200
    with database[1]() as session:
        before_approval = session.scalar(select(ApprovalRecord)).payload.copy()
    result = emergency.record_emergency(
        client.app.state.engine,
        EmergencyRequest(expected_state_version=cert["payload"]["state_version"]),
        "demo-user",
    )
    assert result.state.snapshot.version == cert["payload"]["state_version"] + 1
    for index, old in enumerate([issued[0], cert]):
        request = ExecuteRequest(
            certificate_id=old["payload"]["id"],
            action_digest=old["payload"]["action_digest"],
            idempotency_key=f"after-emergency-stale-{index}",
        )
        with pytest.raises(DomainError) as failure:
            gate.sign_authorized_once(
                client.app.state.engine, request, "demo-user", policy=issued[1]
            )
        assert failure.value.code == "STALE_STATE"
    assert sign_calls == []
    with database[1]() as session:
        assert session.scalar(select(func.count()).select_from(ExecutionRecord)) == 0
        assert session.get(CertificateRecord, cert["payload"]["id"]).payload == cert
        approval = session.scalar(select(ApprovalRecord))
        assert approval.payload == before_approval and approval.consumed_at is None


def test_positive_repricing_uses_real_optimizer_and_is_not_financial_approval(
    client, database, issued, emergency_ready, sign_calls
):
    with database[1]() as session:
        trusted = load_trusted(
            session, CandidateAction.model_validate(issued[0]["payload"]["action"]), "demo-user"
        )
        before = optimize(trusted, emergency_ready)
    result = emergency.record_emergency(
        client.app.state.engine,
        EmergencyRequest(expected_state_version=issued[0]["payload"]["state_version"]),
        "demo-user",
    )
    assert before.status == result.optimization.status == "SAFE_ACTION"
    assert 0 < result.optimization.max_amount_minor < before.max_amount_minor
    assert result.optimization.next_cent_rejected is True
    assert result.state.snapshot.realized_expense_minor == 200000
    assert result.state.snapshot.expected_income == []
    assert sign_calls == []
    assert (
        client.post(
            "/demo/emergency", json={"expected_state_version": result.state.snapshot.version}
        ).status_code
        == 501
    )
