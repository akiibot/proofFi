from fastapi import APIRouter, Request

from app.models.contracts import IntentRequest, WorkflowResult
from app.workflows.service import prepare_goal

router = APIRouter()


@router.post("/workflows/goal", response_model=WorkflowResult, operation_id="run_goal")
def run_goal(body: IntentRequest, request: Request):
    # Global authentication/CSRF supplies identity; preparation confers no consent.
    return prepare_goal(request.app.state.engine, body, request.state.actor_id)
