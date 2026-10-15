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

Approval/ownership follow-up: `npm run check` rerun passed (20 backend tests, 2 browser tests, lint/typecheck/build/contracts). GitHub user lookup verified WasikZubair and Alfa5nm; write invitations remain pending. Actual assignee API responses omitted those handles, so assignment is explicitly pending.

## Post-foundation checklist refresh (#44)

Fresh `npm run check` on the #44 branch refreshed from main: PASS, 25 backend tests, 2 real browser/API tests, Ruff, contract generation, frontend lint/typecheck and production build. No generated OpenAPI/TypeScript drift. Root-config `.venv/bin/alembic check` passed with no new operations; an initial command incorrectly pointed to nonexistent `services/api/alembic.ini` and failed configuration loading before it was corrected. These are foundation tests; the previously reported 184/4 implementation-stack checkpoint is separate branch evidence. Prior implementation-stack browser timing failures remain unresolved; this run does not establish their root cause was fixed. No AT-01..AT-12 completion or genuine chain receipt is claimed.

Documentation checks: all 33 PF issues appear exactly once in owner checklists; dependency manifest matches live issue bodies, including #18's #33 gate; README link, Mermaid fencing and `git diff --check` validated. Foundation #34/#42 merge and current main protection verified through GitHub. Independent reviews remain outstanding on #35–#41/#43/#44.
