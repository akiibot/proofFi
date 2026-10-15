"""Explicit human decisions against fresh authentic certificates; no execution authority."""

from datetime import UTC, datetime
from uuid import uuid4

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit.append import append_event
from app.core.canonical import digest
from app.core.errors import DomainError
from app.db.models import (
    ApprovalRecord,
    CertificateRecord,
    ConstitutionVersionRecord,
    ExecutionRecord,
    UserHead,
)
from app.db.state import read_state
from app.models.contracts import (
    ActionCertificate,
    Approval,
    ApprovalRequest,
    ConstitutionVersion,
    ErrorCode,
)
from app.verifier.certificates import public_keys_from_environment, verify_integrity


def record_decision(engine, body: ApprovalRequest, actor_id: str, session_digest: str) -> Approval:
    try:
        with Session(engine) as session, session.begin():
            # Serialize validation + write, not just duplicate inserts. Other SQLite
            # writers cannot change the authoritative head until this commits.
            if engine.dialect.name == "sqlite":
                session.connection().exec_driver_sql("BEGIN IMMEDIATE")
            head = session.scalar(
                select(UserHead).where(UserHead.user_id == actor_id).with_for_update()
            )
            if head is None:
                raise DomainError(
                    ErrorCode.UNAUTHORIZED, "Authenticated financial user is not initialized", 401
                )
            record = session.scalar(
                select(CertificateRecord)
                .where(CertificateRecord.id == body.certificate_id)
                .with_for_update()
            )
            if record is None:
                raise DomainError(ErrorCode.INVALID_CERTIFICATE, "Certificate not found", 409)
            try:
                certificate = ActionCertificate.model_validate(record.payload)
            except ValidationError:
                raise DomainError(
                    ErrorCode.INVALID_CERTIFICATE, "Stored certificate schema is invalid", 409
                ) from None
            now = datetime.now(UTC)
            integrity = verify_integrity(certificate, public_keys_from_environment(), now=now)
            if integrity.status != "VALID":
                code = (
                    ErrorCode.EXPIRED
                    if integrity.status == "EXPIRED"
                    else ErrorCode.INVALID_CERTIFICATE
                )
                raise DomainError(
                    code, "Certificate integrity or time check failed; approval refused", 409
                )
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
            ) or body.action_digest != payload.action_digest:
                raise DomainError(
                    ErrorCode.INVALID_CERTIFICATE, "Certificate/action binding mismatch", 409
                )
            state = read_state(session, actor_id)
            if (
                state.snapshot.user_id != actor_id
                or record.state_id != state.id
                or payload.state_version != state.snapshot.version
                or payload.state_snapshot_hash != state.snapshot_hash
            ):
                raise DomainError(
                    ErrorCode.STALE_STATE, "Financial state changed; re-verification required", 409
                )
            if state.active_constitution_version != payload.constitution_version:
                raise DomainError(
                    ErrorCode.STALE_POLICY,
                    "Active Constitution changed; re-verification required",
                    409,
                )
            policy_row = session.get(ConstitutionVersionRecord, payload.constitution_version)
            try:
                policy = (
                    ConstitutionVersion.model_validate(policy_row.payload) if policy_row else None
                )
                if (
                    policy is None
                    or policy.id != payload.constitution_version
                    or policy.user_id != actor_id
                    or policy_row.user_id != actor_id
                    or digest(policy.rules) != policy.policy_digest
                    or policy.policy_digest != policy_row.policy_digest
                ):
                    raise ValueError("Policy integrity mismatch")
            except (ValueError, ValidationError):
                raise DomainError(
                    ErrorCode.UNAVAILABLE, "Trusted policy integrity check failed"
                ) from None
            if payload.policy_digest != policy.policy_digest:
                raise DomainError(
                    ErrorCode.STALE_POLICY, "Policy digest changed; re-verification required", 409
                )
            if (
                payload.action.chain_id != policy.rules.allowed_chain_id
                or payload.action.token_address not in policy.rules.allowed_tokens
                or payload.action.recipient in policy.rules.blocked_recipients
                or (
                    payload.action.funding_source == "borrowed"
                    and policy.rules.borrowed_funding_forbidden
                )
            ):
                raise DomainError(
                    ErrorCode.POLICY_DENIED,
                    "Human approval cannot override forbidden asset, network, recipient or funding",
                    403,
                )
            if (
                session.scalar(
                    select(ExecutionRecord.id).where(ExecutionRecord.certificate_id == payload.id)
                )
                is not None
            ):
                raise DomainError(
                    ErrorCode.ALREADY_USED,
                    "Certificate already claimed; no new approval permitted",
                    409,
                )
            if (
                session.scalar(
                    select(ApprovalRecord.id).where(ApprovalRecord.certificate_id == payload.id)
                )
                is not None
            ):
                raise DomainError(
                    ErrorCode.CONFLICT, "Certificate already has a final human decision", 409
                )
            if not payload.approval.required:
                raise DomainError(
                    ErrorCode.CONFLICT, "Certificate did not request human approval", 409
                )
            approval = Approval(
                id="approval-" + str(uuid4()),
                certificate_id=payload.id,
                action_digest=payload.action_digest,
                state_version=payload.state_version,
                constitution_version=payload.constitution_version,
                actor_id=actor_id,
                decision=body.decision,
                created_at=now,
                consumed_at=None,
            )
            session.add(
                ApprovalRecord(
                    id=approval.id,
                    created_at=now,
                    certificate_id=approval.certificate_id,
                    actor_id=actor_id,
                    payload=approval.model_dump(mode="json"),
                    consumed_at=None,
                )
            )
            session.flush()
            append_event(
                session,
                actor=actor_id,
                event_type="APPROVAL_RECORDED",
                artifact_digest=digest(approval),
                details={
                    "approval_id": approval.id,
                    "session_digest": session_digest,
                    "certificate_id": payload.id,
                    "action_digest": payload.action_digest,
                    "state_version": payload.state_version,
                    "constitution_version": payload.constitution_version,
                    "decision": body.decision,
                },
                now=now,
            )
            return approval
    except IntegrityError:
        # Unique certificate decision is the final guard against duplicate writes.
        raise DomainError(
            ErrorCode.CONFLICT, "Concurrent decision conflict; reload certificate status", 409
        ) from None
