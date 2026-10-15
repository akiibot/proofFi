from fastapi import APIRouter

from app.core.errors import unfinished
from app.models.contracts import IntentRequest, ParsedIntent, PlanResponse

router = APIRouter()


@router.post("/intent/parse", response_model=ParsedIntent, operation_id="parse_intent")
def parse_intent(body: IntentRequest):
    unfinished("PF-017")


@router.post("/plans/generate", response_model=PlanResponse, operation_id="generate_plans")
def generate_plans(body: IntentRequest):
    unfinished("PF-017")
