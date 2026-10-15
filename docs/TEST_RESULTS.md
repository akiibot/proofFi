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

## PF-012 certificate primitives

`npm run check`: PASS, 45 backend tests (25 new certificate tests), 2 real browser/API smoke tests, Ruff, frontend lint/typecheck, production build and contract generation. OpenAPI and generated TypeScript are unchanged. Red run: missing primitives and unfinished certificate verification caused expected failures before implementation. Green run covers explicit-key Ed25519 signing, documented signature wire format, unknown/wrong/relabelled keys, tamper/recomputed-hash forgery, exact expiry/future issue, nested mutation, action/config digest mismatch, invalid lifetime, authenticated stored reads, stale state/policy, prior claim, matching/wrong approval, corrupt trusted policy, malformed/missing keyring and no enabled issuance endpoint. One existing upstream Starlette/httpx deprecation warning remains.

No runtime signing key or product certificate was provisioned. Certificate/policy/approval records inserted in tests are explicitly isolated fixtures. No real chain operation and no full product acceptance gate is claimed.

## PF-012 refresh after foundation merge

PR #35 refreshed from main at 9c49ef4815023c746b3c18556fe5963918731f2b. Fresh `npm run check` passed: 50 backend tests (including Farid's foundation regressions), 2 real browser/API tests, Ruff, frontend lint/typecheck/build and generated contracts. `.venv/bin/alembic check` passed with no new operations. Generated OpenAPI/TypeScript unchanged. This refresh enables main review; teammate approval is optional under the later owner waiver. No product issuance, policy activation or live execution is enabled.

## Post-foundation checklist refresh (#44)

Fresh `npm run check` on the #44 branch refreshed from main: PASS, 25 backend tests, 2 real browser/API tests, Ruff, contract generation, frontend lint/typecheck and production build. No generated OpenAPI/TypeScript drift. Root-config `.venv/bin/alembic check` passed with no new operations; an initial command incorrectly pointed to nonexistent `services/api/alembic.ini` and failed configuration loading before it was corrected. These are foundation tests; the previously reported 184/4 implementation-stack checkpoint is separate branch evidence. Prior implementation-stack browser timing failures remain unresolved; this run does not establish their root cause was fixed. No AT-01..AT-12 completion or genuine chain receipt is claimed.

Documentation checks: all 33 PF issues appear exactly once in owner checklists; dependency manifest matches live issue bodies, including #18's #33 gate; README link, Mermaid fencing and `git diff --check` validated. Foundation #34/#42 merge and current main protection verified through GitHub. Independent reviews remain outstanding on #35–#41/#43/#44.

Subsequent integrated-stack revalidation FAILED: 184 backend tests passed; 3 browser/API tests passed and PF-033 login redirect assertion timed out at 5000ms. Its later snapshot showed the sign-in page, but the causal issue remains unresolved. No test settings were changed. This separate stack failure does not replace the passing #44 foundation-only check above. Full record is on PR #43 / issue #33.

## Teammate approval waiver (2026-10-16)

The owner waived teammate approvals going forward while requiring care not to break the project. Only GitHub's mandatory approval count (1 to 0) and CODEOWNER approval (true to false) changed; an API comparison confirmed every other branch-protection field identical. Required PRs, strict foundation CI, conversation resolution, admin enforcement and force-push/deletion restrictions remain. Lead acceptance of sensitive/shared changes and contract-change procedure remain procedural requirements.

Fresh `npm run check` passed: 25 backend tests, 2 real browser/API tests, Ruff, generated contracts, frontend lint/typecheck/build. The first invocation failed typecheck because ignored `.next` validators from the auth branch referenced `/login`, absent on this foundation-only branch. Removing that ignored cache and rerunning the entire check passed. No runtime/test source or test settings changed; the separate PF-033 browser timing failure remains unresolved. AI documentation review identified stale current-checkpoint/CODEOWNERS comments; both were corrected. No teammate approval is fabricated.
