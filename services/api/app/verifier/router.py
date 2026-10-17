from datetime import UTC, datetime

from fastapi import APIRouter, Request
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.canonical import digest
from app.core.errors import DomainError
from app.db.models import (
    ApprovalRecord,
    CertificateRecord,
    ConstitutionVersionRecord,
    ExecutionRecord,
)
from app.db.state import read_state
from app.models.contracts import (
    ActionCertificate,
    ActionRequest,
    Approval,
    CertificateStatus,
    ConstitutionVersion,
    ErrorCode,
    VerificationResult,
)
from app.verifier.certificates import public_keys_from_environment, verify_integrity
from app.verifier.service import verify_action as issue_verified_action

router = APIRouter()


@router.post("/verify", response_model=VerificationResult, operation_id="verify_action")
def verify_action(body: ActionRequest, request: Request):
    return issue_verified_action(request.app.state.engine, body, request.state.actor_id)


@router.get("/certificates/{id}", response_model=ActionCertificate, operation_id="get_certificate")
def get_certificate(id: str, request: Request):
    with Session(request.app.state.engine) as session:
        record = session.get(CertificateRecord, id)
        if record is None:
            raise DomainError(ErrorCode.INVALID_CERTIFICATE, "Certificate not found", 409)
        try:
            certificate = ActionCertificate.model_validate(record.payload)
            if certificate.payload.id != record.id:
                raise ValueError("Stored certificate ID mismatch")
            return certificate
        except (ValidationError, ValueError):
            raise DomainError(ErrorCode.UNAVAILABLE, "Stored certificate is invalid") from None


@router.post(
    "/certificates/{id}/verify", response_model=CertificateStatus, operation_id="verify_certificate"
)
def verify_certificate(id: str, request: Request):
    now = datetime.now(UTC)
    with Session(request.app.state.engine) as session:
        record = session.get(CertificateRecord, id)
        if record is None:
            raise DomainError(ErrorCode.INVALID_CERTIFICATE, "Certificate not found", 409)
        try:
            certificate = ActionCertificate.model_validate(record.payload)
        except ValidationError:
            return CertificateStatus(
                certificate_id=id,
                status="TAMPERED",
                signature_valid=False,
                reasons=["Stored certificate schema is invalid"],
            )
        integrity = verify_integrity(certificate, public_keys_from_environment(), now=now)
        if integrity.status != "VALID":
            return integrity.model_copy(update={"certificate_id": id})
        payload = certificate.payload
        if (
            payload.id,
            certificate.certificate_hash,
            payload.nonce,
            payload.action.id,
            payload.constitution_version,
        ) != (
            record.id,
            record.certificate_hash,
            record.nonce,
            record.action_id,
            record.constitution_id,
        ):
            return CertificateStatus(
                certificate_id=id,
                status="TAMPERED",
                signature_valid=True,
                reasons=["Stored certificate metadata binding mismatch"],
            )
        state = read_state(session)
        if (
            record.state_id != state.id
            or payload.state_version != state.snapshot.version
            or payload.state_snapshot_hash != state.snapshot_hash
        ):
            return CertificateStatus(
                certificate_id=id,
                status="SIGNED_BUT_STALE",
                signature_valid=True,
                reasons=["Financial state changed"],
            )
        if state.active_constitution_version != payload.constitution_version:
            return CertificateStatus(
                certificate_id=id,
                status="SIGNED_BUT_STALE",
                signature_valid=True,
                reasons=["Active Constitution changed"],
            )
        stored_policy = session.get(ConstitutionVersionRecord, state.active_constitution_version)
        try:
            policy = (
                ConstitutionVersion.model_validate(stored_policy.payload) if stored_policy else None
            )
            if (
                policy is None
                or policy.user_id != state.snapshot.user_id
                or policy.id != payload.constitution_version
                or digest(policy.rules) != policy.policy_digest
                or policy.policy_digest != stored_policy.policy_digest
            ):
                raise ValueError("Stored policy integrity mismatch")
        except (ValueError, ValidationError):
            raise DomainError(
                ErrorCode.UNAVAILABLE, "Trusted policy integrity check failed"
            ) from None
        if payload.policy_digest != policy.policy_digest:
            return CertificateStatus(
                certificate_id=id,
                status="SIGNED_BUT_STALE",
                signature_valid=True,
                reasons=["Policy digest changed"],
            )
        if (
            session.scalar(select(ExecutionRecord.id).where(ExecutionRecord.certificate_id == id))
            is not None
        ):
            return CertificateStatus(
                certificate_id=id,
                status="ALREADY_USED",
                signature_valid=True,
                reasons=["Certificate already claimed for execution"],
            )
        if payload.approval.required:
            row = session.scalar(select(ApprovalRecord).where(ApprovalRecord.certificate_id == id))
            approved = False
            if row is not None:
                try:
                    approval = Approval.model_validate(row.payload)
                    approved = (
                        approval.id == row.id
                        and approval.certificate_id == id
                        and approval.actor_id == row.actor_id == state.snapshot.user_id
                        and approval.decision == "APPROVE"
                        and approval.action_digest == payload.action_digest
                        and approval.state_version == payload.state_version
                        and approval.constitution_version == payload.constitution_version
                        and approval.consumed_at is None
                        and row.consumed_at is None
                        and payload.issued_at <= approval.created_at <= now < payload.expires_at
                    )
                except ValidationError:
                    approved = False
            if not approved:
                return CertificateStatus(
                    certificate_id=id,
                    status="APPROVAL_REQUIRED",
                    signature_valid=True,
                    reasons=["Matching unconsumed human approval required"],
                )
        return CertificateStatus(
            certificate_id=id,
            status="VALID",
            signature_valid=True,
            reasons=[
                "Stored signature, freshness and approval checks passed; executor must independently authorize before signing"
            ],
        )
