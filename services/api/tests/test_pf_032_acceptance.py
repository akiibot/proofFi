"""Risk acceptance contribution: actual routes/DB/engines/crypto, fixture RPC only."""

from app.optimizer import router as optimizer_router
from test_pf_010 import bounds as bounds
from test_pf_029 import action as action
from test_pf_029 import configured as configured
from test_pf_029 import rpc as rpc
from test_pf_032_routes import operational_settings as operational_settings


def test_optimizer_maximum_is_independently_certified_and_next_cent_denied(
    client, configured, rpc, action, bounds, monkeypatch
):
    monkeypatch.setattr(optimizer_router, "load_chain_bounds", lambda _: bounds)
    result = client.post("/optimize", json={"action": action})
    assert result.status_code == 200
    optimum = result.json()
    assert optimum["status"] == "SAFE_ACTION" and optimum["max_amount_minor"] == 275000
    assert optimum["next_cent_rejected"]
    approved = client.post("/verify", json={"action": optimum["action"]})
    assert approved.status_code == 200
    verification = approved.json()
    assert verification["verdict"]["decision"] == "REQUIRES_APPROVAL"
    cert_id = verification["certificate_id"]
    assert cert_id
    cert = client.get("/certificates/" + cert_id).json()
    assert cert["payload"]["action"]["amount_minor"] == optimum["max_amount_minor"]
    assert cert["payload"]["approval"]["required"]
    assert (
        client.post("/certificates/" + cert_id + "/verify").json()["status"] == "APPROVAL_REQUIRED"
    )
    next_action = {
        **optimum["action"],
        "id": "next-cent-acceptance",
        "amount_minor": optimum["max_amount_minor"] + 1,
    }
    rejected = client.post("/verify", json={"action": next_action})
    assert rejected.status_code == 200
    assert rejected.json()["verdict"]["decision"] == "DENY"
    assert rejected.json()["certificate_id"] is None
    assert "HIGH_RISK_CONCENTRATION_EXCEEDED" in rejected.json()["reasons"]
    events = client.get("/audit").json()
    assert any(
        e["event_type"] == "CERTIFICATE_ISSUED" and e["details"]["certificate_id"] == cert_id
        for e in events
    )


def test_emergency_reduces_maximum_and_rejects_old_authorization(
    client, database, configured, rpc, action, bounds, monkeypatch
):
    import pytest
    from app.core.errors import DomainError
    from app.demo import emergency
    from app.execution.gate import claim_execution
    from app.execution.signer import TestnetPolicy
    from app.models.contracts import ErrorCode, ExecuteRequest
    from app.verifier.service import recompute

    monkeypatch.setattr(optimizer_router, "load_chain_bounds", lambda _: bounds)
    monkeypatch.setattr(emergency, "load_chain_bounds", lambda _: bounds)
    before = client.post("/optimize", json={"action": action}).json()
    assert before["max_amount_minor"] == 275000
    verified = client.post("/verify", json={"action": before["action"]})
    assert verified.status_code == 200
    cert_id = verified.json()["certificate_id"]
    cert = client.get("/certificates/" + cert_id).json()
    response = client.post("/demo/emergency", json={"expected_state_version": 2})
    assert response.status_code == 200
    fresh = response.json()
    assert fresh["optimization"]["max_amount_minor"] == 225000
    assert fresh["optimization"]["next_cent_rejected"]
    assert fresh["state"]["snapshot"]["version"] == 3
    assert fresh["state"]["snapshot"]["realized_expense_minor"] == 200000
    assert client.get("/certificates/" + cert_id).json() == cert
    assert (
        client.post("/certificates/" + cert_id + "/verify").json()["status"] == "SIGNED_BUT_STALE"
    )
    t = cert["payload"]["transaction"]
    with pytest.raises(DomainError) as exc:
        claim_execution(
            client.app.state.engine,
            ExecuteRequest(
                certificate_id=cert_id,
                action_digest=cert["payload"]["action_digest"],
                idempotency_key="acceptance-emergency-stale",
            ),
            "demo-user",
            policy=TestnetPolicy(
                wallet_address=t["sender"],
                token_address=t["token_address"],
                recipient=t["recipient"],
                token_decimals=t["token_decimals"],
                max_gas_limit=t["gas_limit"],
                max_fee_per_gas_wei=t["max_fee_per_gas_wei"],
            ),
            recheck=recompute,
        )
    assert exc.value.code == ErrorCode.STALE_STATE
    events = client.get("/audit").json()
    event = next(e for e in events if e["event_type"] == "EMERGENCY_EXPENSE_RECORDED")
    assert event["details"]["state_id"] == fresh["state"]["id"]
    assert event["details"]["previous_state_version"] == cert["payload"]["state_version"]


def test_emergency_dependency_failure_preserves_all_authority(
    client, database, configured, rpc, action, bounds, monkeypatch
):
    from app.core.errors import DomainError
    from app.demo import emergency
    from app.models.contracts import ErrorCode

    response = client.post("/verify", json={"action": action})
    assert response.status_code == 200
    cert_id = response.json()["certificate_id"]
    state = client.get("/financial-state").json()
    audit = client.get("/audit").json()
    certificate = client.get("/certificates/" + cert_id).json()

    def unavailable(_):
        raise DomainError(ErrorCode.UNAVAILABLE, "Chain unavailable")

    monkeypatch.setattr(emergency, "load_chain_bounds", unavailable)
    assert client.post("/demo/emergency", json={"expected_state_version": 2}).status_code == 503
    assert client.get("/financial-state").json() == state
    assert client.get("/audit").json() == audit
    assert client.get("/certificates/" + cert_id).json() == certificate
    assert client.post("/certificates/" + cert_id + "/verify").json()["status"] == "VALID"
