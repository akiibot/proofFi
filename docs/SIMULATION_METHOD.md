# Simulation method and interpretation

This describes the implemented `pf-monte-carlo-v1` model, not a calibrated financial
forecast. The source is `services/api/app/simulation/engine.py`, `stress.py`, the
policy engine and optimizer. [RISK_METHODOLOGY.md](RISK_METHODOLOGY.md) records the
detailed ledger rules. Stored state, confirmed Constitution and the explicitly
selected immutable simulation configuration are authoritative; a planner or HTTP
caller cannot supply replacements.

## Units, cash and obligations

All ledger amounts use integer USD cents. Probabilities use integer basis points:
10000 represents 100%. EVM amounts use decimal base-unit strings. One synthetic USD
unit maps to one demonstration token unit for exact transfer encoding; this says
nothing about token purchasing power or an exchange rate. Native gas is separate.

Only liquid, non-high-risk assets can pay obligations. An allocation deducts its
amount and the explicit synthetic fee from cash and creates a high-risk holding;
a transfer creates no owned holding. Risky holdings are never sold to repair a cash
shortfall. The explicit fee is charged once. Realized expenses are already reflected
in balances; cumulative realized-expense metadata is not deducted again.

The ledger contains day zero through the configured horizon. Income precedes
same-day outflows. Obligations and each recurring due day are applied once. Goal
success requires enough cash for all expenses on the goal's due day. The reserve
check covers every day, including day zero: emergency floor, other unpaid protected
obligations, and the larger of unpaid tuition and the configured tuition reserve
while tuition remains unpaid. Paying tuition releases its reserve; later income
cannot undo an earlier failure. The horizon must contain the goal due date.

The preserved baseline has $12,000 starting synthetic assets, $7,000 tuition,
$2,000 reserve and $3,200 living expenses, with no income. Its $200 shortfall exists
before fees/shocks. A successful optimizer result must never be manufactured for
this baseline. The separately approved funded scenario adds $5,000 synthetic cash
in a new snapshot while retaining baseline history; it does not assert actual
personal funds. See [FUNDED_DEMO_SETUP.md](FUNDED_DEMO_SETUP.md).

## Four deterministic named stresses

These are four individual counterfactuals, not three scenarios and not one combined
worst case. Each returns parameters, minimum liquidity, goal funding and pass/fail.

| Stress | Applied change |
|---|---|
| Market shock | Immediate 30% reduction of risky value, including the proposed allocation; floor remaining value to cents. No forced sale. |
| Income delay | Move each declared income event 30 days later. Empty income remains empty. |
| Emergency expense | Additional $2,000 cash expense on day 1. This remains additional after Scenario C's realized expense. |
| Fee shock | Multiply the explicitly configured synthetic fee by three. |

Passing means no relevant funding/reserve failure in that individual stress. It
provides no probability bound and does not cover every possible shock or dependence.
The independent verifier requires all four named results and rejects failed
stresses; missing evidence cannot become a pass.

## Seeded Monte Carlo

NumPy PCG64 streams are derived from the stored seed with `SeedSequence.spawn(4)`:
risky daily returns, income delays, emergency occurrence and emergency day. Income
IDs are sorted before sampling. Draws are independent of proposed amount and
candidate ID, permitting comparable recomputation for the same authoritative inputs.
Locked dependencies support reproducibility; this is not a promise of identical
numerical results under arbitrary library/model changes.

Daily risky returns are zero-mean normal draws with the configured standard
deviation. Returns below minus 100% are clipped; risky values floor to cents daily.
Nonfinite or oversized results refuse calculation. Each declared income event
independently delays 30 days with the configured probability. Each path has at most
one additional emergency with a horizon-wide configured probability, placed on a
uniformly sampled day. These distributions and independence assumptions are model
choices, not estimates inferred from market or household data.

Cash uses the same ordering and reserve rules as the deterministic ledger. Under
this cash-only funding model, risky returns affect terminal valuation rather than
obligation funding because risky holdings cannot be liquidated. Increasing return
volatility therefore need not change goal-funding probability. This is a material
limitation when interpreting the charts, not evidence of risk-free investment.

Outputs and rounding:

- Goal satisfaction: successful paths divided by path count, rounded down to basis points.
- Reserve breach: paths with any breach divided by path count, rounded up to basis points.
- P05 terminal liquidity: sorted ending cash at zero-based index `floor((N-1)*0.05)`.
- Expected terminal value: integer mean rounded down of ending cash plus risky and other asset values.
- Chart samples: the first 20 complete cash paths, not a selected best/worst sample or confidence interval.

The approved funded example uses 1000 paths, seed 18421, horizon 120 days, 200 bps
daily volatility, 2000 bps chance of an additional $2,000 emergency, no income and
a 100-cent synthetic fee. These are explicitly delegated hypothetical inputs.
A reported 100% success or 0% breach is a finite simulation outcome under those
inputs, never a real-world guarantee or a calibrated probability.

## Policy and largest-safe proposal

Hard policy checks cover tuition, reserve, asset/chain allowlists, concentration,
risk thresholds and forbidden borrowing. The concentration denominator is
`max(0, current owned assets - protected tuition - emergency floor)`; projected
income is excluded. Existing plus proposed risky positions form the numerator.
The $150 autonomy threshold and new-recipient rule can require exact human approval;
approval cannot override a hard denial.

For this fixed cash-only model, increasing allocation cannot improve cash funding
or concentration. The optimizer searches integer cents within trusted cash/token/gas
bounds and independently recomputes its final cent and the following cent. Its
50,000,000 aggregate workload bound is separate from simulation's 12,100,000
path-day/ledger-work bound. Unsupported/nonmonotonic feasibility, missing authority
or excessive work refuse explicitly; the solver does not silently shrink path count
or change assumptions. A proposal provides no nonce reservation or signing authority.

Simulation batches are at most 256 paths. The schema bounds paths to 100..100000
and horizon to 1..366 days; the runtime also bounds assets and ledger work items to
1000 and checks aggregate work before RNG allocation. Duplicate IDs/due days,
invalid goal links, missing/multiple configurations and corrupted authoritative
bindings fail explicitly.

## Scenario and evidence boundaries

The product's three scenarios are A (safe proposal/execution), B (unsafe planner
rejection), and C (realized emergency/replanning). They are distinct from the four
named stresses evaluated within simulations. The funded Scenario A has genuine
API/chain/ledger evidence in [LIVE_EXECUTION_ACCEPTANCE.md](LIVE_EXECUTION_ACCEPTANCE.md).
That evidence does not complete browser acceptance, B/C, workflow, or AT-01..AT-12.
Original-baseline refusal, isolated tests, seeded rendering fixtures, real API calls
and actual chain receipts must remain distinguishable in reports.
