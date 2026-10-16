"""Seeded scenario arithmetic, never calibrated financial forecasts."""

from datetime import UTC, datetime
from uuid import uuid4

import numpy as np

from app.core.canonical import digest
from app.models.contracts import SimulationMetrics, SimulationRun, TrustedSimulationInput
from app.simulation.stress import run_stresses, validated_input


def simulate(trusted: TrustedSimulationInput) -> SimulationRun:
    value = validated_input(trusted)
    config, snapshot, rules = value.config, value.state.snapshot, value.constitution.rules
    count, horizon = config.path_count, config.horizon_days
    if config.model_version != "pf-monte-carlo-v1" or count * horizon > 12_100_000:
        raise ValueError("Unsupported simulation model or workload")
    ledger_size = (
        1
        + len(snapshot.expected_income)
        + len(snapshot.obligations)
        + sum(len(item.due_days) + 1 for item in snapshot.recurring_expenses)
    )
    if (
        len(snapshot.assets) > 1000
        or ledger_size > 1000
        or count * horizon * ledger_size > 12_100_000
    ):
        raise ValueError("Simulation ledger workload exceeds supported limit")
    streams = [
        np.random.Generator(np.random.PCG64(seed))
        for seed in np.random.SeedSequence(config.seed).spawn(4)
    ]
    incomes = sorted(snapshot.expected_income, key=lambda item: item.id)
    goal = next(item for item in snapshot.obligations if item.id == snapshot.goal.obligation_id)
    protected = sum(item.amount_minor for item in snapshot.obligations if item.protected)
    initial_cash = (
        sum(item.amount_minor for item in snapshot.assets if item.liquid and not item.high_risk)
        - value.action.amount_minor
        - config.fee_minor
    )
    initial_risky = sum(item.amount_minor for item in snapshot.assets if item.high_risk)
    if value.action.action_type == "TEST_TOKEN_ALLOCATION":
        initial_risky += value.action.amount_minor
    other = sum(
        item.amount_minor for item in snapshot.assets if not item.liquid and not item.high_risk
    )
    terminals, totals, samples = [], [], []
    successes = breaches = 0
    # Each stream consumes path-major samples, independent of candidate amount/ID.
    for start in range(0, count, 256):
        size = min(256, count - start)
        returns = streams[0].normal(0, config.daily_volatility_bps / 10000, (size, horizon))
        delays = (
            streams[1].integers(0, 10000, (size, len(incomes)))
            < config.income_delay_probability_bps
        )
        emergencies = streams[2].integers(0, 10000, size) < config.emergency_probability_bps
        days = streams[3].integers(1, horizon + 1, size)
        for index in range(size):
            cash, risky = initial_cash, initial_risky
            remaining, goal_remaining = protected, goal.amount_minor
            required = (
                rules.emergency_floor_minor
                + remaining
                - goal_remaining
                + max(goal_remaining, rules.tuition_reserve_minor)
            )
            breached = cash < required
            funded = False
            path = [cash]
            for day in range(1, horizon + 1):
                next_risky = risky * max(0.0, 1 + float(returns[index, day - 1]))
                if not np.isfinite(next_risky) or next_risky > 9_000_000_000_000:
                    raise ValueError("Simulated risky value outside supported range")
                risky = int(np.floor(next_risky))
                cash += sum(
                    item.amount_minor
                    for j, item in enumerate(incomes)
                    if item.due_day + 30 * int(delays[index, j]) == day
                )
                if emergencies[index] and days[index] == day:
                    cash -= config.emergency_expense_minor
                due = [item for item in snapshot.obligations if item.due_day == day]
                costs = sum(item.amount_minor for item in due) + sum(
                    item.amount_minor
                    for item in snapshot.recurring_expenses
                    if day in item.due_days
                )
                if goal.due_day == day:
                    funded = cash >= costs
                    goal_remaining = 0
                cash -= costs
                remaining -= sum(item.amount_minor for item in due if item.protected)
                tuition = max(goal_remaining, rules.tuition_reserve_minor) if goal_remaining else 0
                breached |= (
                    cash < rules.emergency_floor_minor + remaining - goal_remaining + tuition
                )
                path.append(cash)
            successes += int(funded)
            breaches += int(breached)
            terminals.append(cash)
            totals.append(cash + risky + other)
            if len(samples) < 20:
                samples.append(path)
    return SimulationRun(
        id="sim-" + str(uuid4()),
        action_id=value.action.id,
        state_snapshot_hash=value.state.snapshot_hash,
        config=config,
        config_digest=digest(config),
        metrics=SimulationMetrics(
            goal_satisfaction_probability_bps=successes * 10000 // count,
            reserve_breach_probability_bps=(breaches * 10000 + count - 1) // count,
            p05_terminal_liquidity_minor=sorted(terminals)[(count - 1) * 5 // 100],
            expected_terminal_value_minor=sum(totals) // count,
        ),
        stress_results=run_stresses(value),
        sampled_liquidity_paths_minor=samples,
        created_at=datetime.now(UTC),
    )
