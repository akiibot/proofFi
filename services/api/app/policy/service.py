"""Explicit Constitution lifecycle; drafts never grant execution authority."""

from datetime import UTC, datetime
from uuid import uuid4

from pydantic import ValidationError
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit.append import append_event
from app.core.canonical import digest
from app.core.errors import DomainError
from app.db.models import ConstitutionDraftRecord, ConstitutionVersionRecord, UserHead
from app.db.postgres import acquire_authority_lock
from app.models.contracts import (
    ConfirmRequest,
    ConstitutionDraft,
    ConstitutionVersion,
    DraftRequest,
    ErrorCode,
)

LABELS = {
    "tuition_reserve_minor": "Tuition reserve (USD cents)",
    "emergency_floor_minor": "Emergency floor (USD cents)",
    "autonomy_limit_minor": "Autonomy limit (USD cents)",
    "new_recipient_requires_approval": "New recipient approval",
    "allowed_chain_id": "Allowed chain",
    "allowed_tokens": "Allowed tokens",
    "known_recipients": "Known recipients",
    "blocked_recipients": "Blocked recipients",
    "high_risk_concentration_bps": "High-risk concentration (basis points)",
    "goal_satisfaction_min_bps": "Minimum goal probability (basis points)",
    "reserve_breach_max_bps": "Maximum reserve breach probability (basis points)",
    "borrowed_funding_forbidden": "Borrowed funding forbidden",
}


def describe_changes(draft: ConstitutionDraft, base: ConstitutionVersion | None) -> str:
    previous = base.rules.model_dump() if base else {}
    changes = [
        f"{LABELS[key]}: {previous.get(key, 'unset')} -> {value}"
        for key, value in draft.rules.model_dump().items()
        if key not in previous or previous[key] != value
    ]
    return "; ".join(changes) if changes else "No rule changes"


def checked_version(row, actor_id: str) -> ConstitutionVersion:
    try:
        version = ConstitutionVersion.model_validate(row.payload)
        if (
            version.id != row.id
            or version.user_id != row.user_id
            or version.user_id != actor_id
            or version.confirmed_by != actor_id
            or version.version != row.version
            or version.policy_digest != row.policy_digest
            or digest(version.rules) != version.policy_digest
        ):
            raise ValueError("Policy binding mismatch")
        return version
    except (AttributeError, ValueError, ValidationError):
        raise DomainError(ErrorCode.UNAVAILABLE, "Stored Constitution integrity failed") from None


def checked_draft(row, actor_id: str) -> ConstitutionDraft:
    try:
        draft = ConstitutionDraft.model_validate(row.payload)
        if (draft.id, draft.user_id, draft.base_version) != (row.id, row.user_id, row.base_version):
            raise ValueError("Draft binding mismatch")
        if draft.user_id != actor_id:
            raise DomainError(ErrorCode.FORBIDDEN, "Draft belongs to another user", 403)
        return draft
    except (AttributeError, ValueError, ValidationError):
        raise DomainError(ErrorCode.UNAVAILABLE, "Stored draft integrity failed") from None


def begin_write(session: Session, engine, actor_id: str) -> UserHead:
    if engine.dialect.name not in ("sqlite", "postgresql"):
        raise DomainError(ErrorCode.UNAVAILABLE, "Constitution writes require reviewed SQLite or PostgreSQL storage")
    acquire_authority_lock(session)
    head = session.get(UserHead, actor_id)
    if head is None:
        raise DomainError(ErrorCode.UNAUTHORIZED, "Authenticated user not initialized", 401)
    return head


def create_draft(engine, body: DraftRequest, actor_id: str) -> ConstitutionDraft:
    body = DraftRequest.model_validate_json(body.model_dump_json())
    with Session(engine) as session, session.begin():
        head = begin_write(session, engine, actor_id)
        if body.base_version != head.constitution_id:
            raise DomainError(ErrorCode.STALE_POLICY, "Reload active policy before drafting", 409)
        base = (
            checked_version(session.get(ConstitutionVersionRecord, head.constitution_id), actor_id)
            if head.constitution_id
            else None
        )
        now = datetime.now(UTC)
        draft = ConstitutionDraft(
            id="draft-" + str(uuid4()),
            user_id=actor_id,
            rules=body.rules,
            base_version=body.base_version,
            created_at=now,
        )
        session.add(
            ConstitutionDraftRecord(
                id=draft.id,
                created_at=now,
                user_id=actor_id,
                base_version=draft.base_version,
                payload=draft.model_dump(mode="json"),
            )
        )
        session.flush()
        append_event(
            session,
            actor=actor_id,
            event_type="CONSTITUTION_DRAFTED",
            artifact_digest=digest(draft),
            now=now,
            details={"draft_id": draft.id, "changes": describe_changes(draft, base)},
        )
        return draft


def confirm_draft(engine, body: ConfirmRequest, actor_id: str) -> ConstitutionVersion:
    body = ConfirmRequest.model_validate_json(body.model_dump_json())
    try:
        with Session(engine) as session, session.begin():
            head = begin_write(session, engine, actor_id)
            row = session.get(ConstitutionDraftRecord, body.draft_id)
            if row is None:
                raise DomainError(ErrorCode.CONFLICT, "Draft not found", 409)
            draft = checked_draft(row, actor_id)
            if (
                session.scalar(
                    select(ConstitutionVersionRecord.id).where(
                        ConstitutionVersionRecord.draft_id == draft.id
                    )
                )
                is not None
            ):
                raise DomainError(ErrorCode.CONFLICT, "Draft already confirmed", 409)
            if draft.base_version != head.constitution_id:
                raise DomainError(
                    ErrorCode.STALE_POLICY, "Active policy changed; create a new draft", 409
                )
            if digest(draft.rules) != body.expected_policy_digest:
                raise DomainError(ErrorCode.CONFLICT, "Draft differs from the policy reviewed", 409)
            previous = (
                checked_version(
                    session.get(ConstitutionVersionRecord, head.constitution_id), actor_id
                )
                if head.constitution_id
                else None
            )
            now = datetime.now(UTC)
            version = ConstitutionVersion(
                id="constitution-" + str(uuid4()),
                user_id=actor_id,
                version=previous.version + 1 if previous else 1,
                rules=draft.rules,
                policy_digest=digest(draft.rules),
                confirmed_at=now,
                confirmed_by=actor_id,
            )
            session.add(
                ConstitutionVersionRecord(
                    id=version.id,
                    created_at=now,
                    user_id=actor_id,
                    draft_id=draft.id,
                    version=version.version,
                    policy_digest=version.policy_digest,
                    payload=version.model_dump(mode="json"),
                )
            )
            session.flush()
            updated = session.execute(
                update(UserHead)
                .where(
                    UserHead.user_id == actor_id,
                    UserHead.constitution_id == draft.base_version,
                )
                .values(constitution_id=version.id)
            )
            if updated.rowcount != 1:
                raise DomainError(ErrorCode.CONFLICT, "Concurrent policy activation", 409)
            append_event(
                session,
                actor=actor_id,
                event_type="CONSTITUTION_CONFIRMED",
                artifact_digest=digest(version),
                now=now,
                details={
                    "draft_id": draft.id,
                    "constitution_id": version.id,
                    "version": version.version,
                    "policy_digest": version.policy_digest,
                },
            )
            return version
    except IntegrityError:
        raise DomainError(ErrorCode.CONFLICT, "Concurrent policy confirmation", 409) from None


def history(engine, actor_id: str) -> list[ConstitutionVersion]:
    with Session(engine) as session:
        rows = session.scalars(
            select(ConstitutionVersionRecord)
            .where(ConstitutionVersionRecord.user_id == actor_id)
            .order_by(ConstitutionVersionRecord.version)
        )
        return [checked_version(row, actor_id) for row in rows]
