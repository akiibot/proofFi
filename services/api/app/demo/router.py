from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool

from app.models.contracts import AttackResponse, EmergencyRequest, EmergencyResponse, FinancialState

router = APIRouter()


@router.post("/demo/emergency", response_model=EmergencyResponse, operation_id="emergency")
def emergency(body: EmergencyRequest, request: Request):
    from app.core.errors import DomainError
    from app.demo.emergency import record_emergency
    from app.models.contracts import ErrorCode

    if not request.app.state.auth.settings.demo_mode:
        raise DomainError(ErrorCode.FORBIDDEN, "Emergency demo disabled", 403)
    return record_emergency(request.app.state.engine, body, request.state.actor_id)


@router.post("/demo/attack", response_model=AttackResponse, operation_id="attack")
async def attack(request: Request):
    from app.core.errors import DomainError
    from app.demo.attack import run_attack
    from app.models.contracts import ErrorCode

    if not request.app.state.auth.settings.demo_mode:
        raise DomainError(ErrorCode.FORBIDDEN, "Attack demo disabled", 403)
    if await request.body():
        raise DomainError(ErrorCode.VALIDATION_ERROR, "Attack demo accepts no input body", 422)
    return await run_in_threadpool(
        run_attack, request.app.state.engine, request.state.actor_id
    )


@router.post("/demo/reset", response_model=FinancialState, operation_id="reset")
async def reset(request: Request):
    from app.core.errors import DomainError
    from app.demo.reset import reset_demo
    from app.models.contracts import ErrorCode

    if await request.body():
        raise DomainError(ErrorCode.VALIDATION_ERROR, "Demo reset accepts no input body", 422)
    return await run_in_threadpool(
        reset_demo, request.app.state.engine,
        request.app.state.auth.settings, request.state.actor_id,
    )
