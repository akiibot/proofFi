# Testing and validation

Run commands from the repository root after the [locked bootstrap](../README.md#clean-checkout). Use Python 3.11, Node 22.19.0 and npm 10.9.3. Commands below use macOS/Linux virtualenv paths; on Windows replace `.venv/bin/python` with `.venv\Scripts\python.exe`.

## Full local check

Stop development servers first: Playwright owns ports **3000 and 8000** and refuses to reuse an existing web server. Run in a disposable checkout with its own bootstrap-created environment and database; do not point tests at a preserved demo database or hosted credentials.

```sh
npx playwright install chromium
npm run check
```

On Linux install browser system dependencies with `npx playwright install --with-deps chromium`. The check runs these stages in order and stops at the first failure:

| Stage | Scope |
|---|---|
| Ruff | Python lint |
| pytest | Backend policy, simulation, certificates, approval, execution, authentication and persistence tests |
| Contract generation | OpenAPI and TypeScript regeneration |
| ESLint and TypeScript | Frontend lint and type checks |
| Next.js build | Production frontend build |
| Playwright | Serial browser journeys against an isolated seeded API/database and loopback chain fixture |

Contract generation can write generated artifacts. After the check, verify that committed contracts are unchanged:

```sh
git diff --exit-code -- contracts/ apps/web/src/lib/schema.d.ts
.venv/bin/python -m alembic check
```

`alembic check` checks SQLite migration drift against the checkout's configured local database. Never substitute a hosted connection for this local setup.

## Focused checks

```sh
# All ordinary backend tests
.venv/bin/python -m pytest -q
# Policy, simulation and certificate primitives
.venv/bin/python -m pytest services/api/tests/test_pf_007.py services/api/tests/test_pf_009.py services/api/tests/test_pf_012.py -q
# Frontend static checks
npm run lint
npm run typecheck
# Browser suite (servers must be stopped first)
npm run test:e2e
```

Focused tests aid development; the full check remains the review gate. The existing tests are in [services/api/tests](../services/api/tests), [services/api/postgres_tests](../services/api/postgres_tests) and [apps/web/e2e](../apps/web/e2e). Acceptance requirements and their evidence are mapped in [ACCEPTANCE_MATRIX.md](ACCEPTANCE_MATRIX.md).

## PostgreSQL suite and CI

PostgreSQL tests run separately from `npm run check`. The [checked-in CI workflow](../.github/workflows/ci.yml) provisions PostgreSQL 17 and runs:

```sh
.venv/bin/python -m pytest services/api/postgres_tests -q
```

To run locally, set `PROOFFI_TEST_POSTGRES_URL` privately to a **dedicated disposable local PostgreSQL administrator connection** first. Fixtures create and drop isolated test databases; the account needs those permissions. Never use a shared or hosted production connection. Without the configured service, this command is not PostgreSQL acceptance evidence.

CI jobs `foundation` (Ubuntu) and `windows` run bootstrap, full validation, contract drift, migration drift and the high-severity npm audit. `postgres-contract` runs the real PostgreSQL fixture suite. All current required jobs must pass before merge. Inspect the run attached to the exact PR head rather than relying on old counts or a badge.

## What passing establishes

Browser tests use public isolated test credentials and a loopback chain fixture. They exercise real application/API/database paths with substituted chain services, and cannot prove an actual transfer. Genuine receipts, exact approvals and historical screenshots are indexed separately in [evidence/README.md](../evidence/README.md). [TEST_RESULTS.md](TEST_RESULTS.md) records earlier validation; counts belong to their recorded revision.

For failures, preserve the failing command, commit and concise output. Port conflicts require stopping your own development servers or using another disposable test environment. Historical hydration diagnosis stays in [#60](https://github.com/akiibot/proofFi/issues/60); do not weaken assertions or add retries to claim a repair.
