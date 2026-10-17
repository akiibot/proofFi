from fastapi import APIRouter, Request

from app.core.errors import unfinished
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
def attack():
    unfinished("PF-031")


@router.post("/demo/reset", response_model=FinancialState, operation_id="reset")
def reset():
    unfinished("PF-028")
