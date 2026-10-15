from fastapi import APIRouter

from app.core.errors import unfinished
from app.models.contracts import AttackResponse, EmergencyRequest, EmergencyResponse, FinancialState

router = APIRouter()


@router.post("/demo/emergency", response_model=EmergencyResponse, operation_id="emergency")
def emergency(body: EmergencyRequest):
    unfinished("PF-032")


@router.post("/demo/attack", response_model=AttackResponse, operation_id="attack")
def attack():
    unfinished("PF-031")


@router.post("/demo/reset", response_model=FinancialState, operation_id="reset")
def reset():
    unfinished("PF-028")
