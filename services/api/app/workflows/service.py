"""Internal goal preparation only; no consent, EVM signer or execution import.

Planner and verifier own their independent boundaries. Stages may leave genuine
verified artifacts if a later stage fails; this is not an atomic financial action.
Public workflow/execute routes remain disabled pending full integration gates.
"""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.append import append_event
from app.core.canonical import digest
from app.core.errors import DomainError
from app.db.models import AuditRecord, CertificateRecord, SimulationRecord, VerificationRecord
from app.db.state import read_state
from app.models.contracts import (
    ActionCertificate,
    ActionRequest,
    AuditEvent,
    ErrorCode,
    IntentRequest,
    PlanResponse,
    SimulationRun,
    VerificationResult,
    WorkflowResult,
)
from app.optimizer.chain import load_chain_bounds
from app.optimizer.service import optimize
from app.planner.service import plan
from app.verifier.certificates import public_keys_from_environment, verify_integrity
from app.verifier.service import load_trusted, verify_action


def _checked_audit(session):
    previous = None
    for sequence, row in enumerate(
        session.scalars(select(AuditRecord).order_by(AuditRecord.sequence)), 1
    ):
        event = AuditEvent.model_validate(row.payload)
        if (
            row.id != event.id
            or row.sequence != sequence
            or event.sequence != sequence
            or row.previous_hash != previous
            or event.previous_hash != previous
            or row.event_hash != event.event_hash
            or digest(event.model_dump(mode="json", exclude={"event_hash"})) != event.event_hash
        ):
            raise DomainError(ErrorCode.UNAVAILABLE, "Workflow audit chain integrity failed")
        previous = event.event_hash


def _same_head(session, actor, original):
    current = read_state(session, actor)
    if (current.id, current.snapshot_hash) != (original.id, original.snapshot_hash):
        raise DomainError(
            ErrorCode.STALE_STATE, "Workflow financial state changed; prepare a new goal", 409
        )
    if current.active_constitution_version != original.active_constitution_version:
        raise DomainError(
            ErrorCode.STALE_POLICY, "Workflow policy changed; prepare a new goal", 409
        )
    return current


def prepare_goal(engine, body: IntentRequest, actor_id: str) -> WorkflowResult:
    """Prepare a real optimized proposal/certificate, never fabricate human consent.

    Clarification refuses before issuance. NO_SAFE_ACTION is the real optimizer
    result. A concurrent state/policy/config change cannot be represented as a
    completed workflow. Untrusted planner candidates are not safety evidence.
    """
    body = IntentRequest.model_validate_json(body.model_dump_json())
    if engine.dialect.name != "sqlite":
        raise DomainError(ErrorCode.UNAVAILABLE, "Workflow preparation supports SQLite only")
    workflow_id = "workflow-" + str(uuid4())
    try:
        with Session(engine) as session:
            original = read_state(session, actor_id)
        proposal = PlanResponse.model_validate_json(
            plan(engine, actor_id, body.goal).model_dump_json()
        )
        if proposal.clarification or not proposal.candidates:
            raise DomainError(
                ErrorCode.CONFLICT, "Goal requires clarification before workflow preparation", 409
            )
        candidate = proposal.candidates[0]
        with Session(engine) as session, session.begin():
            session.connection().exec_driver_sql("BEGIN IMMEDIATE")
            _same_head(session, actor_id, original)
            _checked_audit(session)
            trusted = load_trusted(session, candidate, actor_id)
            optimization = optimize(trusted, load_chain_bounds(candidate))
            append_event(
                session,
                actor=actor_id,
                event_type="WORKFLOW_OPTIMIZED",
                artifact_digest=digest(optimization),
                now=datetime.now(UTC),
                details={
                    "workflow_id": workflow_id,
                    "state_id": original.id,
                    "state_hash": original.snapshot_hash,
                    "policy_id": trusted.constitution.id,
                    "config_digest": digest(trusted.config),
                    "goal_digest": digest(body),
                    "plan_digest": digest(proposal),
                    "action_id": optimization.action.id if optimization.action else "",
                    "status": optimization.status,
                },
            )
        verification = None
        if optimization.status == "SAFE_ACTION":
            if optimization.action is None:
                raise ValueError("Safe optimizer result missing action")
            # Independently reloads authority and recomputes risk; never accepts
            # planner/optimizer verdicts as issuance authority.
            verification = verify_action(
                engine, ActionRequest(action=optimization.action), actor_id
            )
        result = WorkflowResult(plan=proposal, optimization=optimization, verification=verification)
        with Session(engine) as session, session.begin():
            session.connection().exec_driver_sql("BEGIN IMMEDIATE")
            _same_head(session, actor_id, original)
            _checked_audit(session)
            # Configuration selection/digest must still match the optimization.
            fresh = load_trusted(session, optimization.action or candidate, actor_id)
            if fresh.constitution.policy_digest != trusted.constitution.policy_digest:
                raise DomainError(ErrorCode.STALE_POLICY, "Workflow policy content changed", 409)
            if digest(fresh.config) != digest(trusted.config):
                raise DomainError(
                    ErrorCode.CONFLICT, "Workflow simulation configuration changed", 409
                )
            if verification is not None:
                stored_verification = session.get(VerificationRecord, verification.id)
                stored_simulation = session.get(SimulationRecord, verification.simulation_id)
                simulation = SimulationRun.model_validate(stored_simulation.payload)
                if (
                    VerificationResult.model_validate(stored_verification.payload) != verification
                    or stored_verification.action_id != optimization.action.id
                    or stored_verification.constitution_id != trusted.constitution.id
                    or stored_verification.simulation_id != simulation.id
                    or stored_simulation.id != simulation.id
                    or stored_simulation.action_id != optimization.action.id
                    or stored_simulation.state_id != original.id
                    or stored_simulation.config_id != trusted.config.id
                    or simulation.action_id != optimization.action.id
                    or simulation.state_snapshot_hash != original.snapshot_hash
                    or simulation.config != trusted.config
                    or simulation.config_digest != digest(trusted.config)
                ):
                    raise ValueError("Workflow verification/simulation evidence mismatch")
            if verification is not None and verification.certificate_id is not None:
                cert = session.get(CertificateRecord, verification.certificate_id)
                signed = ActionCertificate.model_validate(cert.payload)
                if verify_integrity(signed, public_keys_from_environment()).status != "VALID":
                    raise ValueError("Workflow certificate integrity/time mismatch")
                if (
                    signed.payload.simulation != simulation
                    or signed.payload.policy_digest != trusted.constitution.policy_digest
                    or signed.payload.action != optimization.action
                    or signed.payload.state_snapshot_hash != original.snapshot_hash
                    or signed.payload.verdict != verification.verdict
                    or signed.payload.id != verification.certificate_id
                    or signed.certificate_hash != cert.certificate_hash
                    or digest(signed.payload) != signed.certificate_hash
                    or cert.state_id != original.id
                    or cert.constitution_id != trusted.constitution.id
                    or cert.verification_id != verification.id
                    or cert.action_id != optimization.action.id
                ):
                    raise ValueError("Workflow certificate binding mismatch")
            append_event(
                session,
                actor=actor_id,
                event_type="WORKFLOW_PREPARED",
                artifact_digest=digest(result),
                now=datetime.now(UTC),
                details={
                    "workflow_id": workflow_id,
                    "state_id": original.id,
                    "goal_digest": digest(body),
                    "plan_digest": digest(proposal),
                    "optimization_digest": digest(optimization),
                    "action_id": optimization.action.id if optimization.action else "",
                    "verification_id": verification.id if verification else "",
                    "certificate_id": verification.certificate_id or "" if verification else "",
                },
            )
        return result
    except DomainError:
        raise
    except Exception:
        raise DomainError(
            ErrorCode.UNAVAILABLE, "Workflow preparation unavailable; no execution authorized"
        ) from None
