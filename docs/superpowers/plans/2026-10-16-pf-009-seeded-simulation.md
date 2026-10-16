# PF-009 Seeded Simulation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Execution stays in this session; no delegation is needed.

**Goal:** Compute reproducible scenario metrics and persist authenticated simulations using trusted database authority.

**Architecture:** A pure NumPy engine consumes existing trusted models. The existing simulation router owns serialized database loading, idempotency, persistence and audit. No schema or migration changes.

**Tech Stack:** Python 3.11, NumPy PCG64, FastAPI, SQLAlchemy, SQLite, pytest.

**Spec:** `docs/superpowers/specs/2026-10-16-pf-009-simulation-design.md` (approved by the user).

## Global Constraints

- Branch `codex/pf-009-seeded-monte-carlo`; issue #9 only.
- Money: integer USD cents; probabilities: integer basis points.
- Model version `pf-monte-carlo-v1`; configuration comes only from trusted storage.
- Reject workloads above 12,100,000 path-days before allocation; batches at most 256 paths.
- Keep at most 20 complete sampled liquidity paths.
- No seeded config, invented income/probabilities, automatic policy activation, certificate issuance or signing.
- Preserve all existing contracts and historical browser timeout evidence.

## Review Focus

- A nonfinite or enormous risky value must refuse before integer conversion.
- A policy change must prevent reuse of an old simulation even with unchanged state/config.
- A candidate ID reused with different contents or state must conflict.
- A duplicate concurrent request must persist one simulation and one audit event.
- A corrupt stored simulation or audit head must fail closed without partial writes.

### Task 1: Pure engine and deterministic scenario metrics

**Files:** Create `services/api/app/simulation/engine.py` and `services/api/tests/test_pf_009.py`.

**Interfaces:** Consumes `TrustedSimulationInput`, PF-008 `validated_input`/`run_stresses`. Produces `simulate(trusted: TrustedSimulationInput) -> SimulationRun`.

- [ ] Write engine tests using isolated trusted fixtures with explicit `pf-monte-carlo-v1` configuration. For zero volatility and zero event probabilities, compare every retained path with PF-008 `project_ledger`; assert exact integer metrics, all four stresses and digest bindings.
- [ ] Run `.venv/bin/python -m pytest services/api/tests/test_pf_009.py -q`; observe failure because the engine does not exist.
- [ ] Implement independent PCG64 streams via SeedSequence spawning: market, income, emergency occurrence and emergency day. Sort income by stable ID. Keep random samples independent of candidate amount/ID. Batch paths in stable order, retaining the first 20 paths.
- [ ] Implement day-zero fee/action and day 1..horizon cash ledger with PF-008 ordering/protection. Use integer cash arithmetic and finite checked/floored risky returns. Calculate floor goal fraction, ceil reserve fraction, sorted lower fifth percentile index `floor((N-1)*0.05)` and floored mean total value.
- [ ] Add 0/10000 probability tests, delayed income beyond horizon, early breach followed by recovery, emergency additional to realized expense, transfer classification, common-sample comparisons and seed reproducibility excluding ID/time.
- [ ] Add unsupported model, excessive workload, duplicate schedule, bad state/policy binding and market-overflow refusal tests. Run focused suite and Ruff; commit engine/tests when passing.

### Task 2: Authenticated trusted loading and durable idempotency

**Files:** Modify `services/api/app/simulation/router.py`; extend `services/api/tests/test_pf_009.py`.

**Interfaces:** Existing `POST /simulate ActionRequest -> SimulationRun`; invokes Task 1's `simulate`. Only server-derived request actor and current database authority determine trusted input.

- [ ] Write real migrated SQLite/API tests: absent policy/config refuses, multiple configs refuse, public config/state injection returns 422, absent session returns 401, bad CSRF returns 403. Observe failures before replacing the unfinished handler.
- [ ] Implement SQLite BEGIN IMMEDIATE, current actor state/head loading and complete record/payload identity/hash validation. Require one trusted config; reject unsupported/ambiguous configuration without inserting records.
- [ ] Hash full trusted input and canonical action to derive a `sim-` identifier within 100 characters. Preserve submitted candidate ID; existing candidate must match exact payload, digest and state. Compute engine evidence and insert candidate/simulation plus SIMULATION_COMPLETED audit atomically.
- [ ] For existing simulations, independently recompute evidence excluding ID/time and compare stored metadata/payload before returning the original record. Reject changed/corrupt history. Include policy/config identity in the derived ID.
- [ ] Test identical replay, altered candidate-ID reuse, policy change, two concurrent identical requests, corrupted candidate/simulation/config/state/policy metadata, audit rollback and unsupported write database refusal. Assert one persisted simulation and audit for duplicate requests.
- [ ] Run focused suite and Ruff; commit router/tests when passing.

### Task 3: Evidence, review and integration

**Files:** Update `docs/RISK_METHODOLOGY.md`, `docs/PROGRESS.md`, `docs/TEST_RESULTS.md`, `docs/ISSUE_BACKLOG.md`, `docs/issues.json` and `TASKS.md` as relevant to PF-009 and merged PF-007.

- [ ] Document explicit distributions, independence limitations, rounding, supported model version, sample retention, workload ceiling and interim one-config trusted selector. Preserve the unconfigured baseline and unresolved browser timeout.
- [ ] Run `.venv/bin/python -m pytest services/api/tests/test_pf_009.py -q`, `npm run check`, `.venv/bin/alembic check`, `git diff --check` and generated OpenAPI/TypeScript drift comparison. Record actual output, including failures.
- [ ] Review complete diff against the approved spec and all five review-focus cases. Fix identified defects with failing regressions and repeat affected/full checks as needed.
- [ ] Open issue-linked PR after clean local evidence; attach it to this chat. Verify hosted CI on the final head, all conversations and dependency state before eligible integration. Keep PF-029 blocked until PF-009 actually merges.
