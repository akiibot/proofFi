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

PF-034 hosted repair evidence: [CI run 38893104695](https://github.com/akiibot/proofFi/actions/runs/38893104695) at d9cbb3a passed on both Ubuntu and Windows. Actual Windows bootstrap, 227 backend tests, 35 browser tests, contract generation, lint/typecheck/build, contract drift, migration drift and audit all passed; audit found zero vulnerabilities. This verifies the platform tooling repair while retaining the preceding failed attempt above.

Separately, the refreshed complete UI/demo stack at bd441e2 passed local full validation: 233 backend / 66 browser tests, 5 existing backend/chain-blocked skips. Refreshed #51–#57 hosted checks passed; #57's final evidence-only commit is checked separately. AT-11 now passes after the controlled PF-019 fix. Earlier PF-022 browser timeout remains unexplained and is not claimed fixed. All remaining dependency gates, the AT-01 receipt-coverage review finding, disabled public execution, original $200 shortfall and lack of approved runtime financial assumptions remain.

## PF-029 trusted issuance evidence (2026-10-16)

Baseline backend suite passed 227 tests. Initial PF-029 red run: all 26 tests failed against the explicit unfinished `/verify` response. After implementation those 26 passed; expanded security/integration coverage passed 39, followed by 46 focused PF-029 tests including independent execution-claim recomputation, corruption, missing/ambiguous configuration, failed/missing/duplicate named stresses, key mismatch, operational/RPC refusals, concurrent issuance, and complete rollback on simulator/signing/audit/lock/commit failures. The certificate + issuance + execution-claim integration run passed 100 tests before the seven final failure-path cases were added.

RPC substitutes exist only in isolated tests; risk/policy arithmetic, Ed25519 signing, migrated SQLite and authenticated routes are real. The positive fixture explicitly stages extra cash and invented zero-risk assumptions solely in a temporary DB; the original $12,000 baseline is independently restored and denied before RPC/key loading. No fixture output is a product financial approval, live-chain or receipt claim. Public `/execute` remains NOT_IMPLEMENTED.

The independent code review found no blocking defects. Suggested additional state/config/stress and transaction-boundary regressions were added and passed. PF-012's obsolete assertion that `/verify` always returns 501 was replaced with explicit 503/UNAVAILABLE and no certificate when authority is unconfigured; no security gate was softened. Initial Ruff found formatting/import issues in the newly written tests; formatting/import cleanup resolved them before validation. Existing two upstream dependency deprecation warnings remain. Generated OpenAPI/TypeScript and Alembic drift checks passed unchanged.

First PF-029 full check FAILED: backend 266 passed (before the final seven failure-path tests were added); browser 24 passed / 1 failed / 10 dependent journeys did not run. The unchanged PF-018 unbuilt-navigation test failed in auth-helper.ts:12 because Sign out was not visible after 5000 ms. Snapshot showed the login page, empty password input, enabled Sign in, Next Rendering indicator and no error. No network-response evidence established a cause. Three focused unchanged reruns of that test passed 3/3; this does not fix or explain the earlier failure. Tracked separately as PF-035/[#60](https://github.com/akiibot/proofFi/issues/60). No browser timeout, assertion, retry or worker setting changed.

Final unchanged-code full rerun: `npm run check` PASS, 273 backend tests (46 focused PF-029), 35 real browser/API tests, Ruff, contract generation, frontend lint/typecheck/build. `alembic check` found no new operations; regenerated OpenAPI/TS have no diff; npm audit found zero vulnerabilities. This passing rerun does not explain or repair the preceding PF-035 login failure. Current hosted CI and lead security acceptance remain required before merging issuance.

## PF-014 internal signing evidence (2026-10-16)

Command: `.venv/bin/python -m pytest services/api/tests/test_pf_014_signing.py services/api/tests/test_pf_014.py services/api/tests/test_pf_029.py -q` — **106 passed**, two existing dependency deprecation warnings. Initial missing-boundary run: 17 failed, establishing the red phase. Final coverage includes concurrent requests, exact recovered transaction bytes, changed state/configuration/approval/chain fields, expired certificates before and during checks, malformed or altered signer output, missing keys, nonce collisions, and failures after signing. Permanent claims prevent a second signer attempt. Public `/execute` still returns 501.

These are isolated test fixtures, not live transfers or financial approvals. The reviewer agent hit its usage limit and produced no PF-014 review. Full check and hosted CI remain pending at this entry.

PF-014 final local validation: `npm run check` PASS — 297 backend tests, 35 browser/API tests, Ruff, generated contracts, frontend lint/typecheck/build. Generated OpenAPI/TypeScript have no diff. Root `.venv/bin/alembic check` passed with no new operations; an initial command incorrectly selected nonexistent `services/api/alembic.ini` and failed configuration loading. `npm audit --audit-level=high` found zero vulnerabilities. Current hosted CI and lead security acceptance remain outstanding; no earlier browser timing failure is claimed fixed.

## PF-010 integration review (2026-10-17)

At b83951a, focused tests passed 32. First browser attempt lacked the new worktree's local demo credentials; the repository provisioner corrected that setup. The next full run passed 305 backend tests but failed foundation signIn at auth-helper.ts:12 (Sign out absent after 5000 ms): 24 browser passed, 1 failed, 10 blocked. Snapshot showed busy login. Three separate real logins passed with credential-safe timing: first Sign out about 2992 ms after click, subsequent 385/351 ms. This does not prove the failed run's cause. Final unchanged-code `npm run check` passed 305 backend / 35 browser/API tests, Ruff/contracts/lint/typecheck/build. Generated contracts unchanged. Alembic check passed after applying existing migrations to the fresh isolated worktree database; the initial empty-database check correctly refused as not up to date. Both hosted CI jobs passed before merging #62 at 8385d92. PF-035 remains unresolved; no timing, retry, worker, assertion or source change is claimed as a repair.

PF-017 review-machine live check (2026-10-17): configured vertex_express request returned explicit UNAVAILABLE. Credential-safe exception-location tracing identified TimeoutError while awaiting the provider HTTP response at provider.py:142 under the existing eight-second socket timeout. No rejection status or successful current-machine inference was obtained; this does not invalidate or independently reproduce the author's earlier successful evidence. No key, response body, secret diagnostic message, DB write or authority activation was logged. Focused planner suite: 29 passed.

## PF-017 merged integration evidence (2026-10-17)

At code head 383489b plus documentation-only 129f3f5, focused planner suite passed 29. Full `npm run check` passed 334 backend / 35 browser/API tests, Ruff/contracts/lint/typecheck/build. Generated OpenAPI/TS unchanged. Exact merged head 129f3f5 had Ubuntu foundation and Windows success (run 38950384698) before merge #63 at 5b4d266. Current-machine live response timeout remains separately documented; no retry/timeout/assertion changed.

## PF-037 storage contract evidence (2026-10-17)

Initial missing-table run: 15 failed. First implementation: 15 passed. Additional
boundary regressions: 2 failed / 15 passed, exposing REPLACE-trigger bypass and
SQLite accepting text in the binary column; fixed with a pre-insert collision
guard and typeof(blob) check. Populated-downgrade regression then failed before
a pre-DDL refusal was added. Final focused journal tests: 19 passed; journal plus
foundation migration roundtrip: 20 passed. Covers exact 1/4096-byte roundtrips,
zero/oversized/text rejection, FK/unique claim/hash constraints, direct SQL
update/delete/replace refusal and safe additive upgrade/downgrade behavior.
Fixtures are explicitly opaque storage bytes, not valid transactions or receipts.

First full check stopped after backend: 376 passed / 1 failed, the existing
foundation exact-14-table assertion. Replaced with an explicit complete list of
15 expected tables, retaining migration roundtrip, FK and drift assertions.
Final full check and current CI are required before contract acceptance. No
public contract, canonical certificate or financial assumption changed.

PF-037 final local full check: `npm run check` PASS, 377 backend tests and 35
real browser/API tests, Ruff, contract generation, frontend lint/typecheck/build.
Applied the additive migration only to the isolated review-worktree database;
`alembic check` reports no new operations. Regenerated OpenAPI/TypeScript have
no diff. No developer-runtime database or financial configuration was migrated
or activated by this review. Current CI and separate lead contract review remain
required before merging this proposed private storage change.

## PF-014 signing merged integration (2026-10-17)

At dda2852, focused signing/guards/issuance tests passed 106. Full `npm run check` passed 358 backend / 35 browser/API tests with Ruff/contracts/lint/typecheck/build. Generated OpenAPI/TS unchanged. Exact-head Ubuntu and Windows CI passed (run 38951213358), then #64 merged at fac69aa. Lead integration/security review found no blocking defect for the internal one-attempt slice; the failed independent agent attempt remains recorded and is not presented as an approval. Public execution stays 501, with no durable signed bytes/broadcast/receipt evidence.

## Base token preparation review (2026-10-17)

Independently ran solcjs 0.8.24 standard JSON, source unit MockUSD.sol, optimizer enabled/200 runs, Paris EVM. Zero compiler errors. Compiled creation bytecode is 2016 bytes; both source SHA-256 and creation-bytecode keccak match #67's manifest exactly. No Base transaction was sent, and null receipt fields remain null. Any isolated local EVM checks are separate from live deployment evidence.

PF-037 final review added BEGIN IMMEDIATE to downgrade before its emptiness check, serializing that check and DDL against a concurrent application insert. The existing 20 migration/storage focused tests passed unchanged after this hardening. Current-head hosted full checks must pass; no new runtime path or public API change.

## PF-035 controlled authentication and harness evidence (2026-10-17)

No-JS probe: input/submit enabled; native GET would include password query.
Used only a public isolated string, intercepted before network. Two new browser
regressions failed against old main and passed after hydration-gated controls
and method=post fallback. Held scripts are actual JavaScript responses continued
after release, not substituted application data. Lint/typecheck passed.

First full check: backend 382 passed; browser 36 passed / 1 failed at the existing
PF-019 late-load test's Save draft visibility assertion. Safe snapshot showed the
Constitution page loading with Sign out present. Controlled real GETs showed
arrival [1,2], completion [2,1]; the old post-fetch counter held response 2 and
UI correctly waited for it. Fixed arrival-order bookkeeping and forced fetch
completion order; no assertion, timeout, retry, worker or production Constitution
change. Mutation check temporarily removed generation protection: regression
failed expected 111 / received 150. Restored original source exactly: regression
passed. Final npm run check passed 382 backend / 37 browser/API tests, all
lint/typecheck/build/contracts; generated API artifacts unchanged. Historical
busy-login timing and PF-022 certificate-field causality are not claimed fixed.

PF-011 #70 current Ubuntu log independently confirms 382 backend / 35 browser
passes (run 38954273310) before its merge at 9c7954c. PF-035 changes only login
readiness/native submission and the controlled regression harness.

PF-035 merged via #71 at 2b83c88d64baefa08fb4753a76fbcd71bee2df83 after local 382 backend / 37 browser/API tests and both exact-head hosted jobs passed (run 38956023727). Only the demonstrated native-submit/readiness defect and response-ordering harness bug are claimed fixed.

PF-038 real diagnostic: child-process socket bound 30 seconds, production unchanged at eight. Actual provider HTTP 200, STOP, strict Proposal validation passed, 13.03 seconds total; 243 prompt + 58 candidate + 100 thinking tokens = 401. No raw body/key/reason or private configuration was printed; no DB write/signing/approval occurred. This is adapter diagnostic evidence, not a successful normal eight-second end-to-end workflow. Tracked in #72.


## PF-015 internal dispatch preparation (2026-10-17)

Initial focused run: 17 passed / 2 failed. Both failures assumed seed version 1,
whereas the genuine issuance fixture creates version 2; assertions and CAS updates
now derive the actual version. No production behavior or timing was weakened.
The corrected combined dispatch/signing/journal run passed 62 tests. Three added
regressions cover missing signing provenance, a failure after dispatch reservation
commit, and certificate expiry during live checks. Final dispatch focus: 22 passed.

Tests verify committed raw bytes/hash and dispatch reservation from a separate
connection inside the substituted send, concurrent at-most-once dispatch, timeout
and unexpected acknowledgement hash preservation, authority/state/audit binding,
changed network/nonce/decimals/gas/balance, failed audit writes, forged handoff
refusal, no raw bytes in audit, and the unchanged public HTTP 501 boundary.
No receipt or live-chain success is asserted. Full check evidence follows.

Final `npm run check`: PASS, 423 backend tests / 37 browser/API tests, Ruff,
contract regeneration, frontend lint/typecheck/build. Generated OpenAPI and
TypeScript are unchanged. No browser failure occurred in this run. Current-head
hosted CI and execution security review remain required before merging the slice.

## PF-015 receipt reconciliation focus (2026-10-17)

First run: 25 passed / 5 failed. The failures came from two isolated fixture errors:
TransactionNotFound requires a message; the signing counter fixture was installed
after the dispatch fixture had signed. Corrected the fixture exception and explicit
fixture dependency, without changing production receipt checks. The corrected run
passed 30 tests. Added confirmation-depth loss/reversal, late-ledger-conflict
savepoint rollback and TRANSFER accounting; 33 passed. Additional coverage checks
advanced-current-state metadata, canonical block changes during observation and a
larger confirmation threshold. Final focused/full results follow.

Fixtures use real issuance, risk recomputation, Ed25519/EVM signatures and SQLite;
RPC responses/logs are isolated synthetic data. Production receipt validation runs
in those tests. One TRANSFER arithmetic test substitutes the observation boundary
explicitly to isolate accounting; it is not receipt-validation or live evidence.


Broader focus passed 128 signing/dispatch/transport/journal/reconciliation tests.
The first full check passed 459 backend / 37 browser/API tests and all static
checks. Subsequent review added recovery-error checks before internal signing and
under handoff/dispatch locks, with two additional regressions (38 reconciliation
tests passed). The race test prepares a second genuine transaction before a
reorg causes a recovery conflict without advancing financial state. Temporarily
removing only the dispatch-lock guard made that regression fail (DID NOT RAISE);
restoring the exact production source made it pass. No mutation remains. Full
validation is repeated because this security concern changed production code.


Further security review added cross-nonce unsettled-attempt exclusion and a fixed
per-attempt confirmation threshold. This prevents overlapping unsettled planning
budgets and prevents later operator threshold changes from creating false reorg
results or reducing the required confirmation count. Final full validation runs
after these changes; earlier full results are retained as historical evidence.

Final reviewed `npm run check`: PASS, 463 backend / 37 browser/API tests,
Ruff/contracts/lint/typecheck/build. Generated OpenAPI and TypeScript unchanged.
Final dispatch/reconciliation focus passed 62 tests (40 reconciliation + 22
existing dispatch). No browser failure occurred in these runs; historical PF-035
observations remain open and are not claimed repaired by this backend work.
Current-head hosted CI and execution/security review remain required before merge.

## PF-014 internal integration (2026-10-17)

Five new tests first failed because execute_internal did not exist, then passed
with the composition implemented. Tests exercise real issuance/signing/SQLite;
RPC is substituted only in isolated fixtures. Existing-attempt confirmation uses
production raw-receipt validation. New/ambiguous-send composition tests explicitly
substitute receipt observation with None and do not claim receipt-validation or
live evidence. Covers matching resume with no second signing/send, mismatched
request identity, stranded claim refusal and unchanged public HTTP 501.
Full check evidence follows; no test timing or existing assertion was weakened.

Final npm run check passed: 468 backend /37 browser/API tests, Ruff, generated
contracts, frontend lint/typecheck/build. Public OpenAPI/TS unchanged. Current
hosted CI and lead-workstream execution review remain required before merging.

## PF-015 read-only recovery inspection (2026-10-17)

Three new tests failed with missing inspect_recovery, then passed. Full
reconciliation focus:43 passed. Tests verify wrong-actor refusal, no RPC query,
unchanged current financial state/audit row count, no raw-transaction report field,
and later-state/reorg conflict identification without automatic reversal.
The report describes persisted evidence only; no real receipt or recovery mutation
is claimed. Full repository validation follows.

Final npm run check passed471 backend /37 browser/API tests, Ruff, contract
regeneration and frontend lint/typecheck/build. Generated public contracts are
unchanged. Current hosted CI and lead review remain required before merge.

## PF-015 guarded operator recovery (2026-10-17)

Five new tests first failed because recover_unchanged_assets was absent. The
initial full reconciliation focus then passed48. Added wrong-actor, RPC failure
and final audit failure rollback cases; final reconciliation focus passed51.
Tests prove unrelated later metadata survives exact affected-asset reversal,
changed cash/position and stale inspected hash refuse, canonical reconfirmation
refuses, repeat calls refuse and failed recovery writes roll back entirely.
Existing automatic-later-state conflict regression remains unchanged/passing.
Independent agent source review found no blocking issue; it did not run tests.
Final npm run check passed479 backend /37 browser tests and all static/contracts/
build checks, public generated contracts unchanged. All chain responses here are
isolated fixture data. No live recovery or new human financial approval claimed.

## PF-022 controlled hydration regression (2026-10-17)

Before fix:2 new browser tests failed (expected disabled, received enabled), with
JavaScript absent and with actual script loading deliberately gated. After fix:
41 read-only browser tests passed, including both controlled regressions and real
backend unknown-certificate409/retained ID/no decision or execution panels.
The broad pf-022 path selector matched the worktree path, so this run covered all
read-only tests rather than only PF-022. No response data was substituted. No
assertion, timeout, retry or existing test was weakened. Full check follows.
Historical intermittent certificate/login waits are not collectively claimed fixed.

Final PF-022 npm run check passed479 backend /55 browser tests and all static,
contract-generation and production-build stages. Independent review inspected
source/tests and found no actionable issues; it did not execute tests. No generated
public schema drift. This is browser/backend fixture evidence, not a live execution.
## PF-016 internal preparation, initial validation (2026-10-17)

Nine focused tests passed after a review regression reproduced a configuration
A -> B -> A gap (the expected DomainError was not raised). Finalization now binds
the real persisted verification/simulation and signed certificate to optimization.
Independent source review found no unresolved actionable findings; the reviewer
did not run tests. No approval/execution service or public route was enabled.

Initial full npm run check passed488 backend tests and Ruff/contracts/frontend
lint/typecheck/build, but failed browser acceptance:26 passed,1 failed,10 did
not run. The first foundation login expected Sign out within5000ms; the snapshot
showed an empty password field and enabled Sign in. Its financial-state response
wait then ended with the failed test. This is unresolved PF-035 evidence, not a
workflow repair or passing full check. No timeout, retry or assertion was changed.
Private run log: /tmp/pf016-full-check.log (local artifact, not checked in).

A temporary credential-safe diagnostic reproduced the login assertion failure
with unchanged signIn helper. It logged only relative timing, URL pathname and
HTTP status. Login POST began at3267ms and returned200 at7107ms; dashboard
navigation occurred at7582ms, then financial-state responses were200 at7868/
7958ms. Failure snapshot already showed the real dashboard and Sign out. This
supports a boundary timing failure involving successful login/navigation; it does
not prove the initial run's root cause or fix PF-035. Temporary diagnostic removed.

Unchanged full browser repeat also failed at the same foundation Sign out
assertion:26 passed,1 failed,10 did not run (3.5m). Final focused workflow repeat
passed9 tests (46.59s), Ruff and git diff --check passed. Draft PR #80 preserves
these failures; no failing change is merged and PF-035 is not claimed repaired.
## PF-032 current-main refresh (2026-10-17)

Draft #77 merged main f88214b, preserving both conflicting documentation sections
and all emergency source/tests. Focus:13 passed. Full npm run check:492 backend,
37 browser tests, Ruff/contracts/frontend lint/typecheck/build all passed.
Public generated contracts unchanged; full integration/live prerequisites remain
incomplete. This is isolated test evidence, not runtime emergency or chain evidence.


## PF-020 independent current-main integration (2026-10-17)

Based on main de3921c. Focused Workspace: 8 passed. Final `npm run check`
exited 0: 527 backend tests, 48 browser/API/proxy tests, Ruff, generated contracts,
lint, typecheck and production build passed. Existing two Python deprecation
warnings remain. No generated OpenAPI/TS change; `git diff --check` passed.

Initial full run: 527 backend passed; browser 37 passed, one failed, ten not run.
The new intent transport test expected generic fallback text, but the real browser
error is "Failed to fetch". Corrected the expectation and reran focused/full checks.
No timeout, retry, skipped test or production error behavior was relaxed.
Tests exercise the real deterministic demo planner and real unconfirmed-policy
refusal in disposable e2e.db. Pure result-format tests are fixtures, not a claim
of positive funded-scenario, certificate issuance or live-chain acceptance.


## PF-024 independent emergency UI (2026-10-17)

Base main 9da89ae. Focused PF-020/PF-024: 13 passed. Full npm run check
exited 0: 527 backend / 53 browser/API/proxy tests; Ruff, contracts, frontend
lint, typecheck and production build passed. Generated contracts unchanged;
diff check passed. Two existing Python deprecation warnings remain.

Real browser/API cases cover missing confirmation, unconfirmed-policy refusal,
version conflict, and response loss without a blind retry. The successful-result
render case substitutes a response only inside an isolated test; it is not a real
financial-state change, positive funded demo, certificate or testnet outcome.
Existing PF-032 tests exercise actual atomic repricing and stale certificates
with isolated chain bounds. No financial/runtime/signing configuration changed.
## PF-014 authenticated public executor (2026-10-17)

Initial HTTP adapter regression: 8 failed / 4 passed against the 501 handler.
First implementation: 12 passed. Expanded HTTP and existing signing/dispatch/
reconciliation focus: 119 passed. Final npm run check exited 0: 544 backend,
48 browser/API/proxy tests; Ruff/contracts/lint/typecheck/build passed. Generated
OpenAPI and TypeScript unchanged; git diff --check passed. Two existing Python
deprecation warnings remain. RPC responses in executor integration tests are
isolated fixtures; genuine signing, auth, authority checks and SQLite persist.
No runtime signing, human consent or live application transfer is claimed.

## PF-036 create-only funded scenario provisioner (2026-10-18 Asia/Dhaka)

Focused: 9 passed, including real migrations, existing-path refusal, exact digest
confirmation, preservation of baseline, no policy confirmation, audit-failure
rollback and invalid selection cleanup. Initial focused run exposed unsupported
nested model objects in the audit digest; converting each model to canonical
JSON fixed it. Final full npm run check exited 0: 536 backend /48 browser tests
and Ruff/contracts/lint/typecheck/build passed. Public generated contracts have
no changes. Preview prints the chosen config/digest without creating a database.
All databases in tests are isolated; no live runtime policy or funds activated.

PF-024 refreshed against main 81865d8 on 2026-10-18 (Asia/Dhaka): full
npm run check passed, 553 backend and 53 browser/API/proxy tests; Ruff,
contracts, lint, typecheck and build passed. An earlier run passed backend and
build stages but could not start browser API because the local demo server
occupied port 8000; stopped that server and reran the complete check successfully.
Generated OpenAPI/TS unchanged. Hosted current-head Ubuntu/Windows CI required.
## PF-031 controlled malicious planner (2026-10-18 Asia/Dhaka)

Nine focused tests passed. Full npm run check passed: 562 backend /48 browser
API/proxy tests; Ruff/contracts/lint/typecheck/build passed. Generated public
OpenAPI and TS are unchanged. Test signer-construction/sign spies fail on any
invocation. Actual configured isolated-demo API also returned verifier DENY,
no certificate, executor INVALID_CERTIFICATE, signer_called=false, tx_hash=null,
with execution/envelope/state counts unchanged at 1/1/3. The executor proof is
its production claim boundary, which has no signer/send capability; it is not a
new blockchain transfer. Red-team UI and full AT acceptance remain outstanding.
## PF-040 read-only chain readiness (2026-10-18 Asia/Dhaka)

Sixteen focused authenticated route tests pass. First full npm run check passed
569 backend tests, Ruff/contracts/lint/typecheck/build; browser stage could not
read .local/demo-password.txt in this reused worktree (16 failed, 22 passed,
10 dependent journeys not run). This is a local setup failure, not evidence of
PF-035 hydration causality. Provisioned isolated worktree-only test credentials;
complete npm run check rerun passed: 569 backend /48 browser tests plus
Ruff/contracts/lint/typecheck/build. Generated OpenAPI/TS unchanged. A separate
read-only live service call returned READY with sender token balance10000000000
and native96420441726753wei; it loaded only RPC/wallet/token settings and did not
activate the proposed route or execute a transaction.

## PF-041 new-recipient emergency regression (2026-10-18 Asia/Dhaka)

Controlled red: a confirmed allowed-token policy with no known recipients returned
403 instead of repricing. Green: HTTP200, policy ID/rules unchanged, exact200000-cent
expense, no approval/execution, and real verifier REQUIRES_APPROVAL for the safe
proposal. Initial focus14 passed. First full check:572 passed/1 failed due to a
second obsolete unknown-recipient refusal expectation. Replaced that case's setup
with an explicitly blocked recipient, retaining its403/no-debit assertions; the
new unknown-recipient consent regressions remain. All42 focused emergency tests
pass. Full refreshed check/current CI and lead review remain required.

PF-041 refreshed main0f735bc full npm run check passed:582 backend /48 browser
checks plus Ruff/contracts/lint/typecheck/build. Test collection independently
confirmed582 cases. All42 focused emergency integration tests pass. Generated
OpenAPI/TS unchanged; no runtime expense/approval or Constitution change performed.
## PF-023 independent red-team UI (2026-10-18 Asia/Dhaka)

Full `npm run check` PASSED on main0f735bc plus this issue: 578 backend and
53 browser tests, Ruff/contracts/lint/typecheck/build. All five PF-023 browser
cases passed in that run with unchanged assertions and sign-in helper.
The first focused run found three ambiguous alert locators (Next route announcer
also has role=alert); scoping to main fixed those test selectors. The next focused
run passed4/failed1, and a response-loss-only rerun failed1: both failures were
in the existing sign-in helper waiting5s for Sign out, before the attack test ran.
No timeout extension, retries, shared auth change or skipped assertion was added.
Later full success does not establish a causal PF-035 fix.

Separately, genuine browser -> Next proxy -> existing isolated demo API passed
without route interception/service substitutes: HTTP200, DENY/no certificate,
INVALID_CERTIFICATE, signer_called=false, tx_hash=null, three matched audit events.
Execution/envelope/state counts stayed1/1/3. Public evidence is
`evidence/red-team-browser.json`; the final screen was visually checked locally.
Frozen `controlled-attack.json` + `red-team-recorded-audit.json` replay in two
isolated rendering tests is clearly labeled and is not claimed as backend proof.
Lost-response coverage uses a real route request then drops the response; it
requires an unknown-outcome message and disabled blind retry. No money was sent.


## PF-022 refreshed approval/execution screen (2026-10-18 Asia/Dhaka)

On reviewed main9c840e1, source64b193c: focused PF-022 browser checks14/14;
full `npm run check` exited0 with596 backend and76 browser tests, plus Ruff,
contracts, frontend lint/typecheck/build. Generated OpenAPI/TypeScript unchanged.
The existing hydration guard and genuine invalid-certificate refusals remain.
Five new browser-state fixtures cover lost execution/decision responses across
reloads, original-key reconciliation only with a recorded claim, preservation of
a real response after a failed follow-up read, and corrupt retained identity.
Their status/audit/transaction responses are explicitly isolated fixtures; they
do not establish actual approvals, live receipts or complete AT-01.

Visual review corrected one hint on62a0b48: reconciliation requires original
identity and a matching claim, without asserting the current tab possesses it.
Genuine read-only browser evidence is evidence/certificate-browser.json/.png:
21 hash-linked events, ten certificate/execution links, actual expired signature
verified and final approval visible, no new attempt/reconciliation offered without
original identity. State/audit unchanged; execution/envelope/state counts1/1/3.
This is genuine existing-history observation, not a new execution or full AT-01.
