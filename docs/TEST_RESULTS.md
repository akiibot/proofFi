# Foundation validation

## PF-009 implementation evidence (2026-10-16)

Focused suite: 23 passed. Engine tests first failed on the missing module; API tests then reproduced the unfinished 501 route. Tests cover exact zero-randomness metrics, reproducibility/common market and cash samples, event boundaries, delayed income, early reserve breaches, excessive workloads before allocation, overflow/corrupt inputs, real authenticated SQLite persistence, candidate conflicts, policy changes, concurrent replay, config ambiguity/corruption and audit rollback. Review found a ledger-work bound gap and acceptance of mutated replay timestamps. The timestamp regression first returned 200 instead of 503, then passed after full artifact/audit-chain verification. Follow-up review found both issues resolved.

Initial full check passed 223 backend tests and four browser/API tests before the review fixes. The full rerun after fixes passed 227 backend tests, Ruff, contracts, lint/typecheck/build, but failed the browser suite at 3/4: `foundation.spec.ts:7` expected financial-state HTTP 200 and received proxy HTTP 503. Snapshot displayed "Backend unavailable." The proxy catches fetch failures including its existing 10-second timeout; exact cause was not established. No proxy, browser assertion, timeout, retry or worker setting changed. This is separate from the unresolved historical PF-033 redirect timeout. Subsequent verification is recorded below; no passing rerun replaces this failure.

Alembic check reported no new upgrade operations and generated OpenAPI/TypeScript had no drift. No seed config or approved probability assumptions, safe allocation, certificate issuance, transaction or product acceptance gate is claimed.

Final unchanged full rerun passed: 227 backend tests, four real browser/API tests, Ruff, generated contracts, frontend lint/typecheck and production build. This confirms the current branch's gate passed; it does not establish the cause or repair of the recorded proxy 503 or historical redirect timeout. Both remain honest limitations.

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

## PF-030 isolated testnet signer and RPC adapter

Initial `npm run check`: PASS, 72 backend tests (27 new adapter tests), 2 browser/API smoke tests, Ruff, frontend lint/typecheck/build and contract generation. After PF-012 merged, PR #36 was refreshed from current `main`; the fresh full run passed with 77 backend tests, 2 browser/API tests, lint, typecheck, production build and contract generation. `.venv/bin/alembic check` reported no new upgrade operations, and generated OpenAPI/TypeScript remained unchanged. Initial red run: all 22 original adapter tests failed because signer/transport implementations did not exist; implementation made them pass, followed by additional transport/secret/receipt cases. Two upstream deprecation warnings (Starlette/httpx and web3's websockets legacy import) remain.

Signer tests use actual eth-account signing/recovery and decoded EIP-1559 bytes, including chain/sender/token/recipient/calldata/gas/fee/value/decimals rejection. Isolated RPC fixtures test wrong network, malformed bytes, independent destination validation, acknowledgement hash mismatch, ambiguous timeout with no retry, pending/reverted/confirmed/reorged receipts, wrong receipt hash and unavailable receipt handling. Real HTTPProvider construction is tested for bounded timeout and disabled retries. These fixture outcomes are not live chain evidence.

Separate read-only network probe: public https://sepolia.base.org returned HTTP 200 and eth_chainId=84532 on 2026-10-15. No private key, configured demo wallet, test token or approved destination was used; no transaction was broadcast. Live execution remains pending PF-014/PF-015 and real infrastructure.

## PF-033 authenticated sessions and browser boundary

`npm run check`: PASS, 89 backend tests (17 new session/security tests), 4 real browser/API tests, Ruff, frontend lint/typecheck/build and generated contracts. `alembic check`: no new operations (no migration change). Browser-bundle scan of 11 JavaScript assets found none of the actual local demo password, password hash or legacy API token. Actual values were not printed.

New tests cover HttpOnly/SameSite cookies, cookie-token omission from JSON, rejecting bearer/spoofed identity, missing/untrusted Origin, wrong passwords and login throttling, mandatory CSRF/Origin for mutations, logout/replay rejection, server-clock expiry, session-specific CSRF, missing configuration, non-ASCII CSRF rejection, public HTTPS/Secure-cookie settings, mutation rate limit and salted password verification. Four browser checks exercise the actual login/proxy/backend/database/logout flow without replacing backend responses.

A non-ASCII CSRF header initially caused TypeError in constant-time string comparison. The failing regression test demonstrated the exact root cause; comparing encoded bytes fixed it and the test now passes. Existing upstream Starlette/httpx and websockets deprecation warnings remain. Browser traces are disabled to avoid retaining entered credentials/session cookies.

HTTP API v1.1 adds auth routes/types and errors and replaces prototype bearer identity with sessions. Generated OpenAPI and TypeScript changed together; signed financial/state/transaction/certificate schema versions remain unchanged. The new contract is for lead review in a separate contract-change PR. No product certificate issuance, policy activation, human financial approval, on-chain execution or full acceptance-gate completion is claimed.

PF-033 fresh-checkout verification: cloned committed branch into a new temporary directory, bootstrapped locked dependencies/new owner-only credentials/migration/seed, ran the complete npm run check (89 backend tests and 4 browser tests), and confirmed regenerated OpenAPI/TS had no drift. All passed.

## PF-013 bound human decisions

Initial `npm run check`: PASS, 113 backend tests (24 new approval tests), 4 real browser/API tests, Ruff, frontend lint/typecheck/build and contract generation. After PF-033 merged, PR #38 was refreshed from current `main`; the fresh full run passed with 119 backend tests, 4 browser/API tests, lint, typecheck, production build and generated contracts. `.venv/bin/alembic check` reported no new upgrade operations, and regenerated OpenAPI/TypeScript had no working-tree drift. Initial tests reproduced the unfinished approvals route; a later failing session-fingerprint assertion was resolved by trusted middleware provenance in the same-transaction audit event. A missing test import was corrected before rerunning the full checks. Two existing upstream deprecation warnings remain.

Tests exercise real session-protected API, migrated SQLite and Ed25519 fixtures: exact certificate/action/state/policy/actor binding, deny permanence, duplicate/concurrent decisions, missing/tampered/expired/stale/spent certificates, unavailable verifier keys, actor/state injection, missing session/CSRF, current hard asset/recipient/funding restrictions, unneeded approval refusal, immutable signed payload, no execution/consumption, atomic decision/audit rollback, sequential audit hashes and session fingerprint without raw-cookie exposure. Concurrent HTTP requests create exactly one decision.

Fixtures do not establish real policy/risk compliance or chain evidence. No trusted issuance, signer or broadcast is enabled; consumption remains the independent executor's responsibility. Full workflow audit coverage and full-chain verification remain PF-016. No product acceptance gate is newly claimed passed.

## PF-014 execution guard slice

Initial `npm run check`: PASS, 149 backend tests (36 new guard tests), 4 real browser/API tests, Ruff, frontend lint/typecheck/build and contract generation. After PF-013 and onboarding updates merged, PR #40 was refreshed from current `main`; the fresh full run passed with 155 backend tests, 4 browser/API tests, lint, typecheck, production build and generated contracts. `.venv/bin/alembic check` reported no new upgrade operations, and regenerated OpenAPI/TypeScript had no working-tree drift. Initial focused red run: 16 tests failed because the gate module was absent; the disabled runtime endpoint test already passed. After implementation and added edge cases, focused suite: 36 passed. Test-only serializer/collection warnings were removed; two existing upstream deprecation warnings and browser environment color warnings remain. Missing imports in later test additions were caught by Ruff and corrected before the final full run.

Coverage: real migrated SQLite claims and authenticated approval fixtures; signature/metadata/time/state/policy/config/simulation/verification/actor/action/allowlist refusal; unavailable risk/keyring; changed policy/risk/stress/path evidence; concurrent duplicate claim and sequential replay; distinct certificates sharing a wallet nonce or idempotency key; exact approval consumption; consent above autonomy limit and for new recipients even if signed approval flag is false; immutable certificate; linked claim audit and complete rollback when audit head is corrupt; expiry after recomputation; no public transaction/recheck injection; runtime execute remains NOT_IMPLEMENTED. No signer or RPC is invoked by this service.

Risk callbacks are isolated substitutes for missing trusted services, not product model evidence. No at-most-once signing, real broadcast/receipt, ledger reconciliation or full product acceptance gate is claimed. PF-014 stays open/blocked pending dependency integration and PF-015 orchestration. Testnet provisioning is documented in TESTNET_SETUP_CHECKLIST.md.

PF-014 review found a schema-valid historical certificate edit could free a previously reserved wallet nonce. The regression reproduced a second claim before the fix. Historical signature/hash/metadata checks now refuse corrupt history while authentic expired certificates retain their reservations; both cases have regression coverage. Historical verifier public keys must be retained to check reservations; missing keys fail closed.

## PF-006 Constitution lifecycle

After refreshing onto current `main`, `npm run check` passed 170 backend tests (15 PF-006 tests), 4 browser/API tests, Ruff, frontend lint/typecheck/build and generated contracts. `.venv/bin/alembic check` reported no new upgrade operations, and regenerated OpenAPI/TypeScript had no working-tree drift. The focused suite uses authenticated routes and migrated SQLite to cover competing confirmations, immutable history, stale/digest/replay/actor/metadata failures, audit rollback and readable rule diffs. An initial regression showed numeric JSON `1` could satisfy Pydantic `Literal[True]`; the HTTP handler now requires raw JSON boolean `true`. Browser Constitution Builder remains PF-019, and no AT-11/product gate is claimed.

## PF-008 named stress engine

The pre-refresh focused suite passed 15 tests. Tests cover exact individual parameters, every scheduled due date, cash segregation, income after the horizon, same-day income ordering, retained risky positions, allocation versus pure transfer, an additional future emergency without double-deducting realized expense, corrupt trusted input/duplicate schedule refusal and reproducibility. Review found that unrelated protected payments could release tuition protection; a regression reproduced it and goal-specific reserve accounting fixed it. No probabilistic assumption or configuration was activated, and public `/simulate` remains PF-009.

After refreshing onto current `main`, `npm run check` passed 185 backend tests and 4 browser/API tests, plus Ruff, frontend lint/typecheck/build and generated contracts. `.venv/bin/alembic check` reported no new upgrade operations, and regenerated OpenAPI/TypeScript had no working-tree drift. Historical branch evidence includes a 184-backend/4-browser passing integrated run and a later run with 184 backend tests passing but the browser suite at 3/4 because PF-033's five-second login redirect assertion timed out. The failure context later showed the sign-in page. Its cause remains unresolved; no timeout, retry, worker or assertion was changed in PF-008. The current pass does not explain or fix the older failure.

## PF-007 deterministic policy engine

Focused policy suite: 19 passed. Full `npm run check`: 204 backend tests and 4 browser/API tests passed, plus Ruff, frontend lint/typecheck/build and generated contracts. `.venv/bin/alembic check` reported no new upgrade operations, and regenerated OpenAPI/TypeScript had no working-tree drift. Coverage includes ordered outcomes for all eight Constitution families plus funding source, inclusive autonomy/concentration/Monte Carlo/reserve boundaries, separate tuition/emergency/other-protected accounting, no projected-income denominator inflation, allocation versus transfer classification, new-versus-blocked recipients, asset allowlist refusal, borrowed-funding denial, hard-failure precedence and corrupt trusted-evidence refusal.

Current-`main` refresh: the first full `npm run check` passed with 94 backend tests and 4 browser/API tests. A separate `--repeat-each=3` browser stress run then reproduced a distinct failure at 11/12: the failed page showed a 429 because the global limiter counted successful logins toward its five-attempt failed-credential budget. The limiter was changed to record failed credentials only, while preserving the sixth-attempt lockout after five wrong passwords. The focused PF-033 suite then passed 18 tests, the repeated browser run passed 12/12 under four workers, and the final full `npm run check` passed with 95 backend tests and 4 browser/API tests plus lint, typecheck, production build and generated contracts. `.venv/bin/alembic check` reported no new operations. The earlier integrated-stack five-second redirect timeout did not include this 429 evidence, so its root cause remains unresolved.

## PF-012 refresh after foundation merge

PR #35 refreshed from main at 9c49ef4815023c746b3c18556fe5963918731f2b. Fresh `npm run check` passed: 50 backend tests (including Farid's foundation regressions), 2 real browser/API tests, Ruff, frontend lint/typecheck/build and generated contracts. `.venv/bin/alembic check` passed with no new operations. Generated OpenAPI/TypeScript unchanged. This refresh enables main review; teammate approval is optional under the later owner waiver. No product issuance, policy activation or live execution is enabled.

## Post-foundation checklist refresh (#44)

Fresh `npm run check` on the #44 branch refreshed from main: PASS, 25 backend tests, 2 real browser/API tests, Ruff, contract generation, frontend lint/typecheck and production build. No generated OpenAPI/TypeScript drift. Root-config `.venv/bin/alembic check` passed with no new operations; an initial command incorrectly pointed to nonexistent `services/api/alembic.ini` and failed configuration loading before it was corrected. These are foundation tests; the previously reported 184/4 implementation-stack checkpoint is separate branch evidence. Prior implementation-stack browser timing failures remain unresolved; this run does not establish their root cause was fixed. No AT-01..AT-12 completion or genuine chain receipt is claimed.

Documentation checks: all 33 PF issues appear exactly once in owner checklists; dependency manifest matches live issue bodies, including #18's #33 gate; README link, Mermaid fencing and `git diff --check` validated. Foundation #34/#42 merge and current main protection verified through GitHub. Independent reviews remain outstanding on #35–#41/#43/#44.

Subsequent integrated-stack revalidation FAILED: 184 backend tests passed; 3 browser/API tests passed and PF-033 login redirect assertion timed out at 5000ms. Its later snapshot showed the sign-in page, but the causal issue remains unresolved. No test settings were changed. This separate stack failure does not replace the passing #44 foundation-only check above. Full record is on PR #43 / issue #33.

## Teammate approval waiver (2026-10-16)

The owner waived teammate approvals going forward while requiring care not to break the project. Only GitHub's mandatory approval count (1 to 0) and CODEOWNER approval (true to false) changed; an API comparison confirmed every other branch-protection field identical. Required PRs, strict foundation CI, conversation resolution, admin enforcement and force-push/deletion restrictions remain. Lead acceptance of sensitive/shared changes and contract-change procedure remain procedural requirements.

Fresh `npm run check` passed: 25 backend tests, 2 real browser/API tests, Ruff, generated contracts, frontend lint/typecheck/build. The first invocation failed typecheck because ignored `.next` validators from the auth branch referenced `/login`, absent on this foundation-only branch. Removing that ignored cache and rerunning the entire check passed. No runtime/test source or test settings changed; the separate PF-033 browser timing failure remains unresolved. AI documentation review identified stale current-checkpoint/CODEOWNERS comments; both were corrected. No teammate approval is fabricated.

## PF-018 / PF-019 PR-stack review (2026-10-16)

PF-018 at 5dfbc0c: local `npm run check` passed 227 backend / 16 browser tests; contract generation, Ruff, lint, typecheck and build passed, with no generated drift. GitHub foundation CI passed; merged #48 at be3b419. PF-019 refreshed head 74405e7 initially passed 227 backend / 27 browser tests and hosted CI.

The unchanged #56 full browser rerun failed AT-11 with expected 11100 / actual 14000 (64 passed, 5 existing blocked-gate skips, 1 failed). PF-022's unknown-certificate check passed on that run; this does not fix the earlier #53/#54 timeout. #53's preserved CI snapshot instead shows an empty Certificate ID and client validation, not proof of a slow backend response. Its cause still needs a controlled reproduction.

PF-019 controlled regression holds one actual initial drafts response until the second load has displayed the form and the user has entered 111. Before the fix, the late response reset the field to 150 (21 prerequisite checks passed / 1 regression failed). After guarding load generations and cleanup, the same focused regression passed 1/1. No timeout, retry, worker setting or assertion was weakened. An initial root-workspace grep invocation collected no tests because npm consumed the flag; it is not validation evidence.

PF-019 final local full check after the guard: PASS, 227 backend / 28 browser tests, contracts, Ruff, frontend lint/typecheck/build. A cleanup-ref lint warning was removed by naming the cancellation callback; a separate final lint run passed without warnings. The same guard and regression are carried forward intact into PF-021. Hosted CI on the final head remains required before merge.

PF-021 refreshed against main after PF-019: `npm run check` PASS, 227 backend / 35 browser tests; Ruff, contracts, frontend lint/typecheck/build passed. Test simulation output displays the fixture warning; normal runtime assumptions remain unset. This is browser/engine fixture evidence, not approved financial probabilities or full product gate sign-off. Original baseline income and $200 shortfall are unchanged.

## PF-034 local portability validation (2026-10-16)

`npm run contracts` using the new runner passed with no generated drift. `npm run check` on the PF-019-integrated base passed 227 backend / 28 browser checks, Ruff, contract generation, lint/typecheck/build. Removed ignored Next validators from the previously checked-out larger UI stack before this check. The branch then merged current main including PF-021 intact; full combined validation and actual Windows bootstrap/check execute in hosted CI. No actual local Windows host was available, and local macOS success is not Windows evidence. No check is removed or weakened.

PF-034 first hosted Windows run (38892846725): bootstrap and Chromium installation passed, but full check failed before Ruff because cmd interpreted the Python path as `.venv`. The check runner incorrectly applied shell mode to Python as well as npm. Shell mode is now limited to npm; Python runs directly, matching the already portable contract runner. Current-head hosted validation must confirm the repair; no Windows pass is inferred from the successful bootstrap.
