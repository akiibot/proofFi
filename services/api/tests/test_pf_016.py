"""Internal workflow: real planner/risk/optimizer/crypto/DB; isolated RPC only.

Funded finances and zero-risk assumptions are labeled test fixtures, not runtime
configuration or live execution evidence.
"""

import pytest
from app.core.errors import DomainError
from app.db.models import ApprovalRecord, CertificateRecord, ExecutionRecord
from app.models.contracts import IntentRequest
from app.optimizer.service import ChainBounds
from sqlalchemy import func, select
from test_pf_029 import action as action
from test_pf_029 import configured as configured
from test_pf_029 import rpc as rpc


@pytest.fixture
def workflow_ready(configured, rpc, monkeypatch):
    from app.workflows import service

    monkeypatch.setenv("PLANNER_MODE", "deterministic_demo")
    monkeypatch.setenv("DEMO_MODE", "true")
    monkeypatch.setenv("TEST_TOKEN_ADDRESS", configured[1]["token_address"])
    monkeypatch.setenv("APPROVED_RECIPIENT", configured[1]["recipient"])
    monkeypatch.setattr(
        service, "load_chain_bounds", lambda _: ChainBounds(2000000, 10000000, 100000, 10)
    )
    return service


def run(client, service, goal="Invest as much as possible while protecting tuition."):
    return service.prepare_goal(client.app.state.engine, IntentRequest(goal=goal), "demo-user")


def test_internal_goal_links_real_optimized_action_certificate_and_audit(
    client, database, workflow_ready
):
    result = run(client, workflow_ready)
    assert result.optimization.status == "SAFE_ACTION"
    assert result.verification.certificate_id is not None
    assert result.verification.action_id == result.optimization.action.id
    with database[1]() as session:
        cert = session.get(CertificateRecord, result.verification.certificate_id)
        assert cert.payload["payload"]["action"] == result.optimization.action.model_dump(
            mode="json"
        )
        assert session.scalar(select(func.count()).select_from(ApprovalRecord)) == 0
        assert session.scalar(select(func.count()).select_from(ExecutionRecord)) == 0
    events = client.get("/audit").json()
    completed = [e for e in events if e["event_type"] == "WORKFLOW_PREPARED"]
    assert len(completed) == 1
    assert completed[0]["details"]["certificate_id"] == result.verification.certificate_id
    assert completed[0]["details"]["verification_id"] == result.verification.id
    assert client.post("/workflows/goal", json={"goal": "Invest safely"}).status_code == 501


def test_ambiguous_goal_does_not_create_certificate(client, database, workflow_ready):
    with pytest.raises(DomainError):
        run(client, workflow_ready, "Buy an airplane")
    with database[1]() as session:
        assert session.scalar(select(func.count()).select_from(CertificateRecord)) == 0


def test_original_shortfall_returns_honest_no_safe_action(client, database, workflow_ready):
    from app.db.state import append_state, read_state

    with database[1].begin() as session:
        current = read_state(session)
        assets = [a.model_copy(update={"amount_minor": 1200000}) for a in current.snapshot.assets]
        append_state(
            session,
            current.snapshot.model_copy(
                update={"version": current.snapshot.version + 1, "assets": assets}
            ),
            current.snapshot.version,
        )
    result = run(client, workflow_ready)
    assert result.optimization.status == "NO_SAFE_ACTION"
    assert result.optimization.max_amount_minor == 0 and result.verification is None
    with database[1]() as session:
        assert session.scalar(select(func.count()).select_from(CertificateRecord)) == 0


def test_changed_state_during_planner_refuses_workflow(
    client, database, workflow_ready, monkeypatch
):
    from app.db.state import append_state, read_state

    original = workflow_ready.plan

    def changed(*args, **kwargs):
        result = original(*args, **kwargs)
        with database[1].begin() as session:
            state = read_state(session)
            append_state(
                session,
                state.snapshot.model_copy(update={"version": state.snapshot.version + 1}),
                state.snapshot.version,
            )
        return result

    monkeypatch.setattr(workflow_ready, "plan", changed)
    with pytest.raises(DomainError) as failure:
        run(client, workflow_ready)
    assert failure.value.code == "STALE_STATE"


def test_state_change_after_verification_does_not_claim_prepared_workflow(
    client, database, workflow_ready, monkeypatch
):
    from app.db.state import append_state, read_state

    original = workflow_ready.verify_action

    def changed(*args, **kwargs):
        result = original(*args, **kwargs)
        with database[1].begin() as session:
            current = read_state(session)
            append_state(
                session,
                current.snapshot.model_copy(update={"version": current.snapshot.version + 1}),
                current.snapshot.version,
            )
        return result

    monkeypatch.setattr(workflow_ready, "verify_action", changed)
    with pytest.raises(DomainError) as failure:
        run(client, workflow_ready)
    assert failure.value.code == "STALE_STATE"
    assert not [e for e in client.get("/audit").json() if e["event_type"] == "WORKFLOW_PREPARED"]
    with database[1]() as session:
        # Genuine issuance may precede the race; it is historical evidence, not rolled back or claimed current.
        assert session.scalar(select(func.count()).select_from(CertificateRecord)) == 1
        assert session.scalar(select(func.count()).select_from(ExecutionRecord)) == 0


def test_configuration_change_refuses_completion(client, database, workflow_ready, monkeypatch):
    from app.db.models import SimulationConfigRecord

    original = workflow_ready.verify_action

    def changed(*args, **kwargs):
        result = original(*args, **kwargs)
        with database[1].begin() as session:
            session.add(
                SimulationConfigRecord(
                    id="second-workflow-config", config_digest="f" * 64, payload={}
                )
            )
        return result

    monkeypatch.setattr(workflow_ready, "verify_action", changed)
    with pytest.raises(DomainError):
        run(client, workflow_ready)
    assert not [e for e in client.get("/audit").json() if e["event_type"] == "WORKFLOW_PREPARED"]


def test_audit_failure_never_returns_completed_workflow(
    client, database, workflow_ready, monkeypatch
):
    original = workflow_ready.append_event

    def fail(session, **kwargs):
        if kwargs["event_type"] == "WORKFLOW_PREPARED":
            raise RuntimeError("SECRET event detail")
        return original(session, **kwargs)

    monkeypatch.setattr(workflow_ready, "append_event", fail)
    with pytest.raises(DomainError) as failure:
        run(client, workflow_ready)
    assert "SECRET" not in failure.value.message
    assert not [e for e in client.get("/audit").json() if e["event_type"] == "WORKFLOW_PREPARED"]
    with database[1]() as session:
        assert session.scalar(select(func.count()).select_from(ApprovalRecord)) == 0
        assert session.scalar(select(func.count()).select_from(ExecutionRecord)) == 0


def test_corrupt_old_audit_prevents_any_workflow_append(client, database, workflow_ready):
    from app.db.models import AuditRecord

    with database[1].begin() as session:
        row = session.scalar(select(AuditRecord).order_by(AuditRecord.sequence))
        row.payload = {**row.payload, "actor": "corrupted"}
        count = session.scalar(select(func.count()).select_from(AuditRecord))
    with pytest.raises(DomainError):
        run(client, workflow_ready)
    with database[1]() as session:
        assert session.scalar(select(func.count()).select_from(AuditRecord)) == count
        assert session.scalar(select(func.count()).select_from(CertificateRecord)) == 0


def test_intervening_config_change_cannot_hide_by_restoring_current_config(
    client, database, workflow_ready, monkeypatch
):
    from app.core.canonical import digest
    from app.db.models import SimulationConfigRecord
    from app.models.contracts import SimulationConfig

    original = workflow_ready.verify_action

    def changed_then_restored(*args, **kwargs):
        with database[1].begin() as session:
            row = session.scalar(select(SimulationConfigRecord))
            saved = row.payload.copy()
            saved_digest = row.config_digest
            config = SimulationConfig.model_validate(row.payload)
            altered = config.model_copy(
                update={
                    "model_assumptions": [
                        *config.model_assumptions,
                        "ISOLATED intervening config race",
                    ]
                }
            )
            row.payload = altered.model_dump(mode="json")
            row.config_digest = digest(altered)
        try:
            return original(*args, **kwargs)
        finally:
            with database[1].begin() as session:
                row = session.scalar(select(SimulationConfigRecord))
                row.payload = saved
                row.config_digest = saved_digest

    monkeypatch.setattr(workflow_ready, "verify_action", changed_then_restored)
    with pytest.raises(DomainError):
        run(client, workflow_ready)
    assert not [e for e in client.get("/audit").json() if e["event_type"] == "WORKFLOW_PREPARED"]
