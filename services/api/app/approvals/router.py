from fastapi import APIRouter, Request

from app.approvals.service import record_decision
from app.models.contracts import Approval, ApprovalRequest

router = APIRouter()


@router.post("/approvals", response_model=Approval, operation_id="approve_action")
def approve_action(body: ApprovalRequest, request: Request):
    return record_decision(
        request.app.state.engine, body, request.state.actor_id, request.state.session_digest
    )
