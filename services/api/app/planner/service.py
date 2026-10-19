"""Untrusted candidate proposals; no verification, consent, signing or execution."""

import re

from sqlalchemy.orm import Session

from app.core.canonical import digest
from app.core.errors import DomainError
from app.db.models import ConstitutionVersionRecord, FinancialStateRecord
from app.db.state import read_state
from app.models.contracts import (
    CandidateAction,
    ConstitutionVersion,
    ErrorCode,
    ParsedIntent,
    PlanResponse,
)
from app.planner.provider import PlannerSettings, Proposal, vertex_proposal


def plan(engine, actor: str, goal: str, *, parse_only=False, proposal_provider=None):
    try:
        settings = (
            PlannerSettings()
            if proposal_provider is None
            else PlannerSettings(planner_mode="live_llm", demo_mode=False)
        )
        with Session(engine) as session:
            state = read_state(session, actor)
            row = session.get(FinancialStateRecord, state.id)
            if (row.user_id, row.version, state.snapshot.user_id) != (
                actor,
                state.snapshot.version,
                actor,
            ):
                raise ValueError("State metadata mismatch")
            policy = None
            if state.active_constitution_version is not None:
                stored = session.get(ConstitutionVersionRecord, state.active_constitution_version)
                policy = ConstitutionVersion.model_validate(stored.payload)
                if (
                    policy.id,
                    policy.user_id,
                    policy.confirmed_by,
                    policy.version,
                    policy.policy_digest,
                ) != (stored.id, actor, actor, stored.version, stored.policy_digest) or digest(
                    policy.rules
                ) != policy.policy_digest:
                    raise ValueError("Policy binding mismatch")
        obligation = next(
            (
                item
                for item in state.snapshot.obligations
                if item.id == state.snapshot.goal.obligation_id and item.protected
            ),
            None,
        )
        if obligation is None:
            raise ValueError("Protected goal missing")
        # Only synthetic planning context is sent; never cookies, credentials, keys or raw rows.
        context = {
            "obligation": {
                "id": obligation.id,
                "name": obligation.name,
                "amount_minor": obligation.amount_minor,
                "due_day": obligation.due_day,
            },
            "liquid_minor": sum(
                a.amount_minor for a in state.snapshot.assets if a.liquid and not a.high_risk
            ),
            "income_assumptions": [
                {"amount_minor": i.amount_minor, "due_day": i.due_day}
                for i in state.snapshot.expected_income
            ],
            "policy_confirmed": policy is not None,
        }
        if proposal_provider is not None:
            proposal = proposal_provider(goal, context, settings)
        elif settings.planner_mode == "deterministic_demo":
            if not settings.demo_mode:
                raise DomainError(ErrorCode.UNAVAILABLE, "Deterministic planner requires demo mode")
            recognized = bool(re.search(r"\b(invest|investment|allocate)\b", goal, re.I))
            proposal = Proposal(
                obligation_id=obligation.id if recognized else None,
                ambiguities=[]
                if recognized
                else ["Do you want to maximize investment while protecting tuition?"],
                amounts_minor=[1] if recognized else [],
                reason="Explicit deterministic demo proposal; not verified safe.",
            )
        else:
            proposal = vertex_proposal(goal, context, settings)
        ambiguities = list(proposal.ambiguities)
        if proposal.obligation_id != obligation.id:
            ambiguities.append("Confirm which protected tuition obligation this goal concerns.")
        if parse_only:
            return ParsedIntent(
                objective="maximize_investment_subject_to_policies",
                obligation_id=obligation.id if proposal.obligation_id == obligation.id else None,
                ambiguities=ambiguities,
            )
        if policy is None:
            ambiguities.append(
                "Confirm a Financial Constitution before generating investment candidates."
            )
        token, recipient = settings.test_token_address, settings.approved_recipient
        if not token or not recipient:
            ambiguities.append(
                "Configure an approved demo token and recipient before generating candidates."
            )
        elif policy and (
            token not in policy.rules.allowed_tokens or recipient in policy.rules.blocked_recipients
        ):
            ambiguities.append(
                "The configured token or recipient is not permitted by the confirmed policy."
            )
        if ambiguities:
            return PlanResponse(
                mode=settings.planner_mode,
                candidates=[],
                clarification=list(dict.fromkeys(ambiguities)),
            )
        if not proposal.amounts_minor:
            return PlanResponse(
                mode=settings.planner_mode,
                candidates=[],
                clarification=["Specify the investment proposal more clearly."],
            )
        candidates = []
        for amount in dict.fromkeys(proposal.amounts_minor):
            identifier = "candidate-" + digest(
                {
                    "state": state.snapshot_hash,
                    "policy": policy.policy_digest,
                    "goal": goal,
                    "mode": settings.planner_mode,
                    "model": proposal._provider_model or settings.model_for("reasoning")
                    if settings.planner_mode == "live_llm"
                    else "demo-v1",
                    "amount_minor": amount,
                    "token": token,
                    "recipient": recipient,
                    "reason": proposal.reason,
                }
            )
            candidates.append(
                CandidateAction(
                    id=identifier,
                    action_type="TEST_TOKEN_ALLOCATION",
                    amount_minor=amount,
                    chain_id=84532,
                    token_address=token,
                    recipient=recipient,
                    funding_source="owned",
                    planner_reason_untrusted=proposal.reason,
                    planner_mode=settings.planner_mode,
                )
            )
        return PlanResponse(mode=settings.planner_mode, candidates=candidates, clarification=[])
    except DomainError:
        raise
    except (ValueError, AttributeError, OverflowError):
        raise DomainError(
            ErrorCode.UNAVAILABLE, "Trusted planner context unavailable or invalid"
        ) from None
