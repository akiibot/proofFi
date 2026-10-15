from fastapi import APIRouter

from app.core.errors import unfinished
from app.models.contracts import ActionRequest, OptimizerResult

router = APIRouter()


@router.post("/optimize", response_model=OptimizerResult, operation_id="optimize_action")
def optimize_action(body: ActionRequest):
    unfinished("PF-010")
