from fastapi import APIRouter

from app.core.errors import unfinished
from app.models.contracts import ExecuteRequest, Execution

router = APIRouter()


@router.post("/execute", response_model=Execution, operation_id="execute_action")
def execute_action(body: ExecuteRequest):
    unfinished("PF-014")
