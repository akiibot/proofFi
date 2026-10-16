"""Largest compliant cent amount under the current cash-only simulation model.

For fixed state/config, each extra cent reduces every cash path by exactly one
cent. Risk assets are never liquidated; concentration can only increase. Thus
all hard financial checks are downward closed. Approval is not a hard failure.
This computes proposals, never certificates, approval, gas estimates or signing.
"""

from dataclasses import dataclass

from app.core.canonical import digest
from app.core.errors import DomainError
from app.models.contracts import ErrorCode, OptimizerResult, TrustedSimulationInput
from app.policy.engine import evaluate
from app.simulation.engine import simulate
from app.simulation.stress import validated_input


@dataclass(frozen=True)
class ChainBounds:
    token_balance_minor: int
    native_balance_wei: int
    gas_limit: int
    max_fee_per_gas_wei: int

    def validate(self):
        values = (
            self.token_balance_minor,
            self.native_balance_wei,
            self.gas_limit,
            self.max_fee_per_gas_wei,
        )
        if any(type(value) is not int or value < 0 for value in values):
            raise ValueError("Invalid trusted chain bounds")
        if not 21000 <= self.gas_limit <= 1000000 or self.max_fee_per_gas_wei == 0:
            raise ValueError("Invalid trusted gas/fee ceiling")


def optimize(trusted: TrustedSimulationInput, chain: ChainBounds) -> OptimizerResult:
    value = validated_input(trusted)
    chain.validate()
    if value.config.model_version != "pf-monte-carlo-v1":
        return OptimizerResult(
            status="NON_MONOTONIC_FEASIBILITY",
            action=None,
            max_amount_minor=0,
            verifier_calls=0,
            limiting_checks=["UNSUPPORTED_MODEL"],
            next_cent_rejected=False,
        )
    snapshot = value.state.snapshot
    liquid = sum(a.amount_minor for a in snapshot.assets if a.liquid and not a.high_risk)
    # Limit workload across all search evaluations, not just each simulation.
    ledger_size = (
        1
        + len(snapshot.expected_income)
        + len(snapshot.obligations)
        + sum(len(e.due_days) + 1 for e in snapshot.recurring_expenses)
    )
    calls = 0

    def check(amount):
        nonlocal calls
        candidate = value.action.model_copy(update={"amount_minor": amount})
        current = value.model_copy(update={"action": candidate})
        calls += 1
        if amount > 9_000_000_000_000:
            return ["AMOUNT_CONTRACT_LIMIT"]
        try:
            simulation = simulate(current)
            verdict = evaluate(current, simulation)
        except DomainError:
            raise
        except Exception:
            raise DomainError(
                ErrorCode.UNAVAILABLE, "Independent policy/simulation check unavailable"
            ) from None
        reasons = [c.reason_code for c in verdict.checks if c.status == "FAIL"]
        reasons += [
            "STRESS_" + s.name.upper()
            for s in simulation.stress_results
            if not s.passed or not s.goal_funded
        ]
        if amount > chain.token_balance_minor:
            reasons.append("CHAIN_TOKEN_BALANCE")
        if chain.native_balance_wei < chain.gas_limit * chain.max_fee_per_gas_wei:
            reasons.append("CHAIN_GAS_BALANCE")
        return list(dict.fromkeys(reasons))

    upper = max(
        0, min(liquid - value.config.fee_minor, chain.token_balance_minor, 9_000_000_000_000)
    )
    evaluations = upper.bit_length() + 5
    if value.config.path_count * value.config.horizon_days * ledger_size * evaluations > 50_000_000:
        raise DomainError(ErrorCode.UNAVAILABLE, "Optimizer workload exceeds supported limit")
    first = check(1)
    if first or upper < 1:
        return OptimizerResult(
            status="NO_SAFE_ACTION",
            action=None,
            max_amount_minor=0,
            verifier_calls=calls,
            limiting_checks=first or ["NO_SPENDABLE_BALANCE"],
            next_cent_rejected=True,
        )
    low, high = 1, upper
    while low < high:
        middle = (low + high + 1) // 2
        if check(middle):
            high = middle - 1
        else:
            low = middle
    # Recompute both boundary points; never infer the final result from cached checks.
    final = check(low)
    next_reasons = check(low + 1)
    if final or not next_reasons:
        return OptimizerResult(
            status="NON_MONOTONIC_FEASIBILITY",
            action=None,
            max_amount_minor=0,
            verifier_calls=calls,
            limiting_checks=["BOUNDARY_NOT_ESTABLISHED"],
            next_cent_rejected=False,
        )
    optimized = value.action.model_copy(update={"amount_minor": low})
    optimized = optimized.model_copy(
        update={
            "id": "optimized-"
            + digest(
                {
                    "input": value.model_dump(mode="json"),
                    "amount_minor": low,
                }
            )
        }
    )
    return OptimizerResult(
        status="SAFE_ACTION",
        action=optimized,
        max_amount_minor=low,
        verifier_calls=calls,
        limiting_checks=next_reasons,
        next_cent_rejected=True,
    )
