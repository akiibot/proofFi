"""Exact pre-optimization arithmetic evidence; all inputs are isolated fixtures."""

import json
from pathlib import Path

import pytest
from app.core.canonical import digest
from app.models.contracts import StateSnapshot
from app.simulation.engine import simulate
from test_pf_007 import evidence as evidence

CASES = [
    "funded",
    "realized_expense",
    "delayed_income",
    "simultaneous_dues",
    "volatile_assets",
    "first_supported_day",
    "early_goal",
    "last_supported_day",
]


def simulation_input(evidence, case):
    value, _ = evidence
    snapshot = value.state.snapshot.model_dump(mode="json")
    snapshot["assets"][0]["amount_minor"] += 500000
    config = value.config.model_copy(
        update={
            "model_version": "pf-monte-carlo-v1",
            "seed": 18421,
            "path_count": 257,
            "horizon_days": 120,
            "daily_volatility_bps": 200,
            "income_delay_probability_bps": 5000,
            "emergency_probability_bps": 2000,
        }
    )
    if case == "realized_expense":
        snapshot["assets"][0]["amount_minor"] -= 200000
        snapshot["realized_expense_minor"] = 200000
        snapshot["version"] = 2
    elif case == "delayed_income":
        snapshot["expected_income"] = [
            {"id": "z-late", "name": "After delay horizon", "amount_minor": 12345, "due_day": 91},
            {"id": "a-first", "name": "Early income", "amount_minor": 200000, "due_day": 1},
            {"id": "m-edge", "name": "Horizon income", "amount_minor": 9876, "due_day": 120},
        ]
    elif case == "simultaneous_dues":
        snapshot["obligations"] += [
            {
                "id": "protected",
                "name": "Protected bill",
                "amount_minor": 10000,
                "due_day": 30,
                "protected": True,
            },
            {
                "id": "other",
                "name": "Other bill",
                "amount_minor": 1007,
                "due_day": 120,
                "protected": False,
            },
        ]
        snapshot["recurring_expenses"].append(
            {
                "id": "other-cost",
                "name": "Other costs",
                "amount_minor": 123,
                "due_days": [1, 30, 120],
            }
        )
    elif case == "volatile_assets":
        snapshot["assets"] += [
            {
                "id": "risk",
                "asset": "RISK_DEMO",
                "amount_minor": 123456,
                "liquid": False,
                "high_risk": True,
            },
            {
                "id": "other",
                "asset": "OTHER_DEMO",
                "amount_minor": 78901,
                "liquid": False,
                "high_risk": False,
            },
        ]
        config = config.model_copy(update={"daily_volatility_bps": 5000})
    elif case == "first_supported_day":
        config = config.model_copy(update={"horizon_days": 1})
        snapshot["obligations"][0]["due_day"] = 1
    elif case == "early_goal":
        config = config.model_copy(update={"horizon_days": 60})
        snapshot["obligations"][0]["due_day"] = 30
    elif case == "last_supported_day":
        config = config.model_copy(update={"horizon_days": 366})
        snapshot["obligations"][0]["due_day"] = 366
        snapshot["recurring_expenses"][0]["due_days"] = [30, 60, 90, 366]
    snapshot = StateSnapshot.model_validate(snapshot)
    state = value.state.model_copy(update={"snapshot": snapshot, "snapshot_hash": digest(snapshot)})
    return value.model_copy(
        update={
            "state": state,
            "config": config,
            "action": value.action.model_copy(update={"amount_minor": 200000}),
        }
    )


@pytest.mark.parametrize("case", CASES)
def test_exact_prechange_simulation_outputs(evidence, case):
    golden = json.loads((Path(__file__).parent / "fixtures" / "pf_044_simulation.json").read_text())
    result = simulate(simulation_input(evidence, case))
    # Includes all sampled cash-path points, every metric and all four stress results.
    assert (
        digest(result.model_dump(mode="json", exclude={"id", "created_at"}))
        == golden["cases"][case]["digest"]
    )
    assert result.metrics.model_dump() == golden["cases"][case]["metrics"]
    assert len(result.sampled_liquidity_paths_minor) == 20
    assert len(result.stress_results) == 4
