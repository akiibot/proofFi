# Foundation validation

Local validation on 2026-10-15 (user timezone Asia/Dhaka). This report concerns the foundation only; **AT-01..AT-12 are not passed**. See ACCEPTANCE_MATRIX.md.

| Command | Actual outcome |
|---|---|
| `python3.11 scripts/bootstrap.py` | PASS; locked install, migration, idempotent seed; existing state preserved |
| `.venv/bin/ruff check .` | PASS |
| `.venv/bin/pytest -q` | 20 passed; one upstream Starlette httpx deprecation warning |
| `npm run contracts` | PASS; generated OpenAPI and TypeScript |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; optimized Next.js production build |
| `npm run test:e2e` | 2 passed; actual browser -> Next read proxy -> FastAPI -> seeded SQLite |
| `.venv/bin/alembic check` | PASS; no new upgrade operations detected |
| `npm audit --audit-level=high` | PASS; zero vulnerabilities |
| `gh issue list ...` | 33 open issues; 28 blocked; 14 assigned to akiibot |

Backend coverage: migrations upgrade/downgrade/re-upgrade and drift, foreign keys/unique versions, idempotent seed, policy not autoactivated, immutable historical snapshot retention, stale version rejection, digest corruption detection, strict money inputs, rejection of authority-bearing extra properties, exact ERC-20 encoding and network, deterministic canonical hashing, conflicting counterparty lists, authentication, honest unfinished responses, no planner authority imports, acyclic complete backlog, environment chain parsing/mainnet rejection.

Browser coverage: real persisted amount and snapshot hash, inactive policy and unconfigured chain displayed, refresh available, mobile width without horizontal overflow, read proxy refuses arbitrary routes and mutations. Tests do not replace the backend or database with network fixtures.

Observed and repaired: initial bootstrap rejected string CHAIN_ID from .env; added exact testnet parsing and regression test. Initial schema-count assertion was off by one; corrected. npm lint dependency chain carried an advisory; replaced tooling dependency and confirmed clean audit. No checks were bypassed.

Fresh checkout validation: cloned committed foundation into a new temporary directory, ran bootstrap and the entire npm run check successfully (20 backend tests, 2 browser tests, lint/typecheck/build/contracts). Hosted CI status is available on PR #34; do not infer its outcome from local results. No transaction broadcast or live-chain verification was attempted.
