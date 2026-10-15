from uuid import uuid4

from sqlalchemy import update
from sqlalchemy.orm import Session

from app.core.canonical import digest
from app.core.errors import DomainError
from app.db.models import FinancialStateRecord, UserHead
from app.models.contracts import ErrorCode, FinancialState, StateSnapshot


def read_state(session: Session, user_id: str = "demo-user") -> FinancialState:
    head = session.get(UserHead, user_id)
    if not head:
        raise DomainError(ErrorCode.STATE_NOT_INITIALIZED, "Run migration and seed first")
    record = session.get(FinancialStateRecord, head.state_id)
    state = StateSnapshot.model_validate(record.payload)
    if digest(state) != record.snapshot_hash:
        raise DomainError(ErrorCode.UNAVAILABLE, "Stored state integrity check failed")
    return FinancialState(
        id=record.id,
        snapshot=state,
        snapshot_hash=record.snapshot_hash,
        active_constitution_version=head.constitution_id,
    )


def append_state(
    session: Session, snapshot: StateSnapshot, expected_version: int
) -> FinancialState:
    """Caller owns transaction. Optimistic CAS prevents lost updates; rollback on conflict."""
    current = read_state(session, snapshot.user_id)
    if current.snapshot.version != expected_version or snapshot.version != expected_version + 1:
        raise DomainError(ErrorCode.CONFLICT, "Financial state version conflict", 409)
    # Lock the expected head before inserting a version that another writer may claim.
    claimed = session.execute(
        update(UserHead)
        .where(UserHead.user_id == snapshot.user_id, UserHead.state_id == current.id)
        .values(state_id=current.id)
    )
    if claimed.rowcount != 1:
        raise DomainError(ErrorCode.CONFLICT, "Financial state changed concurrently", 409)
    record = FinancialStateRecord(
        id=str(uuid4()),
        user_id=snapshot.user_id,
        version=snapshot.version,
        snapshot_hash=digest(snapshot),
        payload=snapshot.model_dump(mode="json"),
    )
    session.add(record)
    session.flush()
    result = session.execute(
        update(UserHead)
        .where(UserHead.user_id == snapshot.user_id, UserHead.state_id == current.id)
        .values(state_id=record.id)
    )
    if result.rowcount != 1:
        raise DomainError(ErrorCode.CONFLICT, "Financial state changed concurrently", 409)
    return FinancialState(
        id=record.id,
        snapshot=snapshot,
        snapshot_hash=record.snapshot_hash,
        active_constitution_version=current.active_constitution_version,
    )
