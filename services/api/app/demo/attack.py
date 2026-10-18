"""Controlled rejection evidence using the real verifier and executor claim boundary."""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from app.audit.append import append_event
from app.core.canonical import digest
from app.core.errors import DomainError
from app.db.postgres import acquire_authority_lock
from app.execution.gate import claim_execution
from app.execution.router import operational_policy
from app.models.contracts import ActionRequest, ApiError, AttackResponse, ErrorCode, ExecuteRequest
from app.planner.attack_fixture import malicious_proposal
from app.verifier.service import recompute, verify_action


def run_attack(engine, actor: str) -> AttackResponse:
    policy = operational_policy()
    candidate = malicious_proposal(policy.token_address, policy.recipient)
    verification = verify_action(engine, ActionRequest(action=candidate), actor)
    if verification.verdict.decision != "DENY" or verification.certificate_id is not None:
        raise DomainError(
            ErrorCode.UNAVAILABLE, "Unsafe fixture was not denied; executor probe stopped"
        )
    # A denial has no certificate. This is explicitly an attacker-supplied nonexistent
    # identity, not an invented issued certificate, signature, approval or tx hash.
    probe = ExecuteRequest(
        certificate_id="unissued-attack-" + str(uuid4()),
        action_digest=digest(candidate),
        idempotency_key="attack-probe-" + str(uuid4()),
    )
    try:
        # Exercise the production independent executor authorization boundary. It
        # cannot sign/send even if a regression unexpectedly accepts the claim.
        claim_execution(engine, probe, actor, policy=policy, recheck=recompute)
    except DomainError as exc:
        if exc.code != ErrorCode.INVALID_CERTIFICATE:
            raise
        refusal = ApiError(code=exc.code, message=exc.message)
    else:
        raise DomainError(ErrorCode.UNAVAILABLE, "Executor did not reject missing authority")
    result = AttackResponse(
        candidate=candidate,
        verification=verification,
        execution_error=refusal,
        signer_called=False,
        tx_hash=None,
    )
    with Session(engine) as session, session.begin():
        acquire_authority_lock(session)
        append_event(
            session,
            actor=actor,
            event_type="ATTACK_EXECUTOR_REJECTED",
            artifact_digest=digest(result),
            now=datetime.now(UTC),
            details={
                "action_id": candidate.id,
                "verification_id": verification.id,
                "simulation_id": verification.simulation_id,
                "attempted_unissued_certificate_id": probe.certificate_id,
                "executor_error_code": refusal.code.value,
                "planner_mode": candidate.planner_mode,
                "signer_called": False,
            },
        )
    return result
