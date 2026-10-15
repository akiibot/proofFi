"""Hash-linked event append. Caller owns a serialized trusted-write transaction.

All single-user writers must hold the user-head lock (or SQLite writer lock).
This records domain evidence; it is not administrator-proof immutable storage.
"""

from datetime import datetime
from uuid import uuid4

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.canonical import digest
from app.core.errors import DomainError
from app.db.models import AuditRecord
from app.models.contracts import AuditEvent, ErrorCode


def append_event(
    session: Session,
    *,
    actor: str,
    event_type: str,
    artifact_digest: str,
    details: dict,
    now: datetime,
) -> AuditEvent:
    previous = session.scalar(
        select(AuditRecord).order_by(AuditRecord.sequence.desc()).limit(1).with_for_update()
    )
    if previous is not None:
        try:
            parsed = AuditEvent.model_validate(previous.payload)
            if (parsed.id, parsed.sequence, parsed.event_hash, parsed.previous_hash) != (
                previous.id,
                previous.sequence,
                previous.event_hash,
                previous.previous_hash,
            ) or digest(
                parsed.model_dump(mode="json", exclude={"event_hash"})
            ) != parsed.event_hash:
                raise ValueError("Audit head binding mismatch")
        except (ValueError, ValidationError):
            raise DomainError(
                ErrorCode.UNAVAILABLE, "Audit head integrity check failed; no decision recorded"
            ) from None
    unsigned = dict(
        id="audit-" + str(uuid4()),
        sequence=previous.sequence + 1 if previous else 1,
        created_at=now.isoformat().replace("+00:00", "Z"),
        event_type=event_type,
        actor=actor,
        artifact_digest=artifact_digest,
        details=details,
        previous_hash=previous.event_hash if previous else None,
    )
    event = AuditEvent.model_validate({**unsigned, "event_hash": digest(unsigned)})
    session.add(
        AuditRecord(
            id=event.id,
            created_at=now,
            sequence=event.sequence,
            previous_hash=event.previous_hash,
            event_hash=event.event_hash,
            payload=event.model_dump(mode="json"),
        )
    )
    session.flush()
    return event
