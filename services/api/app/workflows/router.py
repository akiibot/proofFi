from fastapi import APIRouter

from app.core.errors import unfinished
from app.models.contracts import IntentRequest, WorkflowResult

router = APIRouter()


@router.post("/workflows/goal", response_model=WorkflowResult, operation_id="run_goal")
def run_goal(body: IntentRequest):
    unfinished("PF-016")
