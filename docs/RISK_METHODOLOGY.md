# Risk methodology — implemented deterministic stresses

PF-008 computes individual named stresses from existing TrustedSimulationInput. These are transparent synthetic scenarios, not forecasts or calibrated probabilities. No model assumptions or income schedule is automatically activated.

## Ledger engineering choices

All cash-flow arithmetic uses integer USD cents. Risky assets and non-liquid holdings cannot fund the protected goal: only liquid, non-high-risk assets count as cash. TEST_TOKEN_ALLOCATION moves the action amount from cash to an owned synthetic high-risk position; TRANSFER is an outflow and creates no owned position. This financial bookkeeping is separate from real test-token purchasing power. Explicit SimulationConfig.fee_minor is deducted once when applying the action; native-chain fees remain a separate live execution check.

The path includes day 0 through the configured horizon. Scheduled income arrives before same-day expenses. Every recurring due day and obligation is paid exactly once; delayed income beyond the horizon is not counted. On the goal's due day, goal_funded requires enough cash for all same-day expenses, a conservative engineering choice. The horizon must include the primary protected goal's due date. Duplicate entity IDs, recurring due days, invalid goal references and corrupted trusted snapshot/policy bindings refuse calculation.

Reserve checks apply throughout the path, not only at the end. Required cash is emergency floor + unpaid other protected obligations + max(unpaid goal amount, configured tuition reserve while the goal remains unpaid). Paying another protected obligation cannot release tuition protection. Once the goal payment is due and applied, its configured reserve releases; any funding failure remains recorded. Future income cannot repair an earlier breach. Minimum liquidity is the minimum raw cash balance across the complete path; pass/fail also accounts for segregated obligations and the floor.

Current asset balances already reflect a realized expense. realized_expense_minor is cumulative explanatory metadata and is never deducted a second time. No risky asset is sold or borrowed against to manufacture safe liquidity. Terminal value includes ending cash, shocked risky value and unchanged other assets; this is a synthetic valuation only.

## Four individual shocks

- Market shock: risky values, including the proposed allocation, lose exactly 30% immediately. Remaining value is rounded down to cents. Cash is unaffected because holdings are not liquidated. Results expose risky_terminal_value_minor.
- Income delay: each declared income event moves 30 days later; amounts are unchanged. Empty income stays empty.
- Future emergency: an additional $2,000 cash outflow on day 1, chosen conservatively and displayed in parameters. This is a second future shock when state already contains a realized emergency.
- Fee shock: configured synthetic transaction/operational fee is multiplied by 3, without combining the other shocks.

StressResult.passed requires the goal and scheduled outflows to be fundable and no reserve breach at any point. All parameters are returned; shocks are individual, not simultaneous. No probabilistic claim follows from a passing stress.

## PF-009 Monte Carlo methodology

`pf-monte-carlo-v1` uses NumPy PCG64 with separate seeded streams for independent zero-mean normal daily risky returns, income delays, emergency occurrence and emergency day. Daily return standard deviation is the explicitly stored volatility in basis points; returns below -100% clip to -100%, values floor to cents daily, and nonfinite/oversized values refuse. Each declared income event independently delays by 30 days with the configured probability. Each path has at most one additional emergency with the configured horizon-wide probability, on a uniformly sampled day. These are disclosed synthetic assumptions, not statistically validated forecasts or independence claims about real markets.

Cash follows the deterministic ledger ordering and segregated reserve rules above. Random draws depend on the stored seed/config and sorted income IDs, never candidate ID/amount. Goal satisfaction floors the successful fraction to basis points; reserve risk ceils the breached fraction. P05 uses sorted terminal liquid cash at index `floor((N-1)*0.05)`; expected terminal total value floors its integer mean. Return the first 20 complete cash paths and all four independent stresses. Batches are limited to 256 paths and workloads above 12,100,000 path-days refuse.

The authenticated route accepts only a candidate, loads current state/confirmed policy and requires exactly one trusted config record. No config is installed automatically; missing/multiple/corrupt configurations refuse. This interim one-config selector is deliberately explicit; supporting multiple selectable configurations requires separate design. SQLite serializes authority loading, immutable candidate/simulation persistence and linked audit. Candidate ID reuse with different data/state conflicts. Simulation identity includes full policy/state/action/config; replay recomputes evidence before returning the original stored artifact. Policy evaluation is PF-007, trusted issuance remains PF-029.

Review tightened resource bounds: assets and ledger work items are capped at 1,000, and `path_count * horizon_days * ledger_work_items` must also be at most 12,100,000. Work items count income, obligations and recurring schedule entries; this bounds per-day scanning and income sample allocations before RNG allocation. Replay also verifies the hash-linked audit chain and exact original artifact digest, including timestamp. These restrictions fail explicitly rather than changing requested model parameters.
