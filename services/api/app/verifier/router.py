from fastapi import APIRouter

from app.core.errors import unfinished
from app.models.contracts import (
    ActionCertificate,
    ActionRequest,
    CertificateStatus,
    VerificationResult,
)

router = APIRouter()


@router.post("/verify", response_model=VerificationResult, operation_id="verify_action")
def verify_action(body: ActionRequest):
    unfinished("PF-029")


@router.get("/certificates/{id}", response_model=ActionCertificate, operation_id="get_certificate")
def get_certificate(id: str):
    unfinished("PF-012")


@router.post(
    "/certificates/{id}/verify", response_model=CertificateStatus, operation_id="verify_certificate"
)
def verify_certificate(id: str):
    unfinished("PF-012")
