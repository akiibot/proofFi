"""Actual demo/verifier/executor/audit; synthetic config in an isolated test DB only."""

import pytest
from app.core.canonical import digest
from app.db.models import (
    ApprovalRecord,
    AuditRecord,
    CandidateRecord,
    CertificateRecord,
    ExecutionEnvelopeRecord,
    ExecutionRecord,
)
from app.execution.signer import LocalTestnetSigner
from app.models.contracts import AttackResponse
from sqlalchemy import func, select
from test_pf_029 import configured as configured


def counts(database):
    with database[1]() as session:
        return [session.scalar(select(func.count()).select_from(model)) for model in (
            ApprovalRecord, CertificateRecord, ExecutionRecord, ExecutionEnvelopeRecord
        )]


@pytest.fixture
def forbid_signer(monkeypatch):
    def forbidden(*args, **kwargs):
        pytest.fail("Attack demonstration reached the signer")
    monkeypatch.setattr(LocalTestnetSigner, "from_environment", forbidden)
    monkeypatch.setattr(LocalTestnetSigner, "sign", forbidden)


def test_real_unsafe_candidate_verifier_executor_and_audit(client, database, configured, forbid_signer):
    before = counts(database)
    response = client.post("/demo/attack")
    assert response.status_code == 200, response.text
    result = AttackResponse.model_validate(response.json())
    assert result.candidate.amount_minor == 400000
    assert result.candidate.funding_source == "borrowed"
    assert result.candidate.planner_mode == "attack_fixture"
    assert result.verification.verdict.decision == "DENY"
    assert result.verification.certificate_id is None
    assert any(c.rule == "funding_source" and c.status == "FAIL" for c in result.verification.verdict.checks)
    assert result.execution_error.code == "INVALID_CERTIFICATE"
    assert result.execution_error.message == "Certificate not found"
    assert result.signer_called is False and result.tx_hash is None
    assert counts(database) == before
    with database[1]() as session:
        candidate = session.get(CandidateRecord, result.candidate.id)
        assert candidate.action_digest == digest(result.candidate)
        events = [r.payload for r in session.scalars(select(AuditRecord).order_by(AuditRecord.sequence))]
    rejected = next(e for e in events if e["event_type"] == "ACTION_REJECTED")
    attack = events[-1]
    assert attack["event_type"] == "ATTACK_EXECUTOR_REJECTED"
    assert attack["artifact_digest"] == digest(result)
    assert attack["details"]["action_id"] == rejected["details"]["action_id"] == result.candidate.id
    assert attack["details"]["verification_id"] == result.verification.id
    assert attack["details"]["attempted_unissued_certificate_id"].startswith("unissued-attack-")


def test_attack_repeat_is_fresh_proposal_not_authority(client, database, configured, forbid_signer):
    first = client.post("/demo/attack").json()
    second = client.post("/demo/attack").json()
    assert first["candidate"]["id"] != second["candidate"]["id"]
    assert counts(database) == [0, 0, 0, 0]


@pytest.mark.parametrize("failure", ["session", "csrf", "demo", "body"])
def test_attack_boundary_refuses_before_artifacts(client, database, configured, forbid_signer, failure):
    if failure == "session":
        client.cookies.clear()
    elif failure == "csrf":
        client.headers.pop("X-CSRF-Token")
    elif failure == "demo":
        client.app.state.auth.settings.demo_mode = False
    response = client.post("/demo/attack", **({"json": {"amount_minor": 1}} if failure == "body" else {}))
    assert response.status_code == {"session": 401, "csrf": 403, "demo": 403, "body": 422}[failure]
    assert counts(database) == [0, 0, 0, 0]
    with database[1]() as session:
        assert session.scalar(select(func.count()).select_from(CandidateRecord)) == 0


def test_attack_missing_confirmed_policy_is_honest(client, database, forbid_signer, monkeypatch):
    # Operational configuration alone cannot substitute for confirmed financial authority.
    import json

    from test_pf_029 import RECIPIENT, TOKEN, WALLET
    monkeypatch.setenv("RPC_URL", "http://isolated.invalid")
    monkeypatch.setenv("VERIFIER_TRANSACTION_CONFIG_JSON", json.dumps(dict(
        wallet_address=WALLET, token_address=TOKEN, recipient=RECIPIENT,
        token_decimals=6, gas_limit=100000, max_fee_per_gas_wei="100",
        max_priority_fee_per_gas_wei="1",
    )))
    response = client.post("/demo/attack")
    assert response.status_code == 503
    assert response.json()["message"] == "Confirmed Constitution required"
    assert counts(database) == [0, 0, 0, 0]


def test_attack_invalid_operational_settings_are_sanitized(client, database, configured, monkeypatch):
    monkeypatch.setenv("VERIFIER_TRANSACTION_CONFIG_JSON", "PRIVATE_INVALID_CONFIGURATION")
    response = client.post("/demo/attack")
    assert response.status_code == 503
    assert response.json()["code"] == "CHAIN_NOT_CONFIGURED"
    assert "PRIVATE_INVALID_CONFIGURATION" not in response.text
    assert counts(database) == [0, 0, 0, 0]


def test_attack_executor_unavailable_is_not_reported_as_success(client, database, configured, monkeypatch):
    from app.core.errors import DomainError
    from app.demo import attack
    from app.models.contracts import ErrorCode
    def unavailable(*args, **kwargs):
        raise DomainError(ErrorCode.UNAVAILABLE, "Executor unavailable")
    monkeypatch.setattr(attack, "claim_execution", unavailable)
    response = client.post("/demo/attack")
    assert response.status_code == 503
    assert response.json()["message"] == "Executor unavailable"
    assert counts(database) == [0, 0, 0, 0]
    with database[1]() as session:
        assert all(r.payload["event_type"] != "ATTACK_EXECUTOR_REJECTED" for r in session.scalars(select(AuditRecord)))
