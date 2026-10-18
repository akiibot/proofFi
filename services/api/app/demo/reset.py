"""Append-only funded restaging before any execution; never chain recovery."""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.audit.append import append_event
from app.core.canonical import digest
from app.core.errors import DomainError
from app.core.settings import Settings
from app.db.models import (
    AuditRecord,
    ExecutionRecord,
    FinancialStateRecord,
    SimulationConfigRecord,
)
from app.db.state import append_state, read_state
from app.models.contracts import (
    AuditEvent,
    ErrorCode,
    FinancialState,
    SimulationConfig,
    StateSnapshot,
)


def funded_source(session: Session, actor: str) -> tuple[FinancialState, str]:
    """Recover the exact immutable selection, not a new or inferred cash balance."""
    events = [
        row for row in session.scalars(select(AuditRecord))
        if row.payload.get("event_type") == "SYNTHETIC_DEMO_PROVISIONED"
        and row.payload.get("actor") == actor
    ]
    configs = list(session.scalars(select(SimulationConfigRecord).limit(2)))
    if len(events) != 1 or len(configs) != 1:
        raise DomainError(
            ErrorCode.CONFLICT,
            "One recorded funded selection required; create a new isolated stage",
            409,
        )
    row = events[0]
    event = AuditEvent.model_validate(row.payload)
    if (event.id, event.sequence, event.event_hash, event.previous_hash) != (
        row.id, row.sequence, row.event_hash, row.previous_hash
    ) or digest(event.model_dump(mode="json", exclude={"event_hash"})) != event.event_hash:
        raise ValueError("Provisioning event binding failed")
    config = SimulationConfig.model_validate(configs[0].payload)
    if config.id != configs[0].id or digest(config) != configs[0].config_digest:
        raise ValueError("Configuration binding failed")
    record = session.get(FinancialStateRecord, event.details["funded_state_id"])
    original = session.get(FinancialStateRecord, event.details["original_state_id"])
    snapshot = StateSnapshot.model_validate(record.payload)
    baseline = StateSnapshot.model_validate(original.payload)
    if (
        (record.user_id, record.version, snapshot.user_id, snapshot.version)
        != (actor, 2, actor, 2)
        or (original.user_id, original.version, baseline.user_id, baseline.version)
        != (actor, 1, actor, 1)
        or digest(snapshot) != record.snapshot_hash
        or digest(baseline) != original.snapshot_hash
        or event.details["config_digest"] != digest(config)
        or event.details["constitution_confirmed"] is not False
    ):
        raise ValueError("Funded selection binding failed")
    source = FinancialState(
        id=record.id, snapshot=snapshot, snapshot_hash=record.snapshot_hash,
        active_constitution_version=None,
    )
    if event.artifact_digest != digest({
        "state": source.model_dump(mode="json"), "config": config.model_dump(mode="json")
    }):
        raise ValueError("Funded artifact binding failed")
    return source, digest(config)


def reset_demo(engine, settings: Settings, actor_id: str = "demo-user") -> FinancialState:
    if not settings.demo_mode:
        raise DomainError(ErrorCode.FORBIDDEN, "Demo reset disabled", 403)
    if engine.dialect.name != "sqlite":
        raise DomainError(ErrorCode.UNAVAILABLE, "Demo reset supports SQLite only")
    with Session(engine) as session, session.begin():
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        try:
            # Even a settled dispatch must not be followed by off-chain cash restoration.
            if session.scalar(select(ExecutionRecord.id).limit(1)) is not None:
                raise DomainError(
                    ErrorCode.CONFLICT,
                    "Execution history exists; preserve it and create a new isolated stage",
                    409,
                )
            current = read_state(session, actor_id)
            source, config_digest = funded_source(session, actor_id)
            snapshot = StateSnapshot.model_validate({
                **source.snapshot.model_dump(), "version": current.snapshot.version + 1
            })
            result = append_state(session, snapshot, current.snapshot.version)
            append_event(
                session, actor=actor_id, event_type="DEMO_RESET",
                artifact_digest=digest(result), now=datetime.now(UTC),
                details={
                    "previous_state_id": current.id, "state_id": result.id,
                    "from_state_version": current.snapshot.version,
                    "to_state_version": result.snapshot.version,
                    "funded_source_state_id": source.id, "config_digest": config_digest,
                    "policy_unchanged": True,
                },
            )
            return result
        except DomainError:
            raise
        except Exception:
            raise DomainError(
                ErrorCode.UNAVAILABLE, "Funded reset integrity/write check failed; update rolled back"
            ) from None
