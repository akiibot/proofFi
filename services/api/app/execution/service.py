"""Private durable signing handoff and one-attempt dispatch; no HTTP entrypoint.

PENDING means dispatch was reserved, including an ambiguous or stranded attempt.
A computed hash is never evidence of broadcast, receipt or confirmation.
"""

from datetime import UTC, datetime
from hashlib import sha256
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session
from web3 import Web3

from app.audit.append import append_event
from app.core.canonical import digest
from app.core.errors import DomainError
from app.db.models import AuditRecord, ExecutionEnvelopeRecord, ExecutionRecord
from app.execution import gate
from app.execution.rpc import BroadcastUncertain, EvmGateway, hash_hex
from app.execution.signer import TestnetPolicy
from app.models.contracts import AuditEvent, ErrorCode, ExecuteRequest, Execution
from app.verifier.service import RuntimeSettings, chain_transaction, recompute


def _require_recovered_ledger(session, execution_id=None):
    """No new dispatch while an observed execution needs accounting recovery."""
    for row in session.scalars(select(ExecutionRecord)):
        execution = Execution.model_validate(row.payload)
        if (
            row.id != execution.id
            or row.certificate_id != execution.certificate_id
            or row.status != execution.status
            or row.tx_hash != execution.tx_hash
        ):
            gate.invalid("Execution recovery metadata mismatch")
        if execution.error is not None or (
            execution.id != execution_id and execution.status in ("PENDING", "REORGED")
        ):
            raise DomainError(
                ErrorCode.CONFLICT,
                "Reconcile existing execution and ledger recovery before another signing or dispatch",
                409,
            )


def _checked_claim(session, body, actor_id, policy, execution_id, status):
    """Repeat independent authority and audit checks; caller holds SQLite writer lock."""
    _require_recovered_ledger(session, execution_id)
    claim = session.get(ExecutionRecord, execution_id)
    if claim is None:
        gate.invalid("Execution claim not found")
    execution = Execution.model_validate(claim.payload)
    if (
        claim.id != execution.id
        or claim.certificate_id != body.certificate_id
        or execution.certificate_id != claim.certificate_id
        or claim.idempotency_key != body.idempotency_key
        or claim.status != status
        or execution.status != status
        or claim.tx_hash != execution.tx_hash
        or execution.block_number is not None
        or execution.confirmations != 0
        or execution.error is not None
        or (status == "CLAIMED" and execution.tx_hash is not None)
    ):
        gate.invalid("Durable execution claim binding mismatch")
    row, cert = gate.load_certificate(session, body, datetime.now(UTC))
    trusted, required = gate.load_authority(session, row, cert, actor_id)
    gate.check_artifacts(session, row, cert)
    claimed_at = gate.utc_time(claim.created_at)
    if claimed_at is None or not cert.payload.issued_at <= claimed_at <= datetime.now(UTC):
        gate.invalid("Durable claim time is invalid")
    gate.check_approval(
        session, cert, actor_id, required, datetime.now(UTC), consumed_at=claimed_at
    )
    gate.check_recomputed(cert, trusted, recompute)
    gate.check_persisted_audit(session, cert.payload.simulation, actor_id)
    events = [AuditEvent.model_validate(a.payload) for a in session.scalars(select(AuditRecord))]
    original = execution.model_copy(update={"status": "CLAIMED", "tx_hash": None})
    claimed = [
        event
        for event in events
        if event.event_type == "EXECUTION_CLAIMED"
        and event.details.get("execution_id") == execution_id
    ]
    if len(claimed) != 1 or (
        claimed[0].actor != actor_id
        or claimed[0].artifact_digest != digest(original)
        or claimed[0].created_at != claimed_at
        or claimed[0].details.get("certificate_id") != cert.payload.id
        or claimed[0].details.get("certificate_hash") != cert.certificate_hash
        or claimed[0].details.get("action_digest") != cert.payload.action_digest
    ):
        gate.invalid("Claim audit binding mismatch")
    transaction = policy.validate_transaction(cert.payload.transaction)
    gate.load_certificate(session, body, datetime.now(UTC))
    return claim, execution, cert, transaction, events


def _require_event(events, kind, execution_id, actor_id, artifact, certificate_id):
    selected = [
        event
        for event in events
        if event.event_type == kind and event.details.get("execution_id") == execution_id
    ]
    if len(selected) != 1 or (
        selected[0].actor != actor_id
        or selected[0].artifact_digest != artifact
        or selected[0].details.get("certificate_id") != certificate_id
    ):
        gate.invalid("Private execution audit binding mismatch")
    return selected[0]


def _checked_envelope(session, execution, transaction, events, actor_id):
    envelope = session.scalar(
        select(ExecutionEnvelopeRecord).where(ExecutionEnvelopeRecord.execution_id == execution.id)
    )
    if envelope is None:
        gate.invalid("Signed execution envelope unavailable; never re-sign this claim")
    raw = envelope.raw_transaction
    gate.validate_signed_bytes(raw, transaction)
    expected = hash_hex(Web3.keccak(raw))
    if expected != envelope.transaction_hash or (
        execution.tx_hash is not None and execution.tx_hash != expected
    ):
        gate.invalid("Signed execution hash binding mismatch")
    _require_event(
        events,
        "EXECUTION_SIGNED",
        execution.id,
        actor_id,
        sha256(raw).hexdigest(),
        execution.certificate_id,
    )
    _require_event(
        events,
        "EXECUTION_ENVELOPE_STORED",
        execution.id,
        actor_id,
        sha256(raw).hexdigest(),
        execution.certificate_id,
    )
    return raw, expected


def persist_signed_attempt(
    engine,
    body: ExecuteRequest,
    actor_id: str,
    *,
    policy: TestnetPolicy,
    attempt: gate.SignedAttempt,
) -> Execution:
    """Persist actual bytes only after binding them to a genuine committed signing audit."""
    body = ExecuteRequest.model_validate_json(body.model_dump_json())
    policy = TestnetPolicy.model_validate_json(policy.model_dump_json())
    try:
        with Session(engine) as session, session.begin():
            session.connection().exec_driver_sql("BEGIN IMMEDIATE")
            _, execution, cert, transaction, events = _checked_claim(
                session, body, actor_id, policy, attempt.execution.id, "CLAIMED"
            )
            if execution != attempt.execution:
                gate.invalid("Signed attempt differs from durable claim")
            raw = attempt.raw_transaction
            if not isinstance(raw, bytes) or not 1 <= len(raw) <= 4096:
                gate.invalid("Signed execution envelope outside storage bound")
            gate.validate_signed_bytes(raw, transaction)
            _require_event(
                events,
                "EXECUTION_SIGNED",
                execution.id,
                actor_id,
                sha256(raw).hexdigest(),
                cert.payload.id,
            )
            session.add(
                ExecutionEnvelopeRecord(
                    id="envelope-" + str(uuid4()),
                    execution_id=execution.id,
                    raw_transaction=raw,
                    transaction_hash=hash_hex(Web3.keccak(raw)),
                )
            )
            session.flush()
            append_event(
                session,
                actor=actor_id,
                event_type="EXECUTION_ENVELOPE_STORED",
                artifact_digest=sha256(raw).hexdigest(),
                now=datetime.now(UTC),
                details={"execution_id": execution.id, "certificate_id": cert.payload.id},
            )
            return execution
    except DomainError:
        raise
    except Exception:
        raise DomainError(
            ErrorCode.UNAVAILABLE, "Signed envelope unavailable; preserve claim and never re-sign"
        ) from None


def prepare_execution(engine, body: ExecuteRequest, actor_id: str, *, policy: TestnetPolicy):
    """One signing attempt, then one durable handoff. A lost handoff strands the claim."""
    with Session(engine) as session:
        _require_recovered_ledger(session)
    # The precheck avoids unnecessary claims; the serialized handoff/dispatch
    # repeats it so a recovery conflict racing signing can never reach a send.
    attempt = gate.sign_authorized_once(engine, body, actor_id, policy=policy)
    return persist_signed_attempt(engine, body, actor_id, policy=policy, attempt=attempt)


def broadcast_once(
    engine, body: ExecuteRequest, actor_id: str, *, policy: TestnetPolicy, execution_id: str
) -> Execution:
    """Reserve dispatch before RPC. Repeated calls never send or sign again.

    A crash after reservation may mean no send occurred. Reconciliation must query
    this exact hash; this entrypoint never rebroadcasts, replaces or clears claims.
    """
    body = ExecuteRequest.model_validate_json(body.model_dump_json())
    policy = TestnetPolicy.model_validate_json(policy.model_dump_json())
    try:
        with Session(engine) as session, session.begin():
            session.connection().exec_driver_sql("BEGIN IMMEDIATE")
            claim, execution, _, transaction, events = _checked_claim(
                session, body, actor_id, policy, execution_id, "CLAIMED"
            )
            _, expected = _checked_envelope(session, execution, transaction, events, actor_id)
            pending = execution.model_copy(update={"status": "PENDING", "tx_hash": expected})
            claim.status, claim.tx_hash = "PENDING", expected
            claim.payload = pending.model_dump(mode="json")
            append_event(
                session,
                actor=actor_id,
                event_type="EXECUTION_DISPATCH_RESERVED",
                artifact_digest=digest(pending),
                now=datetime.now(UTC),
                details={
                    "execution_id": execution_id,
                    "certificate_id": execution.certificate_id,
                    "tx_hash": expected,
                },
            )
        # Reservation and bytes have committed before ANY send. Hold a fresh writer
        # lock through live checks/send so trusted writers cannot change authority.
        with Session(engine) as session, session.begin():
            session.connection().exec_driver_sql("BEGIN IMMEDIATE")
            _, execution, cert, transaction, events = _checked_claim(
                session, body, actor_id, policy, execution_id, "PENDING"
            )
            raw, expected = _checked_envelope(session, execution, transaction, events, actor_id)
            _require_event(
                events,
                "EXECUTION_DISPATCH_RESERVED",
                execution_id,
                actor_id,
                digest(execution),
                execution.certificate_id,
            )
            settings = RuntimeSettings()
            if chain_transaction(cert.payload.action, settings) != transaction:
                gate.invalid("Live transaction fields changed before dispatch")
            gateway = EvmGateway.from_rpc_url(settings.rpc_url.get_secret_value(), policy)
            gate.load_certificate(session, body, datetime.now(UTC))
            acknowledged = gateway.broadcast(raw)
            if acknowledged != expected:
                raise BroadcastUncertain(expected)
            return execution
    except DomainError:
        raise
    except Exception:
        raise DomainError(
            ErrorCode.UNAVAILABLE, "Dispatch unavailable; reconcile stored hash and never re-sign"
        ) from None
