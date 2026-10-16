# PF-009 seeded simulation design

The user approved the proposed simulation design in chat. This document makes its implementation details reviewable. Scope: issue #9, Farid's simulation ownership with authorized temporary lead coverage. Preserve the existing models, tables, routes, money units and certificate encoding.

## Engine

`simulation/engine.py` exposes `simulate(trusted: TrustedSimulationInput) -> SimulationRun`. Validate trusted snapshot/policy hashes, active policy identity, unique entity IDs, the protected goal and its due date before calculation. Use NumPy PCG64 with the stored seed and separate streams for market returns, income delays and emergencies. Samples depend on configuration and stable ordered entity IDs, never candidate ID or amount, providing common random numbers across candidate amounts.

Version the supported methodology as `pf-monte-carlo-v1`. Daily risky returns are independent zero-mean normal draws with standard deviation `daily_volatility_bps / 10000`; clip returns below -100%, floor risky values to cents daily, and reject nonfinite or out-of-range calculations. Income events independently delay by exactly 30 days according to the configured probability. Each path independently has at most one additional emergency, with configured horizon-wide occurrence probability and a uniformly sampled day in 1..horizon. These are scenario assumptions, not calibrated forecasts.

Use PF-008's ledger ordering and reserve semantics: day-zero action and fee, income before same-day costs, every scheduled payment once, tuition segregation until due, other protected obligations separately reserved, emergency floor throughout. Risky holdings never fund cash expenses. Realized expenses already reflected in balances are not deducted again. Allocation adds owned risky value; transfer is pure outflow.

Return goal satisfaction as floored successful-path fraction in basis points; reserve breaches as ceiled breached-path fraction; terminal liquid cash's lower empirical fifth percentile; floored integer average terminal total value. Retain a deterministic bounded subset of 20 complete liquidity paths and all four individual PF-008 stresses. Bind configuration digest and action/state IDs. Engine evidence is reproducible excluding artifact ID/time; route persistence returns the same original artifact on repeated identical requests.

## Trusted routing and persistence

Implement existing authenticated `POST /simulate` in `simulation/router.py`, accepting only ActionRequest. Load server-derived actor, current state and confirmed policy. Select configuration only when exactly one valid immutable SimulationConfigRecord exists; no record or multiple records fail with UNAVAILABLE. This interim single-config selection supports the existing schema without inventing an activation field. No config is seeded or created by public input. A future multi-config selector needs its own reviewed change.

Validate database metadata against payloads, including user/version/IDs/digests. Missing policy refuses explicitly. Reject unsupported model versions. Derive candidate identity from the submitted candidate's existing ID, bind canonical action digest and state; reuse is allowed only for identical bindings, otherwise CONFLICT. Simulation identity includes action digest/ID, full trusted state, policy digest and config digest; thus policy changes cannot reuse old results despite SimulationRun lacking a policy field.

For SQLite, load authority and atomically persist candidate, simulation and hash-linked audit using a serialized transaction. Identical repeated/concurrent requests return original stored evidence without duplicate audit. Corrupt persisted results fail closed. Other write databases refuse explicitly. Do not expose trusted inputs or configure assumptions through the route.

## Limits and tests

Reject workloads exceeding 12,100,000 path-days before allocation. Run paths in bounded batches; avoid unbounded return tensors. Preserve integer arithmetic in the cash ledger and check overflow/finite market calculations before conversion. No income or probability is activated by implementation. The baseline remains $200 short before fees and shocks.

Tests cover zero-volatility exact ledger metrics, seed reproducibility, common samples, probability 0/10000 boundaries, additional emergency semantics, delayed income beyond horizon, reserve breaches before later recovery, original baseline, duplicate schedules, corrupt bindings, unsupported model/workload refusal, no-config/multiple-config HTTP refusal, strict request schema/auth/CSRF, immutable persistence, replay/conflict/concurrency and audit rollback. Only isolated tests install synthetic configs.

Verification: focused PF-009 suite, npm run check, Alembic check and no generated OpenAPI/TypeScript drift. Public verification, certificate issuance, optimization and signing remain separate issues. Historical browser timeout evidence remains unresolved.
