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

StressResult.passed requires the goal and scheduled outflows to be fundable and no reserve breach at any point. All parameters are returned; shocks are individual, not simultaneous. No probabilistic claim follows from a passing stress. Monte Carlo distribution choices, config persistence, seeded sampled paths and public simulation integration remain PF-009; policy evaluation remains PF-007.
