"""Deterministic individual stresses against a segregated synthetic cash ledger.

This computes scenarios, not real-world probabilities. It never activates a
policy/config, liquidates risk assets to manufacture goal funding, or signs.
"""

from dataclasses import dataclass

from app.core.canonical import digest
from app.models.contracts import StressResult, TrustedSimulationInput


@dataclass(frozen=True)
class Projection:
    liquidity_path_minor: tuple[int, ...]
    risky_value_minor: int
    terminal_value_minor: int
    goal_funded: bool
    obligations_funded: bool
    reserve_breached: bool


def validated_input(value: TrustedSimulationInput) -> TrustedSimulationInput:
    value = TrustedSimulationInput.model_validate_json(value.model_dump_json())
    state, policy, config = value.state, value.constitution, value.config
    if (
        digest(state.snapshot) != state.snapshot_hash
        or digest(policy.rules) != policy.policy_digest
        or state.snapshot.user_id != policy.user_id
        or policy.confirmed_by != policy.user_id
        or state.active_constitution_version != policy.id
    ):
        raise ValueError("Trusted state/policy binding mismatch")
    for collection in (
        state.snapshot.assets,
        state.snapshot.obligations,
        state.snapshot.recurring_expenses,
        state.snapshot.expected_income,
    ):
        ids = [item.id for item in collection]
        if len(ids) != len(set(ids)):
            raise ValueError("Duplicate ledger entity ID")
    for expense in state.snapshot.recurring_expenses:
        if len(expense.due_days) != len(set(expense.due_days)):
            raise ValueError("Duplicate recurring expense day")
    goals = [
        item for item in state.snapshot.obligations if item.id == state.snapshot.goal.obligation_id
    ]
    if len(goals) != 1 or not goals[0].protected or goals[0].due_day > config.horizon_days:
        raise ValueError("Simulation horizon must include the protected goal due date")
    return value


def project_ledger(
    value: TrustedSimulationInput,
    *,
    market_loss_bps: int = 0,
    income_delay_days: int = 0,
    emergency_day: int | None = None,
    emergency_amount_minor: int = 0,
    fee_multiplier: int = 1,
) -> Projection:
    value = validated_input(value)
    if (
        type(market_loss_bps) is not int
        or not 0 <= market_loss_bps <= 10000
        or type(income_delay_days) is not int
        or income_delay_days < 0
        or type(emergency_amount_minor) is not int
        or emergency_amount_minor < 0
        or type(fee_multiplier) is not int
        or fee_multiplier < 1
        or (
            emergency_day is not None
            and (
                type(emergency_day) is not int
                or not 1 <= emergency_day <= value.config.horizon_days
            )
        )
    ):
        raise ValueError("Invalid deterministic shock parameters")
    snapshot, action, rules = value.state.snapshot, value.action, value.constitution.rules
    cash = sum(
        asset.amount_minor for asset in snapshot.assets if asset.liquid and not asset.high_risk
    )
    risky = sum(asset.amount_minor for asset in snapshot.assets if asset.high_risk)
    other_assets = sum(
        asset.amount_minor for asset in snapshot.assets if not asset.liquid and not asset.high_risk
    )
    cash -= action.amount_minor + value.config.fee_minor * fee_multiplier
    if action.action_type == "TEST_TOKEN_ALLOCATION":
        risky += action.amount_minor
    risky = risky * (10000 - market_loss_bps) // 10000
    protected_remaining = sum(item.amount_minor for item in snapshot.obligations if item.protected)
    goal_remaining = next(
        item.amount_minor for item in snapshot.obligations if item.id == snapshot.goal.obligation_id
    )
    goal_funded = False
    obligations_funded = True

    def required_cash():
        tuition = max(goal_remaining, rules.tuition_reserve_minor) if goal_remaining else 0
        return rules.emergency_floor_minor + protected_remaining - goal_remaining + tuition

    reserve_breached = cash < required_cash()
    cash_path = [cash]
    for day in range(1, value.config.horizon_days + 1):
        # Declared income arrives before same-day scheduled outflows.
        cash += sum(
            income.amount_minor
            for income in snapshot.expected_income
            if income.due_day + income_delay_days == day
        )
        if emergency_day == day:
            cash -= emergency_amount_minor
        recurring = sum(
            expense.amount_minor
            for expense in snapshot.recurring_expenses
            if day in expense.due_days
        )
        due = [item for item in snapshot.obligations if item.due_day == day]
        total_due = recurring + sum(item.amount_minor for item in due)
        if any(item.id == snapshot.goal.obligation_id for item in due):
            # Conservative: all same-day expenses must be fundable, not just tuition.
            goal_funded = cash >= total_due
        if cash < total_due:
            obligations_funded = False
        cash -= total_due
        paid_today = sum(item.amount_minor for item in due if item.protected)
        protected_remaining -= paid_today
        if any(item.id == snapshot.goal.obligation_id for item in due):
            goal_remaining = 0
        reserve_breached |= cash < required_cash()
        cash_path.append(cash)
    return Projection(
        tuple(cash_path),
        risky,
        cash + risky + other_assets,
        goal_funded,
        obligations_funded,
        reserve_breached,
    )


def run_stresses(value: TrustedSimulationInput) -> list[StressResult]:
    value = validated_input(value)
    # Individual scenarios. Day 1 emergency is an explicit conservative choice;
    # it is an additional future shock, even after a realized expense in state.
    scenarios = [
        ("market_shock", {"market_loss_bps": 3000}, {"market_loss_bps": 3000, "shock_day": 1}),
        ("income_delay", {"income_delay_days": 30}, {"income_delay_days": 30}),
        (
            "emergency_expense",
            {"emergency_day": 1, "emergency_amount_minor": 200000},
            {
                "emergency_day": 1,
                "emergency_expense_minor": 200000,
                "additional_to_realized_expense": "yes",
            },
        ),
        ("fee_shock", {"fee_multiplier": 3}, {"fee_multiplier": 3}),
    ]
    results = []
    for name, arguments, parameters in scenarios:
        projection = project_ledger(value, **arguments)
        results.append(
            StressResult(
                name=name,
                parameters={
                    **parameters,
                    "evaluation": "individual",
                    "risky_terminal_value_minor": projection.risky_value_minor,
                },
                passed=(
                    projection.goal_funded
                    and projection.obligations_funded
                    and not projection.reserve_breached
                ),
                minimum_liquidity_minor=min(projection.liquidity_path_minor),
                goal_funded=projection.goal_funded,
            )
        )
    return results
