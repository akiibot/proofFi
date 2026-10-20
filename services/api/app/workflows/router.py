from fastapi import APIRouter, Request

from app.models.contracts import IntentRequest, WorkflowResult
from app.workflows.service import prepare_goal

router = APIRouter()


@router.post("/workflows/goal", response_model=WorkflowResult, operation_id="run_goal")
def run_goal(body: IntentRequest, request: Request):
    # Global authentication/CSRF supplies identity; preparation confers no consent.
    from app.judge.runtime import chain_for, verification_for

    runtime = verification_for(request)
    kwargs = (
        {}
        if runtime is None
        else {
            "runtime": runtime,
            "proposal_provider": request.app.state.judge_runtime.proposal_provider,
            "chain_settings": chain_for(request),
        }
    )
    return prepare_goal(request.app.state.engine, body, request.state.actor_id, **kwargs)
