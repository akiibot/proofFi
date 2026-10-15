from fastapi import APIRouter

from app.core.errors import unfinished
from app.models.contracts import ActionRequest, SimulationRun

router = APIRouter()


@router.post("/simulate", response_model=SimulationRun, operation_id="simulate_action")
def simulate_action(body: ActionRequest):
    unfinished("PF-009")
