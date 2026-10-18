"""Independent, atomic execution claims. No signer, RPC, or default risk approval.

A claim is durable reservation, not evidence of broadcast. PF-015 must connect
this service to signing/reconciliation; PF-029 must supply the trusted recheck.
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from hashlib import sha256
from uuid import uuid4

from eth_account import Account
from eth_account.typed_transactions import TypedTransaction
from hexbytes import HexBytes
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit.append import append_event
from app.core.canonical import digest
from app.core.errors import DomainError, unfinished
from app.db.models import (
    ApprovalRecord,
    AuditRecord,
    CandidateRecord,
    CertificateRecord,
    ConstitutionVersionRecord,
    ExecutionRecord,
    FinancialStateRecord,
    SimulationConfigRecord,
    SimulationRecord,
    UserHead,
    VerificationRecord,
)
from app.db.postgres import acquire_authority_lock
from app.db.state import read_state
from app.execution.signer import LocalTestnetSigner, TestnetPolicy
from app.models.contracts import (
    ActionCertificate,
    Approval,
    AuditEvent,
    CandidateAction,
    ChainTransaction,
    ConstitutionVersion,
    ErrorCode,
    ExecuteRequest,
    Execution,
    PolicyVerdict,
    SimulationConfig,
    SimulationRun,
    TrustedSimulationInput,
    VerificationResult,
)
from app.simulation.router import check_persisted_audit
from app.verifier.certificates import public_keys_from_environment, verify_integrity
from app.verifier.service import RuntimeSettings, chain_transaction, recompute

# Server-only recomputation seam; never selected by an HTTP request or planner.
Recheck = Callable[[TrustedSimulationInput], tuple[PolicyVerdict, SimulationRun]]


def invalid(message: str):
    raise DomainError(ErrorCode.INVALID_CERTIFICATE, message, 409)


def load_certificate(session: Session, body: ExecuteRequest, now: datetime):
    row = session.get(CertificateRecord, body.certificate_id)
    if row is None:
        invalid("Certificate not found")
    try:
        cert = ActionCertificate.model_validate(row.payload)
    except ValidationError:
        invalid("Stored certificate schema is invalid")
    result = verify_integrity(cert, public_keys_from_environment(), now=now)
    if result.status != "VALID":
        raise DomainError(
            ErrorCode.EXPIRED if result.status == "EXPIRED" else ErrorCode.INVALID_CERTIFICATE,
            "Certificate integrity or time check failed",
            409,
        )
    p = cert.payload
    if (row.id, row.action_id, row.constitution_id, row.nonce, row.certificate_hash) != (
        p.id,
        p.action.id,
        p.constitution_version,
        p.nonce,
        cert.certificate_hash,
    ) or p.action_digest != body.action_digest:
        invalid("Certificate/action binding mismatch")
    return row, cert


def load_authority(session: Session, row, cert, actor_id: str):
    p = cert.payload
    state = read_state(session, actor_id)
    if (
        state.snapshot.user_id != actor_id
        or state.id != row.state_id
        or state.snapshot.version != p.state_version
        or state.snapshot_hash != p.state_snapshot_hash
    ):
        raise DomainError(ErrorCode.STALE_STATE, "Financial state changed", 409)
    if state.active_constitution_version != p.constitution_version:
        raise DomainError(ErrorCode.STALE_POLICY, "Active Constitution changed", 409)
    state_row = session.get(FinancialStateRecord, state.id)
    if (state_row.user_id, state_row.version) != (actor_id, state.snapshot.version):
        raise DomainError(ErrorCode.UNAVAILABLE, "Trusted state metadata integrity failed")
    selected = list(session.scalars(select(SimulationConfigRecord).limit(2)))
    if len(selected) != 1 or selected[0].id != p.simulation.config.id:
        raise DomainError(
            ErrorCode.UNAVAILABLE,
            "Current trusted simulation configuration is ambiguous or changed",
        )
    policy_row = session.get(ConstitutionVersionRecord, p.constitution_version)
    config_row = session.get(SimulationConfigRecord, p.simulation.config.id)
    try:
        policy = ConstitutionVersion.model_validate(policy_row.payload)
        config = SimulationConfig.model_validate(config_row.payload)
        if (
            policy.id != policy_row.id
            or policy.user_id != policy_row.user_id
            or policy.user_id != actor_id
            or policy.confirmed_by != actor_id
            or policy.version != policy_row.version
            or policy.policy_digest != policy_row.policy_digest
            or digest(policy.rules) != policy.policy_digest
            or config.id != config_row.id
            or digest(config) != config_row.config_digest
        ):
            raise ValueError("Corrupt authority")
    except (AttributeError, ValueError, ValidationError):
        raise DomainError(ErrorCode.UNAVAILABLE, "Trusted policy/config integrity failed") from None
    if p.policy_digest != policy.policy_digest:
        raise DomainError(ErrorCode.STALE_POLICY, "Policy digest changed", 409)
    if p.simulation.config_digest != config_row.config_digest:
        invalid("Certificate uses a different trusted simulation configuration")
    rules, action = policy.rules, p.action
    if (
        action.chain_id != rules.allowed_chain_id
        or action.token_address not in rules.allowed_tokens
        or action.recipient in rules.blocked_recipients
        or (action.funding_source == "borrowed" and rules.borrowed_funding_forbidden)
    ):
        raise DomainError(ErrorCode.POLICY_DENIED, "Current hard policy refuses action", 403)
    required = (
        p.approval.required
        or action.amount_minor > rules.autonomy_limit_minor
        or action.recipient not in rules.known_recipients
    )
    return TrustedSimulationInput(
        state=state, constitution=policy, action=action, config=config
    ), required


def check_artifacts(session: Session, row, cert):
    p = cert.payload
    candidate_row = session.get(CandidateRecord, p.action.id)
    sim_row = session.get(SimulationRecord, p.simulation.id)
    verification_row = session.get(VerificationRecord, row.verification_id)
    try:
        candidate = CandidateAction.model_validate(candidate_row.payload)
        sim = SimulationRun.model_validate(sim_row.payload)
        verification = VerificationResult.model_validate(verification_row.payload)
        if (
            candidate != p.action
            or candidate_row.action_digest != p.action_digest
            or candidate_row.state_id != row.state_id
            or sim != p.simulation
            or sim_row.action_id != p.action.id
            or sim_row.state_id != row.state_id
            or sim_row.config_id != p.simulation.config.id
            or verification.id != verification_row.id
            or verification_row.action_id != p.action.id
            or verification_row.simulation_id != sim.id
            or verification_row.constitution_id != p.constitution_version
            or verification.action_id != p.action.id
            or verification.simulation_id != sim.id
            or verification.certificate_id != p.id
            or verification.verdict != p.verdict
        ):
            raise ValueError("Artifact binding mismatch")
    except (AttributeError, ValueError, ValidationError):
        invalid("Stored candidate/simulation/verification binding mismatch")


def utc_time(value):
    # SQLite DateTime does not preserve tzinfo; these server-written timestamps are UTC.
    return (
        None
        if value is None
        else value.replace(tzinfo=UTC)
        if value.tzinfo is None
        else value.astimezone(UTC)
    )


def check_approval(
    session: Session,
    cert,
    actor_id: str,
    required: bool,
    now: datetime,
    *,
    consumed_at: datetime | None = None,
):
    p = cert.payload
    row = session.scalar(select(ApprovalRecord).where(ApprovalRecord.certificate_id == p.id))
    if row is None and not required:
        return None
    try:
        approval = Approval.model_validate(row.payload)
        if (
            approval.id != row.id
            or approval.certificate_id != p.id
            or approval.actor_id != row.actor_id
            or approval.actor_id != actor_id
            or approval.decision != "APPROVE"
            or approval.action_digest != p.action_digest
            or approval.state_version != p.state_version
            or approval.constitution_version != p.constitution_version
            or utc_time(row.consumed_at) != consumed_at
            or approval.consumed_at != consumed_at
            or not p.issued_at <= approval.created_at <= now < p.expires_at
        ):
            raise ValueError("Approval mismatch")
    except (AttributeError, ValueError, ValidationError):
        raise DomainError(
            ErrorCode.APPROVAL_REQUIRED, "Matching unconsumed human approval required", 409
        ) from None
    return row


def check_recomputed(cert, trusted: TrustedSimulationInput, recheck: Recheck):
    try:
        verdict, simulation = recheck(trusted)
        verdict = PolicyVerdict.model_validate_json(verdict.model_dump_json())
        simulation = SimulationRun.model_validate_json(simulation.model_dump_json())
    except DomainError:
        raise
    except Exception:
        raise DomainError(ErrorCode.UNAVAILABLE, "Independent risk recheck unavailable") from None
    p = cert.payload
    # IDs and timestamps describe a particular run; every deterministic evidence
    # field, including sampled paths, must reproduce from the trusted seeded config.
    evidence_fields = {"id", "created_at"}
    if (
        verdict.decision == "DENY"
        or any(check.status == "FAIL" for check in verdict.checks)
        or verdict != p.verdict
        or simulation.model_dump(exclude=evidence_fields)
        != p.simulation.model_dump(exclude=evidence_fields)
        or simulation.metrics.goal_satisfaction_probability_bps
        < trusted.constitution.rules.goal_satisfaction_min_bps
        or simulation.metrics.reserve_breach_probability_bps
        > trusted.constitution.rules.reserve_breach_max_bps
        or sorted(stress.name for stress in simulation.stress_results)
        != ["emergency_expense", "fee_shock", "income_delay", "market_shock"]
        or any(not stress.passed or not stress.goal_funded for stress in simulation.stress_results)
    ):
        raise DomainError(ErrorCode.POLICY_DENIED, "Independent policy/risk evidence refused", 403)


def claim_execution(
    engine,
    body: ExecuteRequest,
    actor_id: str,
    *,
    policy: TestnetPolicy,
    recheck: Recheck | None = None,
) -> Execution:
    """Reserve authority once. Never resume/re-sign a claim using this function.

    No signer/RPC is called here. A missing trusted risk implementation refuses
    before any reservation; application wiring stays disabled until PF-015.
    """
    if engine.dialect.name not in ("sqlite", "postgresql"):
        raise DomainError(ErrorCode.UNAVAILABLE, "Executor serialization requires reviewed SQLite or PostgreSQL storage")
    body = ExecuteRequest.model_validate_json(body.model_dump_json())
    policy = TestnetPolicy.model_validate_json(policy.model_dump_json())
    try:
        with Session(engine) as session, session.begin():
            acquire_authority_lock(session)
            if session.get(UserHead, actor_id) is None:
                raise DomainError(ErrorCode.UNAUTHORIZED, "Authenticated user not initialized", 401)
            row, cert = load_certificate(session, body, datetime.now(UTC))
            # Replay rejection remains unconditional, including CLAIMED after a crash.
            if (
                session.scalar(
                    select(ExecutionRecord.id).where(
                        ExecutionRecord.certificate_id == body.certificate_id
                    )
                )
                is not None
            ):
                raise DomainError(ErrorCode.ALREADY_USED, "Certificate already claimed", 409)
            if (
                session.scalar(
                    select(ExecutionRecord.id).where(
                        ExecutionRecord.idempotency_key == body.idempotency_key
                    )
                )
                is not None
            ):
                raise DomainError(ErrorCode.CONFLICT, "Idempotency key already reserved", 409)
            trusted, required = load_authority(session, row, cert, actor_id)
            policy.validate_transaction(cert.payload.transaction)
            check_artifacts(session, row, cert)
            approval = check_approval(session, cert, actor_id, required, datetime.now(UTC))
            if recheck is None:
                unfinished("PF-029 trusted independent risk recheck")
            check_recomputed(cert, trusted, recheck)
            # Different certificates must not authorize a replacement at one wallet nonce.
            current = cert.payload.transaction
            for other in session.scalars(
                select(CertificateRecord).join(
                    ExecutionRecord, ExecutionRecord.certificate_id == CertificateRecord.id
                )
            ):
                try:
                    history = ActionCertificate.model_validate(other.payload)
                    integrity = verify_integrity(
                        history, public_keys_from_environment(), now=datetime.now(UTC)
                    )
                    previous_payload = history.payload
                    if (
                        not integrity.signature_valid
                        or integrity.status not in ("VALID", "EXPIRED")
                        or (
                            other.id,
                            other.action_id,
                            other.constitution_id,
                            other.nonce,
                            other.certificate_hash,
                        )
                        != (
                            previous_payload.id,
                            previous_payload.action.id,
                            previous_payload.constitution_version,
                            previous_payload.nonce,
                            history.certificate_hash,
                        )
                    ):
                        raise ValueError("Historical certificate binding mismatch")
                    previous = previous_payload.transaction
                except (ValidationError, ValueError):
                    raise DomainError(
                        ErrorCode.UNAVAILABLE, "Existing claim binding corrupt"
                    ) from None
                if (previous.chain_id, previous.sender, previous.nonce) == (
                    current.chain_id,
                    current.sender,
                    current.nonce,
                ):
                    raise DomainError(ErrorCode.CONFLICT, "Wallet nonce already reserved", 409)
            now = datetime.now(UTC)
            if now >= cert.payload.expires_at:
                raise DomainError(ErrorCode.EXPIRED, "Certificate expired during recheck", 409)
            execution = Execution(
                id="execution-" + str(uuid4()),
                certificate_id=cert.payload.id,
                status="CLAIMED",
                tx_hash=None,
                block_number=None,
                confirmations=0,
                error=None,
            )
            session.add(
                ExecutionRecord(
                    id=execution.id,
                    created_at=now,
                    certificate_id=cert.payload.id,
                    idempotency_key=body.idempotency_key,
                    status="CLAIMED",
                    tx_hash=None,
                    payload=execution.model_dump(mode="json"),
                )
            )
            if approval is not None:
                approved = Approval.model_validate(approval.payload)
                approval.consumed_at = now
                approval.payload = approved.model_copy(update={"consumed_at": now}).model_dump(
                    mode="json"
                )
            session.flush()
            append_event(
                session,
                actor=actor_id,
                event_type="EXECUTION_CLAIMED",
                artifact_digest=digest(execution),
                now=now,
                details={
                    "execution_id": execution.id,
                    "certificate_id": cert.payload.id,
                    "certificate_hash": cert.certificate_hash,
                    "action_digest": cert.payload.action_digest,
                    "chain_id": current.chain_id,
                    "sender": current.sender,
                    "chain_nonce": current.nonce,
                },
            )
            return execution
    except IntegrityError:
        raise DomainError(ErrorCode.CONFLICT, "Concurrent execution claim conflict", 409) from None


@dataclass(frozen=True)
class SignedAttempt:
    """Private, process-local result. Not an API/DB model or a broadcast receipt.

    PF-015 must durably preserve these exact bytes before any network send.
    If this result is lost, the permanent claim forbids signing it again.
    """

    execution: Execution
    raw_transaction: bytes = field(repr=False)


def validate_signed_bytes(raw: bytes, transaction: ChainTransaction):
    """Independently bind actual EIP-1559 bytes to every certified field."""
    try:
        if not isinstance(raw, bytes) or not raw or raw[0] != 2:
            raise ValueError("EIP-1559 bytes required")
        value = TypedTransaction.from_bytes(HexBytes(raw)).as_dict()
        if (
            Account.recover_transaction(raw).lower() != transaction.sender
            or value["chainId"] != transaction.chain_id
            or bytes(value["to"]).hex() != transaction.to[2:]
            or bytes(value["data"]).hex() != transaction.data[2:]
            or value["nonce"] != transaction.nonce
            or value["gas"] != transaction.gas_limit
            or value["maxFeePerGas"] != int(transaction.max_fee_per_gas_wei)
            or value["maxPriorityFeePerGas"] != int(transaction.max_priority_fee_per_gas_wei)
            or value["value"] != 0
            or value["accessList"]
        ):
            raise ValueError("Signed transaction differs from certificate")
    except Exception:
        raise DomainError(
            ErrorCode.INVALID_CERTIFICATE, "Signer output does not match the exact certificate", 409
        ) from None


def sign_authorized_once(
    engine, body: ExecuteRequest, actor_id: str, *, policy: TestnetPolicy
) -> SignedAttempt:
    """Internal one-attempt signing boundary. No HTTP entrypoint, broadcast or resume.

    The first transaction durably consumes authority BEFORE any signer invocation.
    The second holds the SQLite writer lock through fresh checks and signing.
    A crash/timeout/error after claiming leaves CLAIMED, never an automatic retry.
    Public execution stays disabled until PF-015 adds durable bytes and reconciliation.
    """
    body = ExecuteRequest.model_validate_json(body.model_dump_json())
    policy = TestnetPolicy.model_validate_json(policy.model_dump_json())
    execution = claim_execution(engine, body, actor_id, policy=policy, recheck=recompute)
    try:
        with Session(engine) as session, session.begin():
            acquire_authority_lock(session)
            claim = session.get(ExecutionRecord, execution.id)
            if (
                claim is None
                or claim.certificate_id != body.certificate_id
                or claim.idempotency_key != body.idempotency_key
                or claim.status != "CLAIMED"
                or claim.tx_hash is not None
                or claim.payload != execution.model_dump(mode="json")
            ):
                invalid("Durable signing claim binding mismatch")
            row, cert = load_certificate(session, body, datetime.now(UTC))
            trusted, required = load_authority(session, row, cert, actor_id)
            check_artifacts(session, row, cert)
            claimed_at = utc_time(claim.created_at)
            if claimed_at is None or not cert.payload.issued_at <= claimed_at <= datetime.now(UTC):
                invalid("Durable claim time is invalid")
            check_approval(
                session, cert, actor_id, required, datetime.now(UTC), consumed_at=claimed_at
            )
            check_recomputed(cert, trusted, recompute)
            check_persisted_audit(session, cert.payload.simulation, actor_id)
            events = [
                AuditEvent.model_validate(a.payload) for a in session.scalars(select(AuditRecord))
            ]
            claims = [
                a
                for a in events
                if a.event_type == "EXECUTION_CLAIMED"
                and a.details.get("execution_id") == execution.id
            ]
            if len(claims) != 1 or (
                claims[0].actor != actor_id
                or claims[0].artifact_digest != digest(execution)
                or claims[0].created_at != claimed_at
                or claims[0].details.get("certificate_id") != cert.payload.id
                or claims[0].details.get("certificate_hash") != cert.certificate_hash
                or claims[0].details.get("action_digest") != cert.payload.action_digest
            ):
                invalid("Durable claim audit binding mismatch")
            transaction = policy.validate_transaction(cert.payload.transaction)
            fresh = chain_transaction(cert.payload.action, RuntimeSettings())
            if fresh != transaction:
                invalid("Live transaction fields changed since issuance")
            # No other trusted writer can change heads while this lock is held.
            load_certificate(session, body, datetime.now(UTC))
            signer = LocalTestnetSigner.from_environment(policy)
            raw = signer.sign(transaction)
            validate_signed_bytes(raw, transaction)
            load_certificate(session, body, datetime.now(UTC))
            append_event(
                session,
                actor=actor_id,
                event_type="EXECUTION_SIGNED",
                artifact_digest=sha256(raw).hexdigest(),
                now=datetime.now(UTC),
                details={"execution_id": execution.id, "certificate_id": cert.payload.id},
            )
            return SignedAttempt(execution=execution, raw_transaction=raw)
    except DomainError:
        raise
    except Exception:
        raise DomainError(
            ErrorCode.UNAVAILABLE,
            "Signing attempt unavailable; preserve the claim and do not retry",
        ) from None
