from fastapi import APIRouter

from app.core.errors import unfinished
from app.models.contracts import (
    ConfirmRequest,
    ConstitutionDraft,
    ConstitutionVersion,
    DraftRequest,
)

router = APIRouter()


@router.post("/constitutions/drafts", response_model=ConstitutionDraft, operation_id="create_draft")
def create_draft(body: DraftRequest):
    unfinished("PF-006")


@router.post(
    "/constitutions/confirm",
    response_model=ConstitutionVersion,
    operation_id="confirm_constitution",
)
def confirm_constitution(body: ConfirmRequest):
    unfinished("PF-006")


@router.get(
    "/constitutions/history",
    response_model=list[ConstitutionVersion],
    operation_id="constitution_history",
)
def constitution_history():
    unfinished("PF-006")
