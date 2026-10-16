from fastapi import APIRouter, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.append import append_event
from app.core.canonical import digest
from app.core.errors import DomainError
from app.db.models import (
    AuditRecord,
    CandidateRecord,
    ConstitutionVersionRecord,
    FinancialStateRecord,
    SimulationConfigRecord,
    SimulationRecord,
)
from app.db.state import read_state
from app.models.contracts import (
    ActionRequest,
    AuditEvent,
    ErrorCode,
    SimulationConfig,
    SimulationRun,
    TrustedSimulationInput,
)
from app.policy.service import checked_version
from app.simulation.engine import simulate

router = APIRouter()


def check_persisted_audit(session, stored, actor_id):
    previous_hash = None
    found = False
    for sequence, row in enumerate(
        session.scalars(select(AuditRecord).order_by(AuditRecord.sequence)), 1
    ):
        event = AuditEvent.model_validate(row.payload)
        if (
            (event.id, event.sequence, event.previous_hash, event.event_hash)
            != (row.id, sequence, previous_hash, row.event_hash)
            or row.sequence != sequence
            or row.previous_hash != previous_hash
            or digest(event.model_dump(mode="json", exclude={"event_hash"})) != event.event_hash
        ):
            raise ValueError("Audit chain integrity failed")
        previous_hash = event.event_hash
        if (
            event.event_type == "SIMULATION_COMPLETED"
            and event.details.get("simulation_id") == stored.id
        ):
            if found or event.actor != actor_id or event.artifact_digest != digest(stored):
                raise ValueError("Simulation audit binding failed")
            found = True
    if not found:
        raise ValueError("Simulation audit missing")


@router.post("/simulate", response_model=SimulationRun, operation_id="simulate_action")
def simulate_action(body: ActionRequest, request: Request):
    engine = request.app.state.engine
    if engine.dialect.name != "sqlite":
        raise DomainError(ErrorCode.UNAVAILABLE, "Simulation writes support SQLite only")
    with Session(engine) as session, session.begin():
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        try:
            state = read_state(session, request.state.actor_id)
            row = session.get(FinancialStateRecord, state.id)
            if (row.user_id, row.version, state.snapshot.user_id) != (
                request.state.actor_id,
                state.snapshot.version,
                request.state.actor_id,
            ):
                raise ValueError("State metadata mismatch")
            if state.active_constitution_version is None:
                raise DomainError(ErrorCode.UNAVAILABLE, "Confirmed Constitution required")
            policy = checked_version(
                session.get(ConstitutionVersionRecord, state.active_constitution_version),
                request.state.actor_id,
            )
            configs = list(session.scalars(select(SimulationConfigRecord).limit(2)))
            if len(configs) != 1:
                raise DomainError(
                    ErrorCode.UNAVAILABLE,
                    "Exactly one explicitly selected trusted simulation configuration required",
                )
            config = SimulationConfig.model_validate(configs[0].payload)
            if config.id != configs[0].id or digest(config) != configs[0].config_digest:
                raise ValueError("Config metadata mismatch")
            trusted = TrustedSimulationInput(
                state=state, constitution=policy, action=body.action, config=config
            )
            candidate = session.get(CandidateRecord, body.action.id)
            action_digest = digest(body.action)
            if candidate is not None and (
                candidate.state_id != state.id
                or candidate.action_digest != action_digest
                or candidate.payload != body.action.model_dump(mode="json")
            ):
                raise DomainError(
                    ErrorCode.CONFLICT,
                    "Candidate ID already binds different authority or action",
                    409,
                )
            result = simulate(trusted)
            identifier = "sim-" + digest(trusted)
            existing = session.get(SimulationRecord, identifier)
            if existing is not None:
                stored = SimulationRun.model_validate(existing.payload)
                if (
                    candidate is None
                    or (existing.action_id, existing.state_id, existing.config_id, stored.id)
                    != (body.action.id, state.id, config.id, identifier)
                    or stored.model_dump(exclude={"id", "created_at"})
                    != result.model_dump(exclude={"id", "created_at"})
                ):
                    raise ValueError("Stored simulation integrity failed")
                check_persisted_audit(session, stored, request.state.actor_id)
                return stored
            result = result.model_copy(update={"id": identifier})
            if candidate is None:
                session.add(
                    CandidateRecord(
                        id=body.action.id,
                        state_id=state.id,
                        action_digest=action_digest,
                        payload=body.action.model_dump(mode="json"),
                    )
                )
                session.flush()
            session.add(
                SimulationRecord(
                    id=result.id,
                    action_id=body.action.id,
                    state_id=state.id,
                    config_id=config.id,
                    payload=result.model_dump(mode="json"),
                )
            )
            session.flush()
            append_event(
                session,
                actor=request.state.actor_id,
                event_type="SIMULATION_COMPLETED",
                artifact_digest=digest(result),
                now=result.created_at,
                details={
                    "simulation_id": result.id,
                    "action_id": body.action.id,
                    "config_digest": result.config_digest,
                    "policy_digest": policy.policy_digest,
                },
            )
            return result
        except (ValueError, AttributeError, OverflowError):
            raise DomainError(
                ErrorCode.UNAVAILABLE, "Trusted simulation unavailable or integrity check failed"
            ) from None
