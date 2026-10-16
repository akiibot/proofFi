"""Deterministic Constitution evaluation over trusted, canonical inputs."""

from app.core.canonical import digest
from app.models.contracts import (
    PolicyVerdict,
    RuleOutcome,
    SimulationRun,
    TrustedSimulationInput,
)


def _outcome(
    rule: str,
    status: str,
    reason_code: str,
    **measured: int | str | bool,
) -> RuleOutcome:
    return RuleOutcome(
        rule=rule,
        status=status,
        reason_code=reason_code,
        measured=measured,
    )


def _validated(
    value: TrustedSimulationInput, simulation: SimulationRun
) -> tuple[TrustedSimulationInput, SimulationRun]:
    value = TrustedSimulationInput.model_validate_json(value.model_dump_json())
    simulation = SimulationRun.model_validate_json(simulation.model_dump_json())
    state, policy = value.state, value.constitution
    if (
        digest(state.snapshot) != state.snapshot_hash
        or digest(policy.rules) != policy.policy_digest
        or state.snapshot.user_id != policy.user_id
        or policy.confirmed_by != policy.user_id
        or state.active_constitution_version != policy.id
        or simulation.action_id != value.action.id
        or simulation.state_snapshot_hash != state.snapshot_hash
        or simulation.config != value.config
        or simulation.config_digest != digest(value.config)
    ):
        raise ValueError("Trusted policy evaluation binding mismatch")
    return value, simulation


def evaluate(value: TrustedSimulationInput, simulation: SimulationRun) -> PolicyVerdict:
    """Evaluate all policy families; human approval cannot override a hard failure."""

    value, simulation = _validated(value, simulation)
    snapshot = value.state.snapshot
    action = value.action
    rules = value.constitution.rules

    liquid_minor = sum(
        asset.amount_minor for asset in snapshot.assets if asset.liquid and not asset.high_risk
    )
    owned_assets_minor = sum(asset.amount_minor for asset in snapshot.assets)
    existing_high_risk_minor = sum(
        asset.amount_minor for asset in snapshot.assets if asset.high_risk
    )
    action_cost_minor = action.amount_minor + value.config.fee_minor
    post_action_liquid_minor = liquid_minor - action_cost_minor

    goal = next(
        (item for item in snapshot.obligations if item.id == snapshot.goal.obligation_id), None
    )
    if goal is None or not goal.protected:
        raise ValueError("Protected goal obligation missing")
    other_protected_minor = sum(
        item.amount_minor
        for item in snapshot.obligations
        if item.protected and item.id != goal.id
    )
    tuition_required_minor = max(goal.amount_minor, rules.tuition_reserve_minor)
    protected_required_minor = tuition_required_minor + other_protected_minor

    checks: list[RuleOutcome] = []
    tuition_pass = post_action_liquid_minor >= protected_required_minor
    checks.append(
        _outcome(
            "tuition_reserve",
            "PASS" if tuition_pass else "FAIL",
            "TUITION_RESERVE_PRESERVED" if tuition_pass else "TUITION_RESERVE_VIOLATION",
            post_action_liquid_minor=post_action_liquid_minor,
            protected_required_minor=protected_required_minor,
        )
    )

    available_after_protection_minor = post_action_liquid_minor - protected_required_minor
    floor_pass = available_after_protection_minor >= rules.emergency_floor_minor
    checks.append(
        _outcome(
            "emergency_floor",
            "PASS" if floor_pass else "FAIL",
            "EMERGENCY_FLOOR_PRESERVED" if floor_pass else "EMERGENCY_FLOOR_VIOLATION",
            available_after_protection_minor=available_after_protection_minor,
            emergency_floor_minor=rules.emergency_floor_minor,
        )
    )

    approval_amount = action.amount_minor > rules.autonomy_limit_minor
    checks.append(
        _outcome(
            "autonomy_limit",
            "REQUIRES_APPROVAL" if approval_amount else "PASS",
            "ABOVE_AUTONOMY_LIMIT" if approval_amount else "WITHIN_AUTONOMY_LIMIT",
            action_amount_minor=action.amount_minor,
            autonomy_limit_minor=rules.autonomy_limit_minor,
        )
    )

    if action.recipient in rules.blocked_recipients:
        counterparty_status, counterparty_reason = "FAIL", "BLOCKED_RECIPIENT"
    elif action.recipient in rules.known_recipients:
        counterparty_status, counterparty_reason = "PASS", "KNOWN_RECIPIENT"
    else:
        counterparty_status, counterparty_reason = (
            "REQUIRES_APPROVAL",
            "NEW_RECIPIENT_APPROVAL_REQUIRED",
        )
    checks.append(
        _outcome(
            "counterparty",
            counterparty_status,
            counterparty_reason,
            recipient=action.recipient,
            recipient_known=action.recipient in rules.known_recipients,
            recipient_blocked=action.recipient in rules.blocked_recipients,
        )
    )

    chain_allowed = action.chain_id == rules.allowed_chain_id
    token_allowed = action.token_address in rules.allowed_tokens
    allowlist_pass = chain_allowed and token_allowed
    if not chain_allowed:
        allowlist_reason = "CHAIN_NOT_ALLOWED"
    elif not token_allowed:
        allowlist_reason = "TOKEN_NOT_ALLOWED"
    else:
        allowlist_reason = "ASSET_AND_CHAIN_ALLOWED"
    checks.append(
        _outcome(
            "asset_chain_allowlist",
            "PASS" if allowlist_pass else "FAIL",
            allowlist_reason,
            chain_id=action.chain_id,
            chain_allowed=chain_allowed,
            token_address=action.token_address,
            token_allowed=token_allowed,
        )
    )

    disposable_minor = max(
        0, owned_assets_minor - tuition_required_minor - rules.emergency_floor_minor
    )
    resulting_high_risk_minor = existing_high_risk_minor + (
        action.amount_minor if action.action_type == "TEST_TOKEN_ALLOCATION" else 0
    )
    concentration_bps = (
        0
        if resulting_high_risk_minor == 0
        else 10000
        if disposable_minor == 0
        else (resulting_high_risk_minor * 10000 + disposable_minor - 1) // disposable_minor
    )
    concentration_pass = (
        resulting_high_risk_minor * 10000
        <= rules.high_risk_concentration_bps * disposable_minor
    )
    checks.append(
        _outcome(
            "high_risk_concentration",
            "PASS" if concentration_pass else "FAIL",
            "CONCENTRATION_WITHIN_LIMIT"
            if concentration_pass
            else "HIGH_RISK_CONCENTRATION_EXCEEDED",
            disposable_minor=disposable_minor,
            resulting_high_risk_minor=resulting_high_risk_minor,
            concentration_bps=concentration_bps,
            concentration_limit_bps=rules.high_risk_concentration_bps,
        )
    )

    goal_bps = simulation.metrics.goal_satisfaction_probability_bps
    goal_pass = goal_bps >= rules.goal_satisfaction_min_bps
    checks.append(
        _outcome(
            "goal_satisfaction_probability",
            "PASS" if goal_pass else "FAIL",
            "GOAL_PROBABILITY_MEETS_MINIMUM"
            if goal_pass
            else "GOAL_PROBABILITY_BELOW_MINIMUM",
            goal_satisfaction_probability_bps=goal_bps,
            required_minimum_bps=rules.goal_satisfaction_min_bps,
        )
    )

    reserve_bps = simulation.metrics.reserve_breach_probability_bps
    reserve_pass = reserve_bps <= rules.reserve_breach_max_bps
    checks.append(
        _outcome(
            "reserve_breach_probability",
            "PASS" if reserve_pass else "FAIL",
            "RESERVE_RISK_WITHIN_MAXIMUM"
            if reserve_pass
            else "RESERVE_BREACH_RISK_EXCEEDED",
            reserve_breach_probability_bps=reserve_bps,
            allowed_maximum_bps=rules.reserve_breach_max_bps,
        )
    )

    borrowed = action.funding_source == "borrowed"
    funding_pass = not (borrowed and rules.borrowed_funding_forbidden)
    checks.append(
        _outcome(
            "funding_source",
            "PASS" if funding_pass else "FAIL",
            "OWNED_FUNDING" if funding_pass else "BORROWED_FUNDING_FORBIDDEN",
            funding_source=action.funding_source,
            borrowed_funding_forbidden=rules.borrowed_funding_forbidden,
        )
    )

    if any(check.status == "FAIL" for check in checks):
        decision = "DENY"
    elif any(check.status == "REQUIRES_APPROVAL" for check in checks):
        decision = "REQUIRES_APPROVAL"
    else:
        decision = "PASS"
    return PolicyVerdict(decision=decision, checks=checks)
