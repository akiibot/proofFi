from fastapi import APIRouter, Request

from app.models.contracts import IntentRequest, ParsedIntent, PlanResponse
from app.planner.service import plan

router = APIRouter()


@router.post("/intent/parse", response_model=ParsedIntent, operation_id="parse_intent")
def parse_intent(body: IntentRequest, request: Request):
    provider = getattr(request.app.state, "judge_runtime", None)
    kwargs = {"proposal_provider": provider.proposal_provider} if provider else {}
    return plan(
        request.app.state.engine, request.state.actor_id, body.goal, parse_only=True, **kwargs
    )


@router.post("/plans/generate", response_model=PlanResponse, operation_id="generate_plans")
def generate_plans(body: IntentRequest, request: Request):
    provider = getattr(request.app.state, "judge_runtime", None)
    kwargs = {"proposal_provider": provider.proposal_provider} if provider else {}
    return plan(request.app.state.engine, request.state.actor_id, body.goal, **kwargs)
