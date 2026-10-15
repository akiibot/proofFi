from fastapi import APIRouter

from app.core.errors import unfinished
from app.models.contracts import Approval, ApprovalRequest

router = APIRouter()


@router.post("/approvals", response_model=Approval, operation_id="approve_action")
def approve_action(body: ApprovalRequest):
    unfinished("PF-013")
