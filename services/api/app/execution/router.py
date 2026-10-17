from fastapi import APIRouter

from app.core.errors import unfinished
from app.models.contracts import ExecuteRequest, Execution

router = APIRouter()


@router.post("/execute", response_model=Execution, operation_id="execute_action")
def execute_action(body: ExecuteRequest):
    unfinished("PF-014")


def execute_internal(engine, body: ExecuteRequest, actor_id: str, *, policy) -> Execution:
    """Operator-only composition; deliberately not connected to the HTTP handler.

    Existing attempts only reconcile. A stranded CLAIMED attempt cannot be signed
    or dispatched by retrying this function. Runtime policy is a trusted internal
    argument, never reconstructed from client/planner fields.
    """
    from sqlalchemy import or_, select
    from sqlalchemy.orm import Session

    from app.core.errors import DomainError
    from app.db.models import ExecutionRecord
    from app.execution.reconcile import reconcile_execution
    from app.execution.rpc import BroadcastUncertain
    from app.execution.service import broadcast_once, prepare_execution
    from app.execution.signer import TestnetPolicy
    from app.models.contracts import ErrorCode

    body = ExecuteRequest.model_validate_json(body.model_dump_json())
    policy = TestnetPolicy.model_validate_json(policy.model_dump_json())
    with Session(engine) as session:
        existing = list(
            session.scalars(
                select(ExecutionRecord).where(
                    or_(
                        ExecutionRecord.certificate_id == body.certificate_id,
                        ExecutionRecord.idempotency_key == body.idempotency_key,
                    )
                )
            )
        )
        if existing:
            if len(existing) != 1 or (
                existing[0].certificate_id != body.certificate_id
                or existing[0].idempotency_key != body.idempotency_key
            ):
                raise DomainError(ErrorCode.CONFLICT, "Execution request identity mismatch", 409)
            execution_id = existing[0].id
            if existing[0].status == "CLAIMED":
                raise DomainError(
                    ErrorCode.ALREADY_USED,
                    "Stranded claim requires recovery; never automatically re-sign",
                    409,
                )
        else:
            execution_id = None
    if execution_id is None:
        prepared = prepare_execution(engine, body, actor_id, policy=policy)
        execution_id = prepared.id
        try:
            broadcast_once(engine, body, actor_id, policy=policy, execution_id=execution_id)
        except BroadcastUncertain:
            # Reconcile only the persisted identity, never trust an exception hash
            # as new authority or turn an ambiguous send into an automatic retry.
            pass
    return reconcile_execution(engine, body, actor_id, policy=policy, execution_id=execution_id)
