from fastapi import APIRouter, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.canonical import digest
from app.core.errors import DomainError
from app.db.models import ConstitutionVersionRecord, FinancialStateRecord, SimulationConfigRecord
from app.db.state import read_state
from app.models.contracts import (
    ActionRequest,
    ErrorCode,
    OptimizerResult,
    SimulationConfig,
    TrustedSimulationInput,
)
from app.optimizer.chain import load_chain_bounds
from app.optimizer.service import optimize
from app.policy.service import checked_version

router = APIRouter()


@router.post("/optimize", response_model=OptimizerResult, operation_id="optimize_action")
def optimize_action(body: ActionRequest, request: Request):
    engine = request.app.state.engine
    if engine.dialect.name != "sqlite":
        raise DomainError(ErrorCode.UNAVAILABLE, "Optimizer supports SQLite only")
    # A proposal must not mix a state read with a concurrently activated policy/config.
    with Session(engine) as session, session.begin():
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        try:
            actor = request.state.actor_id
            state = read_state(session, actor)
            row = session.get(FinancialStateRecord, state.id)
            if (row.user_id, row.version, state.snapshot.user_id) != (
                actor,
                state.snapshot.version,
                actor,
            ):
                raise ValueError("State metadata mismatch")
            if state.active_constitution_version is None:
                raise DomainError(ErrorCode.UNAVAILABLE, "Confirmed Constitution required")
            policy = checked_version(
                session.get(ConstitutionVersionRecord, state.active_constitution_version), actor
            )
            configs = list(session.scalars(select(SimulationConfigRecord).limit(2)))
            if len(configs) != 1:
                raise DomainError(
                    ErrorCode.UNAVAILABLE, "Exactly one trusted simulation configuration required"
                )
            config = SimulationConfig.model_validate(configs[0].payload)
            if config.id != configs[0].id or digest(config) != configs[0].config_digest:
                raise ValueError("Config binding mismatch")
            trusted = TrustedSimulationInput(
                state=state, constitution=policy, action=body.action, config=config
            )
            return optimize(trusted, load_chain_bounds(body.action))
        except (ValueError, AttributeError, OverflowError):
            raise DomainError(
                ErrorCode.UNAVAILABLE, "Trusted optimizer inputs unavailable or invalid"
            ) from None
