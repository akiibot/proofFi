from fastapi import APIRouter, Request
from fastapi.concurrency import run_in_threadpool

from app.core.errors import DomainError
from app.models.contracts import (
    ConfirmRequest,
    ConstitutionDraft,
    ConstitutionVersion,
    DraftRequest,
    ErrorCode,
)
from app.policy import service

router = APIRouter()


@router.post("/constitutions/drafts", response_model=ConstitutionDraft, operation_id="create_draft")
def create_draft(body: DraftRequest, request: Request):
    return service.create_draft(request.app.state.engine, body, request.state.actor_id)


@router.post(
    "/constitutions/confirm",
    response_model=ConstitutionVersion,
    operation_id="confirm_constitution",
)
async def confirm_constitution(body: ConfirmRequest, request: Request):
    # Literal[True] also accepts JSON number 1 in Pydantic; consent must be a
    # deliberate JSON boolean, without changing the established public schema.
    if (await request.json()).get("confirmed") is not True:
        raise DomainError(ErrorCode.VALIDATION_ERROR, "Explicit confirmed=true required", 422)
    return await run_in_threadpool(
        service.confirm_draft, request.app.state.engine, body, request.state.actor_id
    )


@router.get(
    "/constitutions/history",
    response_model=list[ConstitutionVersion],
    operation_id="constitution_history",
)
def constitution_history(request: Request):
    return service.history(request.app.state.engine, request.state.actor_id)
