"""Deterministic policy boundaries over trusted state and simulation evidence."""

from datetime import UTC, datetime

import pytest
from app.core.canonical import digest
from app.db.seed import baseline
from app.models.contracts import (
    CandidateAction,
    ConstitutionRules,
    ConstitutionVersion,
    ExpectedIncome,
    FinancialState,
    SimulationConfig,
    SimulationMetrics,
    SimulationRun,
    TrustedSimulationInput,
)
from app.policy.engine import evaluate

TOKEN = "0x" + "1" * 40
RECIPIENT = "0x" + "2" * 40
UNKNOWN = "0x" + "3" * 40
NOW = datetime(2026, 10, 16, tzinfo=UTC)


@pytest.fixture
def evidence():
    snapshot = baseline()
    rules = ConstitutionRules(allowed_tokens=[TOKEN], known_recipients=[RECIPIENT])
    policy = ConstitutionVersion(
        id="policy-v1",
        user_id="demo-user",
        version=1,
        rules=rules,
        policy_digest=digest(rules),
        confirmed_at=NOW,
        confirmed_by="demo-user",
    )
    action = CandidateAction(
        id="candidate-1",
        action_type="TEST_TOKEN_ALLOCATION",
        amount_minor=10000,
        chain_id=84532,
        token_address=TOKEN,
        recipient=RECIPIENT,
        funding_source="owned",
        planner_reason_untrusted="test fixture",
        planner_mode="deterministic_demo",
    )
    config = SimulationConfig(
        id="config-v1",
        model_version="model-v1",
        daily_volatility_bps=0,
        income_delay_probability_bps=0,
        emergency_probability_bps=0,
        fee_minor=100,
        model_assumptions=["isolated policy fixture"],
    )
    state = FinancialState(
        id="state-v1",
        snapshot=snapshot,
        snapshot_hash=digest(snapshot),
        active_constitution_version=policy.id,
    )
    trusted = TrustedSimulationInput(
        state=state, constitution=policy, action=action, config=config
    )
    simulation = SimulationRun(
        id="simulation-1",
        action_id=action.id,
        state_snapshot_hash=state.snapshot_hash,
        config=config,
        config_digest=digest(config),
        metrics=SimulationMetrics(
            goal_satisfaction_probability_bps=9500,
            reserve_breach_probability_bps=500,
            p05_terminal_liquidity_minor=0,
            expected_terminal_value_minor=0,
        ),
        stress_results=[],
        sampled_liquidity_paths_minor=[],
        created_at=NOW,
    )
    return trusted, simulation


def changed(evidence, *, action=None, rules=None, metrics=None, snapshot=None):
    trusted, simulation = evidence
    if action is not None:
        trusted = trusted.model_copy(update={"action": action})
        simulation = simulation.model_copy(update={"action_id": action.id})
    if rules is not None:
        policy = trusted.constitution.model_copy(
            update={"rules": rules, "policy_digest": digest(rules)}
        )
        trusted = trusted.model_copy(update={"constitution": policy})
    if snapshot is not None:
        state = trusted.state.model_copy(
            update={"snapshot": snapshot, "snapshot_hash": digest(snapshot)}
        )
        trusted = trusted.model_copy(update={"state": state})
        simulation = simulation.model_copy(update={"state_snapshot_hash": state.snapshot_hash})
    if metrics is not None:
        simulation = simulation.model_copy(update={"metrics": metrics})
    return trusted, simulation


def outcome(verdict, rule):
    return next(check for check in verdict.checks if check.rule == rule)


def test_all_policy_families_pass_at_inclusive_boundaries(evidence):
    verdict = evaluate(*evidence)
    assert verdict.decision == "PASS"
    assert [check.rule for check in verdict.checks] == [
        "tuition_reserve",
        "emergency_floor",
        "autonomy_limit",
        "counterparty",
        "asset_chain_allowlist",
        "high_risk_concentration",
        "goal_satisfaction_probability",
        "reserve_breach_probability",
        "funding_source",
    ]
    assert all(check.status == "PASS" for check in verdict.checks)


def test_autonomy_boundary_requires_approval_only_above_limit(evidence):
    trusted, simulation = evidence
    at = trusted.action.model_copy(update={"amount_minor": 15000})
    above = trusted.action.model_copy(update={"amount_minor": 15001})
    assert outcome(evaluate(*changed(evidence, action=at)), "autonomy_limit").status == "PASS"
    verdict = evaluate(*changed(evidence, action=above))
    assert verdict.decision == "REQUIRES_APPROVAL"
    assert outcome(verdict, "autonomy_limit").reason_code == "ABOVE_AUTONOMY_LIMIT"


def test_new_recipient_requires_approval_and_blocked_recipient_denies(evidence):
    trusted, _ = evidence
    unknown = trusted.action.model_copy(update={"recipient": UNKNOWN})
    verdict = evaluate(*changed(evidence, action=unknown))
    assert verdict.decision == "REQUIRES_APPROVAL"
    assert outcome(verdict, "counterparty").reason_code == "NEW_RECIPIENT_APPROVAL_REQUIRED"
    rules = trusted.constitution.rules.model_copy(
        update={"known_recipients": [], "blocked_recipients": [UNKNOWN]}
    )
    verdict = evaluate(*changed(evidence, action=unknown, rules=rules))
    assert verdict.decision == "DENY"
    assert outcome(verdict, "counterparty").reason_code == "BLOCKED_RECIPIENT"


def test_unknown_token_denies_and_invalid_chain_fails_input_validation(evidence):
    trusted, _ = evidence
    action = trusted.action.model_copy(update={"token_address": "0x" + "4" * 40})
    verdict = evaluate(*changed(evidence, action=action))
    assert outcome(verdict, "asset_chain_allowlist").reason_code == "TOKEN_NOT_ALLOWED"
    invalid = trusted.action.model_construct(**{**trusted.action.model_dump(), "chain_id": 1})
    with pytest.raises(Exception):
        evaluate(*changed(evidence, action=invalid))


def test_concentration_uses_exact_disposable_assets_boundary(evidence):
    trusted, _ = evidence
    at = trusted.action.model_copy(update={"amount_minor": 75000})
    above = trusted.action.model_copy(update={"amount_minor": 75001})
    at_check = outcome(evaluate(*changed(evidence, action=at)), "high_risk_concentration")
    above_check = outcome(evaluate(*changed(evidence, action=above)), "high_risk_concentration")
    assert at_check.status == "PASS" and at_check.measured["disposable_minor"] == 300000
    assert above_check.status == "FAIL" and above_check.measured["concentration_bps"] == 2501


def test_projected_income_does_not_inflate_disposable_denominator(evidence):
    trusted, _ = evidence
    income = ExpectedIncome(
        id="future-income",
        name="isolated assumption",
        amount_minor=9_000_000,
        due_day=1,
    )
    snapshot = trusted.state.snapshot.model_copy(update={"expected_income": [income]})
    action = trusted.action.model_copy(update={"amount_minor": 75001})
    check = outcome(
        evaluate(*changed(evidence, action=action, snapshot=snapshot)),
        "high_risk_concentration",
    )
    assert check.status == "FAIL" and check.measured["disposable_minor"] == 300000


def test_transfer_does_not_create_owned_high_risk_position(evidence):
    trusted, _ = evidence
    action = trusted.action.model_copy(update={"action_type": "TRANSFER", "amount_minor": 75001})
    check = outcome(evaluate(*changed(evidence, action=action)), "high_risk_concentration")
    assert check.status == "PASS" and check.measured["resulting_high_risk_minor"] == 0


@pytest.mark.parametrize(
    "amount,status",
    [(499900, "PASS"), (499901, "FAIL")],
)
def test_tuition_reserve_boundary(evidence, amount, status):
    trusted, _ = evidence
    action = trusted.action.model_copy(update={"amount_minor": amount})
    assert outcome(evaluate(*changed(evidence, action=action)), "tuition_reserve").status == status


@pytest.mark.parametrize(
    "amount,status",
    [(299900, "PASS"), (299901, "FAIL")],
)
def test_emergency_floor_boundary_without_double_counting_tuition(evidence, amount, status):
    trusted, _ = evidence
    action = trusted.action.model_copy(update={"amount_minor": amount})
    check = outcome(evaluate(*changed(evidence, action=action)), "emergency_floor")
    assert check.status == status
    assert check.measured["emergency_floor_minor"] == 200000


def test_other_protected_obligation_remains_segregated(evidence):
    from app.models.contracts import Obligation

    trusted, _ = evidence
    other = Obligation(
        id="protected-other",
        name="Other protected",
        amount_minor=100000,
        due_day=20,
        protected=True,
    )
    snapshot = trusted.state.snapshot.model_copy(
        update={"obligations": [*trusted.state.snapshot.obligations, other]}
    )
    action = trusted.action.model_copy(update={"amount_minor": 299900})
    check = outcome(
        evaluate(*changed(evidence, action=action, snapshot=snapshot)), "emergency_floor"
    )
    assert check.status == "FAIL"
    assert check.measured["available_after_protection_minor"] == 100000


def test_monte_carlo_thresholds_are_inclusive_and_one_bps_fail(evidence):
    _, simulation = evidence
    goal_fail = simulation.metrics.model_copy(update={"goal_satisfaction_probability_bps": 9499})
    reserve_fail = simulation.metrics.model_copy(update={"reserve_breach_probability_bps": 501})
    assert outcome(
        evaluate(*changed(evidence, metrics=goal_fail)), "goal_satisfaction_probability"
    ).status == "FAIL"
    assert outcome(
        evaluate(*changed(evidence, metrics=reserve_fail)), "reserve_breach_probability"
    ).status == "FAIL"


def test_borrowed_funding_is_hard_denial(evidence):
    trusted, _ = evidence
    action = trusted.action.model_copy(update={"funding_source": "borrowed"})
    verdict = evaluate(*changed(evidence, action=action))
    assert verdict.decision == "DENY"
    assert outcome(verdict, "funding_source").reason_code == "BORROWED_FUNDING_FORBIDDEN"


def test_hard_failure_overrides_approval_requirement(evidence):
    trusted, _ = evidence
    action = trusted.action.model_copy(update={"amount_minor": 15001, "recipient": UNKNOWN})
    rules = trusted.constitution.rules.model_copy(
        update={"known_recipients": [], "blocked_recipients": [UNKNOWN]}
    )
    verdict = evaluate(*changed(evidence, action=action, rules=rules))
    assert verdict.decision == "DENY"
    assert outcome(verdict, "autonomy_limit").status == "REQUIRES_APPROVAL"
    assert outcome(verdict, "counterparty").status == "FAIL"


@pytest.mark.parametrize("corruption", ["state", "policy", "simulation", "config"])
def test_trusted_binding_corruption_fails_closed(evidence, corruption):
    trusted, simulation = evidence
    if corruption == "state":
        trusted = trusted.model_copy(
            update={"state": trusted.state.model_copy(update={"snapshot_hash": "f" * 64})}
        )
    elif corruption == "policy":
        trusted = trusted.model_copy(
            update={
                "constitution": trusted.constitution.model_copy(
                    update={"policy_digest": "f" * 64}
                )
            }
        )
    elif corruption == "simulation":
        simulation = simulation.model_copy(update={"action_id": "different"})
    else:
        simulation = simulation.model_copy(update={"config_digest": "f" * 64})
    with pytest.raises(ValueError, match="binding mismatch"):
        evaluate(trusted, simulation)
