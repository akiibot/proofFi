"""Atomic realized outflow and fresh proposal; no execution authority."""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy.orm import Session

from app.audit.append import append_event
from app.core.canonical import digest
from app.core.errors import DomainError
from app.db.models import ConstitutionVersionRecord
from app.db.state import append_state, read_state
from app.models.contracts import (
    CandidateAction,
    EmergencyRequest,
    EmergencyResponse,
    ErrorCode,
    StateSnapshot,
)
from app.optimizer.chain import ChainSettings, load_chain_bounds
from app.optimizer.service import optimize
from app.policy.service import checked_version
from app.verifier.service import load_trusted


def record_emergency(engine, body: EmergencyRequest, actor: str):
    body = EmergencyRequest.model_validate_json(body.model_dump_json())
    if engine.dialect.name != "sqlite":
        raise DomainError(ErrorCode.UNAVAILABLE, "Emergency updates support SQLite only")
    with Session(engine) as session, session.begin():
        session.connection().exec_driver_sql("BEGIN IMMEDIATE")
        try:
            old = read_state(session, actor)
            if old.snapshot.version != body.expected_state_version:
                raise DomainError(ErrorCode.CONFLICT, "Financial state version conflict", 409)
            if old.active_constitution_version is None:
                raise DomainError(ErrorCode.UNAVAILABLE, "Confirmed Constitution required")
            policy = checked_version(
                session.get(ConstitutionVersionRecord, old.active_constitution_version), actor
            )
            operational = ChainSettings()
            # A new recipient is an unapproved proposal, not a hard prohibition.
            # Verification/execution still enforce its exact approval requirement.
            if (
                policy.rules.allowed_chain_id != 84532
                or operational.test_token_address not in policy.rules.allowed_tokens
                or operational.approved_recipient in policy.rules.blocked_recipients
            ):
                raise DomainError(
                    ErrorCode.POLICY_DENIED,
                    "Configured demo destination or asset is not permitted by policy",
                    403,
                )
            action = CandidateAction(
                id="emergency-" + str(uuid4()),
                action_type="TEST_TOKEN_ALLOCATION",
                amount_minor=1,
                chain_id=84532,
                token_address=operational.test_token_address,
                recipient=operational.approved_recipient,
                funding_source="owned",
                planner_reason_untrusted="Recalculate after a realized emergency expense",
                planner_mode="deterministic_demo",
            )
            trusted = load_trusted(session, action, actor)
            remaining = body.amount_minor
            assets = []
            for asset in old.snapshot.assets:
                debit = (
                    min(asset.amount_minor, remaining)
                    if asset.liquid and not asset.high_risk
                    else 0
                )
                assets.append(asset.model_copy(update={"amount_minor": asset.amount_minor - debit}))
                remaining -= debit
            if remaining:
                raise DomainError(
                    ErrorCode.POLICY_DENIED, "Insufficient spendable cash for expense", 409
                )
            # Preserve the scenario clock and schedules; the realized debit is not a future obligation.
            snapshot = StateSnapshot.model_validate(
                {
                    **old.snapshot.model_dump(),
                    "version": old.snapshot.version + 1,
                    "assets": assets,
                    "realized_expense_minor": old.snapshot.realized_expense_minor
                    + body.amount_minor,
                }
            )
            fresh = append_state(session, snapshot, body.expected_state_version)
            optimization = optimize(
                trusted.model_copy(update={"state": fresh}), load_chain_bounds(action)
            )
            append_event(
                session,
                actor=actor,
                event_type="EMERGENCY_EXPENSE_RECORDED",
                artifact_digest=digest(fresh),
                now=datetime.now(UTC),
                details={
                    "previous_state_id": old.id,
                    "state_id": fresh.id,
                    "previous_state_version": old.snapshot.version,
                    "state_version": fresh.snapshot.version,
                    "amount_minor": body.amount_minor,
                    "policy_digest": policy.policy_digest,
                    "config_digest": digest(trusted.config),
                    "optimization_digest": digest(optimization),
                    "old_authorization_stale": True,
                },
            )
            return EmergencyResponse(state=fresh, optimization=optimization)
        except DomainError:
            raise
        except Exception:
            raise DomainError(
                ErrorCode.UNAVAILABLE, "Emergency recalculation unavailable; update rolled back"
            ) from None
