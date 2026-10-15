"""Deterministic cash-flow stresses; explicit inputs are isolated assumptions."""

from importlib import import_module

import pytest
from app.core.canonical import digest
from app.db.seed import baseline
from app.models.contracts import (
    ConstitutionRules,
    ConstitutionVersion,
    ExpectedIncome,
    FinancialState,
    TrustedSimulationInput,
)
from test_pf_012 import NOW
from test_pf_012 import payload as payload


def module():
    import pkgutil

    import app.simulation as simulation

    assert "stress" in [x.name for x in pkgutil.iter_modules(simulation.__path__)], (
        "Named stress engine missing"
    )
    return import_module("app.simulation.stress")


@pytest.fixture
def trusted(payload):
    state = baseline()
    rules = ConstitutionRules(
        allowed_tokens=[payload.action.token_address], known_recipients=[payload.action.recipient]
    )
    policy = ConstitutionVersion(
        id="stress-policy",
        user_id="demo-user",
        version=1,
        rules=rules,
        policy_digest=digest(rules),
        confirmed_at=NOW,
        confirmed_by="demo-user",
    )
    return TrustedSimulationInput(
        state=FinancialState(
            id="stress-state",
            snapshot=state,
            snapshot_hash=digest(state),
            active_constitution_version=policy.id,
        ),
        constitution=policy,
        action=payload.action,
        config=payload.simulation.config.model_copy(update={"fee_minor": 100}),
    )


def change_state(trusted, **updates):
    snapshot = trusted.state.snapshot.model_copy(update=updates)
    return trusted.model_copy(
        update={
            "state": trusted.state.model_copy(
                update={"snapshot": snapshot, "snapshot_hash": digest(snapshot)}
            )
        }
    )


def test_exact_individual_shocks_and_baseline_shortfall(trusted):
    results = module().run_stresses(trusted)
    assert [r.name for r in results] == [
        "market_shock",
        "income_delay",
        "emergency_expense",
        "fee_shock",
    ]
    by = {r.name: r for r in results}
    assert by["market_shock"].parameters["market_loss_bps"] == 3000
    assert by["income_delay"].parameters["income_delay_days"] == 30
    assert by["emergency_expense"].parameters["emergency_expense_minor"] == 200000
    assert by["fee_shock"].parameters["fee_multiplier"] == 3
    assert by["market_shock"].minimum_liquidity_minor == 169900
    assert by["income_delay"].minimum_liquidity_minor == 169900
    assert by["emergency_expense"].minimum_liquidity_minor == -30100
    assert by["fee_shock"].minimum_liquidity_minor == 169700
    assert not any(r.passed for r in results)
    assert by["market_shock"].goal_funded
    assert not by["emergency_expense"].goal_funded


def test_cash_flow_pays_all_due_days_and_segregates_unpaid_tuition(trusted):
    projection = module().project_ledger(trusted)
    assert len(projection.liquidity_path_minor) == 121
    assert projection.liquidity_path_minor[0] == 1189900
    assert projection.liquidity_path_minor[29] == 1189900
    assert projection.liquidity_path_minor[30] == 1109900
    assert projection.liquidity_path_minor[90] == 949900
    assert projection.liquidity_path_minor[120] == 169900
    assert projection.goal_funded and projection.reserve_breached
    assert projection.terminal_value_minor == 179900


def test_income_delayed_past_horizon_cannot_fund_goal(trusted):
    income = ExpectedIncome(
        id="explicit-test-income", name="ISOLATED ASSUMPTION", amount_minor=300000, due_day=100
    )
    inp = change_state(trusted, expected_income=[income])
    by = {r.name: r for r in module().run_stresses(inp)}
    assert by["market_shock"].passed
    assert not by["income_delay"].passed
    assert by["income_delay"].minimum_liquidity_minor == 169900
    assert by["market_shock"].minimum_liquidity_minor == 469900


def test_income_on_payment_day_arrives_before_outflows(trusted):
    income = ExpectedIncome(
        id="day-120-income", name="ISOLATED ASSUMPTION", amount_minor=100000, due_day=120
    )
    inp = change_state(trusted, expected_income=[income])
    projection = module().project_ledger(inp)
    assert projection.liquidity_path_minor[120] == 269900
    assert projection.goal_funded and not projection.reserve_breached


def test_market_shock_changes_risky_value_without_liquidating_for_goal(trusted):
    normal = module().project_ledger(trusted)
    shocked = module().project_ledger(trusted, market_loss_bps=3000)
    assert normal.liquidity_path_minor == shocked.liquidity_path_minor
    assert shocked.terminal_value_minor == normal.terminal_value_minor - 3000
    assert shocked.risky_value_minor == 7000


def test_realized_emergency_is_not_deducted_twice_and_future_stress_is_additional(trusted):
    assets = [trusted.state.snapshot.assets[0].model_copy(update={"amount_minor": 1000000})]
    inp = change_state(trusted, assets=assets, realized_expense_minor=200000)
    normal = module().project_ledger(inp)
    stress = {r.name: r for r in module().run_stresses(inp)}["emergency_expense"]
    assert normal.liquidity_path_minor[0] == 989900
    assert stress.minimum_liquidity_minor == -230100
    assert stress.parameters["additional_to_realized_expense"] == "yes"
    assert stress.parameters["emergency_day"] == 1


def test_tuition_stays_segregated_before_due_date_even_with_late_income(trusted):
    # Future income cannot cure a current reserve breach.
    income = ExpectedIncome(id="late", name="ISOLATED ASSUMPTION", amount_minor=300000, due_day=120)
    assets = [trusted.state.snapshot.assets[0].model_copy(update={"amount_minor": 850000})]
    inp = change_state(trusted, assets=assets, expected_income=[income])
    p = module().project_ledger(inp)
    assert p.goal_funded and p.reserve_breached


def test_transfer_is_outflow_and_does_not_create_owned_investment_value(trusted):
    inp = trusted.model_copy(
        update={"action": trusted.action.model_copy(update={"action_type": "TRANSFER"})}
    )
    p = module().project_ledger(inp)
    assert p.risky_value_minor == 0 and p.terminal_value_minor == 169900


@pytest.mark.parametrize(
    "corruption", ["state_hash", "policy_hash", "goal_horizon", "duplicate_days", "duplicate_ids"]
)
def test_invalid_trusted_ledger_is_rejected(trusted, corruption):
    if corruption == "state_hash":
        inp = trusted.model_copy(
            update={"state": trusted.state.model_copy(update={"snapshot_hash": "f" * 64})}
        )
    elif corruption == "policy_hash":
        inp = trusted.model_copy(
            update={
                "constitution": trusted.constitution.model_copy(update={"policy_digest": "f" * 64})
            }
        )
    elif corruption == "goal_horizon":
        inp = trusted.model_copy(
            update={"config": trusted.config.model_copy(update={"horizon_days": 119})}
        )
    elif corruption == "duplicate_days":
        expense = trusted.state.snapshot.recurring_expenses[0].model_copy(
            update={"due_days": [30, 30]}
        )
        inp = change_state(trusted, recurring_expenses=[expense])
    else:
        inp = change_state(
            trusted, assets=[*trusted.state.snapshot.assets, *trusted.state.snapshot.assets]
        )
    with pytest.raises(ValueError):
        module().run_stresses(inp)


def test_stresses_are_reproducible_and_do_not_mutate_inputs(trusted):
    before = trusted.model_dump(mode="json")
    assert module().run_stresses(trusted) == module().run_stresses(trusted)
    assert trusted.model_dump(mode="json") == before


def test_other_protected_payment_cannot_release_tuition_reserve(trusted):
    from app.models.contracts import Obligation

    income = ExpectedIncome(
        id="later-income", name="ISOLATED ASSUMPTION", amount_minor=500000, due_day=30
    )
    other = Obligation(
        id="other-protected",
        name="Other protected payment",
        amount_minor=100000,
        due_day=1,
        protected=True,
    )
    inp = change_state(
        trusted, obligations=[*trusted.state.snapshot.obligations, other], expected_income=[income]
    )
    policy = inp.constitution
    rules = policy.rules.model_copy(update={"tuition_reserve_minor": 900000})
    inp = inp.model_copy(
        update={
            "constitution": policy.model_copy(
                update={"rules": rules, "policy_digest": digest(rules)}
            )
        }
    )
    p = module().project_ledger(inp)
    assert p.goal_funded
    assert p.reserve_breached  # day0 requires $9000 tuition + $1000 other + $2000 floor
