# Progress

## PR-stack checkpoint (2026-10-16)

GitHub-authoritative: PF-009 merged via #47; PF-018 via #48 (`be3b419`); PF-019 via #49 (`d062b1f`) after fixing and testing an obsolete-load form overwrite. PF-021/#50 is being validated against current main. PF-025/#51 is blocked on PF-016; #52–#57 retain stack/backend blockers. The older checkpoints below are historical evidence. The owner waiver removes teammate-approval requirements, not current CI or dependency gates.

## Current review policy

On 2026-10-16 (Asia/Dhaka), the repository owner instructed: "you dont need team mate approvals from now on" and "But make sure not to break anything". Teammate approval is waived for subsequent PRs. This supersedes the earlier #34-only waiver. PRs, passing current CI, dependency checks, lead review of sensitive/shared changes, separate contract-change PRs, and honest local test evidence remain required. This waiver is not a financial approval, policy activation, or architecture change.

## Current authoritative checkpoint

Foundation PR #34 merged into main at `9c49ef4815023c746b3c18556fe5963918731f2b`, including Farid’s reviewed #42 fixes. Issues #1–#5 are closed. The initial #34-only waiver is superseded by the 2026-10-16 owner waiver above. Teammate/CODEOWNER approval is optional; strict foundation CI, required PRs, lead review of sensitive/shared changes and admin enforcement remain. Both teammates have accepted write access and issues are assigned; #26 is shared by all three.

Checklist PR #44, certificate PR #35, signer/RPC PR #36, authenticated-session replacement PR #45 and approval PR #38 are merged. Original auth PR #37 was closed after its deleted stack base left it unable to schedule current CI. Open PRs #39–#41 and #43 remain branch implementations and need dependency-order refresh; #39 is independent onboarding documentation, while #40 is only execution claim guards. Trusted issuance #29 remains blocked on #7/#9 even though #12 is merged; real execution additionally lacks provisioned testnet infrastructure. The original $200 shortfall remains, and no income/probability assumptions are activated. The earlier integrated-stack PF-033 redirect timeout remains documented with no proven causal link to the later successful-login rate-limit fix.

#44 merged into `main` at `86719dd`; its fresh `npm run check` passed 25 backend / 2 browser tests and its migration drift check passed (see TEST_RESULTS.md). PF-008 and PF-017 are ready for Farid, and PF-018 is ready for Wasik now that PF-033 is merged. Existing implementations should be reviewed rather than duplicated. No dependent issue is closed merely because code exists on a branch.

The sections below are historical records from before foundation merge; their pending invitation/review statements describe those checkpoints, not current state. Prior browser timing failures are unresolved; a passing run does not establish a causal fix.

## Foundation interval

Repository initially contained only an empty Git repository. Both supplied documents were read completely as text; they are retained under docs/reference for teammate context. Current scope is foundation and issue backlog, not the rest of feature implementation.

| Gate | Implemented and validated | Remaining handoff gate |
|---|---|---|
| PF-001 | Locked dependencies; bootstrap, paired startup, real UI/API state fetch | Reviewed foundation merge |
| PF-002 | Canonical domain schemas, OpenAPI, generated TS/client, exact-money/transaction tests | Lead architecture/contract approval |
| PF-003 | 13 domain tables, Alembic upgrade/downgrade, idempotent seed, state CAS/digest checks | Reviewed migration merge |
| PF-004 | Base Sepolia/transfer design, exact calldata schema, signer protocol, backend-only secret placeholders | Confirm actual token/destination/funded wallet before chain work |
| PF-005 | Contributor guide, ownership, issue/PR templates, CODEOWNERS, CI, published backlog | GitHub reviewer identities and branch settings/evidence below |

Published **33 actual GitHub issues**, PF-001..PF-033. Verified **28 dependent feature issues labeled status:blocked**, 14 lead-owned/coordinated issues assigned akiibot. Farid and Wasik are named owners in bodies, pending their exact GitHub handles. No issue is marked complete and no feature gate is unblocked before reviewed merge.

Local validation: 20 backend tests and 2 browser tests pass; lint, typecheck, production build, contract generation, migration drift and npm audit pass. Exact results in TEST_RESULTS.md. Initial bootstrap exposed environment string parsing for chain ID; fixed with a regression test. An initial migration test expected the wrong table count; corrected to 13 domain tables plus Alembic metadata. Removed a vulnerable lint dependency chain; audit now zero findings.

Financial decisions remain explicit: no expected income assumed, no Constitution active, no simulation config approved. Literal baseline is short $200 before fees/shocks. Positive hero demo and lower emergency outcome need an explicitly approved assumption set. All product AT-01..AT-12 and live-chain evidence remain NOT PASSED.

## Integration status

Foundation is on `codex/prooffi-foundation`, with a minimal README-only main bootstrap to enable PR review. Architecture approval and merge remain pending. See the foundation PR and GitHub CI rather than assuming local checks imply remote checks.

## Next work after approved foundation merge

Lead: PF-033 authenticated sessions and PF-012 crypto primitives; PF-030 chain adapter. Farid: PF-008 stresses and PF-017 planner, then PF-006 once authenticated sessions land. Wasik: PF-018 dashboard integration. Continue small vertical slices and rerun browser/API tests at every integration.

## Foundation handoff evidence

PR: https://github.com/akiibot/proofFi/pull/34 (open; not merged). Fresh-checkout bootstrap and full validation passed. Main branch protection configured and API-confirmed: PR review, one approving reviewer, CODEOWNER reviews, dismissal of stale reviews, required foundation CI with up-to-date branch, conversation resolution, administrator enforcement, force-push/deletion disabled. Farid/Wasik must be invited with confirmed handles before they can review.

## Architecture approval and confirmed team identities

On 2026-10-15 the lead explicitly approved the foundation architecture in this chat. DECISIONS.md now records acceptance of v1.0.0 and D01–D15. Approval does not invent financial assumptions or constitute another developer's GitHub review.

Verified accounts: Wasik = @WasikZubair, Farid = @Alfa5nm. GitHub confirmed write-access invitations (IDs 337849125 and 337849127). At the assignment check, their invitations were still pending; GitHub did not add them as issue assignees. Their owner roles and intended assignees are recorded in the versioned manifest and issue bodies. Retry assignment after acceptance; do not claim assignment from a successful HTTP response unless the returned assignee list contains the handle.

CODEOWNERS includes both confirmed accounts and routes modules according to ownership, with finance review available for lead-authored security changes. Lead approval remains a procedural requirement for every sensitive/shared change; GitHub CODEOWNERS permits any listed owner and cannot express both lead approval plus another owner. PR #34 remains open pending another developer review and merge. No feature dependency has been cleared prematurely.

## PF-012 lead implementation

The lead authorized continuing lead-owned work before teammate onboarding. PF-012 is developed on codex/pf-012-certificate-primitives, stacked on the approved foundation; foundation review/merge remains pending. Implemented explicit-key Ed25519 signing, domain-separated signature verification, canonical bindings and lifetime checks, persisted certificate reads, and status checks against authoritative state/policy/approval/execution records. No HTTP issuance or chain signing was enabled. No shared models, migration or OpenAPI changes.

Focused red tests reproduced missing cryptographic primitives and NOT_IMPLEMENTED certificate status; implementation then passed those tests. Full validation results are in TEST_RESULTS.md. Product AT-01..AT-12 remain incomplete; isolated certificate fixtures are not financial-policy or chain evidence.

## PF-030 lead implementation

Developed on codex/pf-030-testnet-adapter and refreshed from current `main` after PF-012 merged. Added concrete offline EIP-1559 signing and exact signed-transaction RPC transport, testnet/token/recipient/wallet/fee gates, explicit ambiguous broadcast handling without retries, and normalized pending/revert/confirmation/reorg receipt handling. Public execution remains disabled. Read-only Base Sepolia eth_chainId probe returned HTTP 200 / 84532; no broadcast. See TESTNET_ADAPTER.md. Shared models, migrations and OpenAPI unchanged.

PF-012 PR #35 merged into `main` at `85c752e872b46dbf7b49b6f3b6e35036de4772ff`. PF-030 PR #36 merged into `main` at `15ffcfd6aa6a7212680d2b98f613b9bd82e53474`. The adapter does not configure infrastructure or enable public execution.

## PF-033 lead implementation

On codex/pf-033-authenticated-sessions, stacked after the prior lead work. Added password provisioning/hash verification, opaque cookie sessions, explicit authenticated actor, expiry/revocation, Origin/CSRF validation, login/mutation rate limits, public HTTPS/Secure-cookie configuration checks, typed login/status/logout routes and real browser login/logout integration. Prototype service bearer is no longer accepted as user identity. No financial schema or migration change. The new HTTP v1.1 contract is for lead review in its separate contract-change PR. Browser tracing disabled to prevent credential/session leakage in traces.

Initial auth tests reproduced missing routes. Security regression identified non-ASCII header comparison causing TypeError; byte comparison now rejects it safely. A later repeated browser run reproduced a 429 caused by counting successful logins toward the failed-login budget; the limiter now records failed credentials only, with a regression test preserving lockout after five failures. Exact validation evidence is recorded in TEST_RESULTS.md. No policy activation, financial approval or execution is implied by login.

PF-033 replacement PR #45 merged into `main` at `efb4910f06791e221407b2891deb8b61ad43e152`. The historical integrated-stack redirect timeout is still recorded separately and is not claimed as explained by the later rate-limit reproduction.

## PF-013 bound human approvals

On codex/pf-013-bound-human-approvals, stacked after PF-033. Implemented the existing POST /approvals route with server-derived actor and persisted session-fingerprint audit binding. Real signature/hash/freshness/policy checks run inside serialized trusted-write transactions. Exactly one final approve-or-deny record per certificate; denials cannot be overwritten. Approval and hash-linked audit event commit/rollback together. No certificate issuance, signing, or execution was enabled. Shared financial/API models and migrations unchanged; a small auth implementation addition exposes the authenticated session fingerprint to trusted handlers, without exposing raw cookies.

PR #38 merged into `main` at `175aeac69967c99a8ef5a05fab3459dccf19b98e`. These approval fixtures do not represent product-issued certificates or financial authority.

## PF-014 atomic execution guard slice and integration readiness

PF-014 now has independent claim guards on codex/pf-014-independent-executor stacked after PF-013: exact authentic/current certificate and trusted artifact checks, server-only risk recheck with no default, operational allowlist, current human-consent requirement, atomic claim/approval consumption/audit and replay/idempotency/wallet-nonce conflict rejection. No signer/broadcast or public execute route is enabled. PF-014 remains incomplete/blocked on real risk dependencies and executor integration. See EXECUTOR_GUARDS.md.

PR #40 merged into `main` at `ca69d14562361049d333066358439602b78b78d4` after its exact-head hosted CI passed. PF-014 remains open and blocked on PF-029; the merged guard slice does not imply PF-029/PF-015 completion.

Lead delegated the interim financial choice: preserve baseline/no invented income, with explicit no-safe-action outcome when checked. Positive hero/emergency demos remain outstanding. TESTNET_SETUP_CHECKLIST.md lists actual public infrastructure values and local secrets needed, including configuration that is intentionally not yet wired.

## PF-006 Constitution lifecycle

PR #41 implements draft persistence, explicit digest-bound confirmation, ordered validated immutable history, current-base checks, atomic policy-head/audit updates and human-readable draft changes in authenticated audit events. It is refreshed onto current `main`; all listed PF-006 dependencies are merged. Drafts do not activate automatically, and this change adds no shared schema or migration. Product UI remains separate PF-019.

PR #41 merged into `main` at `ad9807dc6a9feb1c410c6d64c5e822bcbc248cdc` after exact-head hosted CI passed. PF-006 is closed. This clears PF-007's direct dependency; PF-019 still also depends on PF-018.

## PF-008 named cash-flow stresses

PR #43 implements a deterministic ledger through all obligation and recurring due dates, entire-path reserve protection and raw minimum cash, plus individual market, income-delay, emergency and fee stresses with visible parameters. Current balances include realized expenses; the future emergency is explicitly an additional shock. No income, probability or active risk configuration is invented. Public `/simulate` remains `NOT_IMPLEMENTED` for PF-009.

Earlier integrated-stack runs recorded both a 184-backend/4-browser pass and a later 184-backend/3-browser failure caused by the existing five-second login redirect timeout symptom. Its root cause remains unresolved. The refreshed PF-008 head must pass current exact-head checks without treating a later pass as proof that the historical timing issue was fixed.

PR #43 merged into `main` at `fb3cc9ca046f46072d09b2ab4ee79a842bdeda76` after exact-head hosted CI passed. PF-008 is closed, and PF-009 is now ready. The historical browser timeout remains unresolved.

## PF-007 deterministic policy engine

Development continues on `codex/pf-007-policy-engine`, based on current main. The evaluator covers the eight Constitution families plus the hard borrowed-funding restriction, returns ordered machine-readable outcomes and gives hard failures precedence over approval. It binds state, policy, action, simulation and config evidence before checking exact integer-cent and basis-point boundaries. Public verification/certificate issuance remains PF-029, and no route or shared contract changes in PF-007.

PF-007 merged via PR #46 at `ee3d784864f020d8a22ae937a21793ced3f0dde6`. PF-009 implementation proceeds on its own branch under the user's approved written spec and plan. The seeded engine and authenticated route now compute/persist real scenario evidence with strict trusted configuration loading, duplicate-request serialization and audit rollback. Isolated tests supply configurations; the actual seed has no active policy or selected probabilities. Full validation and review evidence must precede integration. No certificate issuance or live execution is enabled.

## Developer onboarding instructions

Added separate copy-ready Farid/Wasik guides and shared setup/review instructions under docs/onboarding. Setup now uses merged `main`; feature work begins from current `main` and ready issues. PF-018 explicitly depends on the now-merged PF-033 session/client integration. This onboarding PR contains documentation and dependency-manifest changes only.
## Foundation review fixes (PF-003 / PF-005)

Addresses two reproduced PR #34 review findings on a separate branch based on the
foundation. Bearer authentication compares UTF-8 bytes so malformed non-ASCII
credentials return 401 UNAUTHORIZED. State append locks the expected current-head
row with a conditional update before inserting the next unique version; competing
writers now produce one commit and one 409 CONFLICT rather than an IntegrityError.
The snapshot insert and pointer advance remain inside the caller's transaction.
No shared model, migration, generated contract, or financial assumption changed.

Regression tests first reproduced both failures. Focused foundation suite: 25
passed, including simultaneous writers, invalid bearer inputs, unrelated integrity
failures, and caller rollback. Ruff passed. Full npm run check passed: 25 backend tests, 2 real browser/API tests,
contract generation, frontend lint/typecheck, and production build. Foundation review/merge and PF-008's blocker remain
unchanged until the lead reviews and integrates these fixes.

## PF-018 dashboard (ready for review)

Dashboard at `/` now reads real `GET /financial-state` and `GET /chain/status` through the existing generated client and session boundary. The two sections load independently, each with loading, error (with retry) and last-good-data behaviour; a 401 from either returns to `/login`. The previous hard-coded "Chain execution: Not configured" line is replaced by the live chain status (status, reason, network id, optional wallet and balances). Nothing is estimated or approved in the browser: no risk figure, safe allocation, certificate or transaction hash is rendered. An app shell lists the planned screens as unavailable until their issues land (`src/components/shell/nav.ts`). Colours, spacing and fonts are CSS variables in `globals.css`.

Validation (Windows, Node 22.20, Python 3.11): `npm run test:e2e -w apps/web -- --grep PF-018` 12 passed (6 browser journeys, 1 login-page regression check, 5 pure display-helper checks); full browser suite 16 passed (foundation, PF-033 and PF-018); `npm run lint`, `npm run typecheck` and `npm run build` pass; `ruff check .` passes; backend `pytest` 227 passed. The loading and failure tests only delay or fail one proxy request; no financial result is substituted. Screenshots: desktop, mobile and login from the PF-018 browser tests. Not covered by real-backend tests because the backend cannot yet produce them: chain status READY or UNAVAILABLE, a funded wallet, and an empty snapshot; the label and amount helpers for those cases are unit-checked only.

Not run as one command: `npm run check`, because `npm run contracts` calls `.venv/bin/python`, which does not exist on Windows (`.venv/Scripts/python.exe`). The other check steps were run individually. `scripts/bootstrap.py` has the same Windows gap for `npm ci`. No contract, migration or generated file changed.

## PF-019 Constitution Builder (ready for review)

`/constitution` edits rules in plain units (USD, percent, one address per line), converts them exactly to cents/basis points/lowercase addresses, and saves only a draft (`POST /constitutions/drafts` with `base_version` = the active version). A review step shows every rule before/after against the active version and the SHA-256 policy fingerprint of the exact draft rules, computed in the browser with ProofFi canonical JSON v1 (`src/lib/canonical.ts`, byte-for-byte equal to `app/core/canonical.py` on reference inputs). Activation needs a separate checkbox and button and sends that fingerprint as `expected_policy_digest`; `STALE_POLICY` reloads the current version and asks for a new draft. Active version, fixed rules and immutable history are shown. Saving never activates.

Browser tests now run on a fresh, separately seeded `.local/e2e.db` (`apps/web/e2e/server.mjs`, `playwright.config.ts`): read-only checks first, then `*.journey.spec.ts`, one worker. This keeps writing journeys out of the developer database and stops them breaking the foundation check that expects no active Constitution. Needs lead review because it changes shared test configuration.

Validation: full browser suite 27 passed (PF-019: 6 journeys against the real backend including a concurrent-activation STALE_POLICY case, 5 unit checks for units, canonical digest, form round-trip and diff); lint and typecheck pass.

## PF-021 Time Machine (ready for review)

`/time-machine` builds a manual candidate (amount, token, recipient; prefilled from the active Constitution) and calls the real `POST /simulate`. It shows the SimulationRun exactly: goal-satisfaction and reserve-breach probabilities next to the active Constitution's thresholds (comparison only, labelled as not verification), 5th-percentile and expected terminal liquidity, every sampled liquidity path as an SVG chart with a $0 line, all four named stresses with their parameters, and the full config (model, paths, horizon, seed, probabilities, fee, assumptions, config and state fingerprints). Copy states that it is seeded scenario arithmetic, not a prediction. Backend refusals (no Constitution, no selected config) show the backend's own reason and a next step.

The seed selects no simulation config by design (D12), so `/simulate` refuses to run in the normal dev database. To test real engine output, `e2e/server.mjs` adds one config labelled "E2E TEST FIXTURE … not an approved financial assumption" to the throwaway `.local/e2e.db` only (`e2e/seed_e2e_simulation_config.py`, which refuses any other database), as the backend's own PF-009 tests do. Needs lead review.

Validation: browser suite 34 passed (PF-021: 3 journeys on real engine output incl. determinism and phone width; real "Constitution required" refusal on the fresh seed; client-side validation; chart geometry and candidate unit checks). Ruff, lint and typecheck pass.

## PF-025 Audit Explorer and certificate verifier (ready for review)

`/audit` lists the real `GET /audit` log newest first with readable event names, details and hashes, filters by event type, and exports the exact JSON. The browser independently recomputes the hash chain (sequence 1..n, each `previous_hash` = prior `event_hash`, each `event_hash` = SHA-256 of canonical JSON without it, as in `audit/append.py`) and reports intact or the first broken event, with the documented limit that this cannot detect a full rewrite by a database administrator. `/certificate-verifier` validates the ID shape, then calls `POST /certificates/{id}/verify` and `GET /certificates/{id}` and explains every status (VALID, APPROVAL_REQUIRED, SIGNED_BUT_STALE, EXPIRED, ALREADY_USED, TAMPERED) with signature and reasons; audit details link certificate IDs to it. `CertificateDetails` and `TransactionFields` are shared with PF-022.

Validation: browser suite 43 passed (PF-025: browser-computed hashes match the real backend log, filter, export equality, phone width, real INVALID_CERTIFICATE for an unknown ID, malformed IDs blocked locally, chain-check unit cases for edits/gaps/relinks). Not exercisable yet: VALID/STALE/USED/TAMPERED on a real certificate, because certificates are only issued by `POST /verify` (PF-029, not implemented).

## PF-022 Certificate, approval and execution UI (built; blocked on PF-029/PF-014/PF-015 for a full journey)

`/certificates?id=…` opens a certificate with `GET /certificates/{id}` and its live status from `POST /certificates/{id}/verify`, then shows the signed payload, policy decision and every rule outcome, and the exact transaction fields the executor would sign (sender, token contract, recipient, base units and decimals, value, nonce, gas limit and fee caps, call data). Approval is offered only for a correctly signed `APPROVAL_REQUIRED` certificate, needs a checkbox naming the exact amount, token, recipient and expiry, and sends `{certificate_id, action_digest, decision}`; Deny is always explicit. Execution is offered only for a signed `VALID` certificate, reuses one idempotency key per attempt (16-100 chars as the contract requires), and shows the executor's real result: status, transaction hash with a Base Sepolia explorer link only for a well-formed hash, block and confirmations, or the real error with "no transaction hash was produced". Audit details link certificate IDs here.

No certificate can exist yet because only `POST /verify` (PF-029) issues them, and `POST /execute` returns 501 until PF-014/PF-015 wire the executor route. Tests therefore cover the request builders and status gates, explorer-link validation, unknown and malformed IDs in the browser, and the real backend refusing approval (409 INVALID_CERTIFICATE) and execution without a genuine certificate. No certificate, approval or transaction hash is fabricated for testing. Validation: browser suite 50 passed; build, lint, typecheck pass.

## PF-020 Agent Workspace (built; blocked on PF-017/PF-010/PF-029 for live results)

`/workspace` takes a plain-language goal (prefilled from the stored goal; 1-2000 characters), calls `POST /intent/parse` and `POST /plans/generate`, and lists the candidates with the planner's text marked untrusted. A selected candidate, or one the person enters when the planner is unavailable, goes to `POST /optimize`; the result is explained only from backend numbers: SAFE_ACTION with the exact amount, verifier-call count, whether one more cent is rejected and the limiting checks; NO_SAFE_ACTION; NON_MONOTONIC_FEASIBILITY. A safe action can be opened in the Time Machine (prefilled through the URL) or sent to `POST /verify`, which links an issued certificate to `/certificates`. Every 501 shows the backend's own "Feature awaiting PF-0xx" message and nothing is invented.

Test infrastructure: `e2e/fixtures.ts` revokes each test's demo session through the real logout route after the test, because the backend holds at most 32 sessions and the suite exceeded that ("Demo session capacity reached"). Validation: browser suite 57 passed; lint, typecheck pass. The PF-020 browser tests accept either the current 501 or a future 200 and assert the screen matches the backend answer in both cases.

## PF-023 Red-team demo mode (built; blocked on PF-031 for a live attack)

`/red-team` runs `POST /demo/attack` only after an explicit acknowledgement and renders the AttackResponse in four steps: what the fooled planner proposed (amount, recipient, funding, mode, untrusted reason), the verifier's decision with every rule outcome and whether a certificate was issued, the executor's error with "signer called" and "transaction hash" taken from the response, and the audit events the attack added (compared with the log read just before). The "AI fooled. Funds safe." banner appears only when the backend reports DENY, `signer_called` false and no hash. Today the route returns 501 (PF-031), which the screen states with the backend's message and "nothing was verified, signed or sent". Validation: PF-023 tests pass and accept either the 501 or a future 200 while asserting the screen matches the backend.

## PF-024 Emergency expense and replanning UI (built; blocked on PF-032 for a live state change)

The Workspace gains step 4 (`src/components/emergency/EmergencyPanel.tsx`): after an explicit acknowledgement it sends `POST /demo/emergency {expected_state_version, amount_minor: 200000}` and shows the version change, the realized expense, the safe amount before (if found in this session) and the backend's recomputed optimization, and asks the backend to re-verify any certificate issued earlier on the page (expected SIGNED_BUT_STALE). STALE_STATE reloads the latest state. Today the route returns 501 (PF-032): the screen reports it and the test proves the state version is unchanged. Validation: PF-024 tests pass and accept a future 200 while asserting the new version and result.
## PF-019 integration review (2026-10-16)

PF-018 merged via #48 at be3b41985c88b7d4c1e32d83a3f8bbd42c0a6b8f after current CI and a local full check (227 backend / 16 browser tests). PF-019 was retargeted to main and refreshed without replacing the author's changes. Its initial full check passed 227 backend / 27 browser tests, but unchanged downstream #56 reproduced AT-11 confirming 14000 cents after entering 11100. A controlled real-response reordering regression then proved that an obsolete initial Constitution load could replace an edited 111 with the seeded 150. PF-019 now ignores superseded loads and invalidates pending loads on effect cleanup; the same regression passes. Confirmation still requires the exact reviewed digest and checkbox. Final validation is recorded in TEST_RESULTS.md.

#51/PF-025 remains blocked on unmerged PF-016, regardless of its green UI CI; subsequent PRs retain backend/dependency blockers. No skipped gate, READY chain status, fixture configuration or execution claim guard counts as an execution receipt or AT-01 completion. Public execution remains disabled and the original baseline remains $200 short before fees/shocks. Windows portability is tracked separately as PF-034/#58.
