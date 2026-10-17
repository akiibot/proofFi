# Explicit synthetic funded demonstration — PF-036 / issue #65

The owner approved a separate $5,000 synthetic cash addition and delegated demo
input selection on 2026-10-17. The selected file is `funded-demo-config.json`:
2% daily volatility, 20% chance of an additional $2,000 emergency over 120 days,
$1 synthetic planning fee, 1000 paths and seed 18421. These are hypothetical
inputs, not calibrated forecasts, real gas prices, income or actual assets.
No income exists, so the zero income-delay probability has no cash effect.
All existing named stresses still run; a realized Scenario C expense does not
replace the additional future emergency. No positive outcome is guaranteed.

The original $12,000 baseline has a $200 deficit before fees/shocks. The funded
alternative has $17,000 synthetic cash and a $4,800 arithmetic margin before
fees/shocks. That margin is not an optimizer result or an investment allowance.

## Review and preview

The provisioner must be reviewed and merged with passing CI before use. Preview:

```sh
.venv/bin/python scripts/provision_funded_demo.py --config docs/funded-demo-config.json
```

This prints the complete inputs and a digest binding the scenario and config.
It changes no database or runtime setting. After checking those exact inputs,
create a private destination directory and pass `--database` with a NEW SQLite
file path plus `--confirm-digest` with the preview's exact digest. The provisioner
applies existing migrations in a private staging directory, seeds the immutable
baseline, appends the funded version, and persists the config/audit atomically.
It publishes the completed database create-only; existing destinations refuse.
Errors leave the destination absent. No existing database, .env, policy, signer,
RPC setting or keyring is modified. Never use a production database path.

The new database retains baseline version 1 and funded version 2. Its Constitution
is only a draft. Select the new database explicitly via DATABASE_URL for a demo
server, then use the existing authenticated Constitution flow to review and
confirm policy. Actual token/recipient settings, transfer fee limits and signer
activation require their separate reviewed provisioning steps. The original
runtime/database can remain the honest baseline comparison.

## Validation limits

Tests exercise existing-database refusal, original snapshot/digest preservation,
no automatic policy confirmation, exact config binding, audit-failure rollback,
real migration execution, private create-only publication and invalid selection
cleanup. Any isolated test inputs are test evidence only. This preparation does
not establish positive live scenarios, a confirmed Constitution or app transfers.
