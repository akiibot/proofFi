from typing import Annotated

from fastapi import APIRouter, Path, Request
from pydantic_settings import BaseSettings, SettingsConfigDict

from app.core.errors import DomainError, unfinished
from app.models.contracts import ErrorCode, ExecuteRequest, Execution

router = APIRouter()


@router.post("/execute", response_model=Execution, operation_id="execute_action")
def execute_action(body: ExecuteRequest, request: Request):
    try:
        enabled = ExecutionSettings().execution_enabled
    except Exception:
        raise DomainError(ErrorCode.UNAVAILABLE, "Execution configuration unavailable") from None
    if not enabled:
        unfinished("PF-014 explicit operator enablement")
    policy = operational_policy()
    # Global router authentication/CSRF supplies identity; the body carries no authority.
    return execute_internal(
        request.app.state.engine, body, request.state.actor_id, policy=policy
    )


class ExecutionSettings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    execution_enabled: bool = False


def operational_policy():
    """Load only explicit server configuration, never certificate/client fields."""
    from app.execution.signer import TestnetPolicy
    from app.verifier.service import RuntimeSettings, TransactionConfiguration

    try:
        settings = RuntimeSettings()
        if not settings.rpc_url.get_secret_value().startswith(("https://", "http://")):
            raise ValueError("HTTP RPC required")
        config = TransactionConfiguration.model_validate_json(
            settings.verifier_transaction_config_json.get_secret_value()
        )
        return TestnetPolicy(
            wallet_address=config.wallet_address,
            token_address=config.token_address,
            recipient=config.recipient,
            token_decimals=config.token_decimals,
            max_gas_limit=config.gas_limit,
            max_fee_per_gas_wei=config.max_fee_per_gas_wei,
        )
    except Exception:
        # Validation/provider diagnostics can contain private configuration.
        raise DomainError(
            ErrorCode.CHAIN_NOT_CONFIGURED, "Trusted execution configuration unavailable"
        ) from None


def execute_internal(engine, body: ExecuteRequest, actor_id: str, *, policy) -> Execution:
    """Independent composition behind explicit operator enablement.

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


@router.get("/executions/{id}", response_model=Execution, operation_id="get_execution")
def get_execution(
    id: Annotated[str, Path(pattern=r"^[A-Za-z0-9_-]{1,100}$")], request: Request
):
    """Read the persisted observation only; never poll RPC, reconcile, sign or dispatch."""
    from pydantic import ValidationError
    from sqlalchemy.orm import Session

    from app.db.models import CertificateRecord, ExecutionRecord, FinancialStateRecord

    with Session(request.app.state.engine) as session:
        record = session.get(ExecutionRecord, id)
        certificate = session.get(CertificateRecord, record.certificate_id) if record else None
        state = session.get(FinancialStateRecord, certificate.state_id) if certificate else None
        if record is None or state is None or state.user_id != request.state.actor_id:
            raise DomainError(ErrorCode.CONFLICT, "Execution not found for this user", 409)
        try:
            observation = Execution.model_validate(record.payload)
            if (
                observation.id != record.id
                or observation.certificate_id != record.certificate_id
                or observation.status != record.status
                or observation.tx_hash != record.tx_hash
            ):
                raise ValueError("Execution metadata mismatch")
            return observation
        except (ValidationError, ValueError):
            raise DomainError(ErrorCode.UNAVAILABLE, "Stored execution is invalid") from None
