# Progress

## PF-145 — Vallet branding

Owner-requested rename in [#145](https://github.com/akiibot/proofFi/issues/145).
Current UI copy/wordmark, page/API titles, downloads, planner identity, npm/Python
metadata and maintained docs now use Vallet. Lockfiles were regenerated with no
dependency-version changes. Generated OpenAPI changes only `info.title`;
generated TypeScript and all financial contracts are unchanged.

[BRANDING.md](BRANDING.md) records intentional legacy protocol, storage,
deployment and historical identifiers. Signing/auth/database implementations and
original evidence are unchanged. No live financial action or deployment occurred.

Initial validation: 34 focused certificate/provisioning tests and 653 backend
tests passed. The first full run stopped at cached route types from the older
checkout. Clearing only ignored `.next` output and rebuilding passed; the clean
rerun also passed all 653 backend tests. Final full-check results and current CI
are recorded in the issue-linked PR before review; integration remains pending.

## Current MVP checklist — final delivery in #57

This checklist describes the delivered state after #57 merges. The final release
gate is the owner's recorded approval plus both current Ubuntu/Windows jobs on
that exact package. Until the merge, integration remains pending in #57.

| Remaining MVP requirement after #57 merges | Missing implementation | Missing integration | Missing evidence | Required owner decision |
|---|---|---|---|---|
| None within the approved MVP scope | None | None | None | None; owner approved #57 after both current CI jobs pass |

All three browser scenarios and AT-01..AT-12 are supported by actual assertions
and distinct genuine A/B/C evidence. #56 acceptance merged at618ec98. The final
package includes authenticated demo-only funded reset before any execution,
explicit refusal after any execution history, reproducible setup, a169.64s raw
browser tour, actual receipt/certificate and independently verified audit exports.
No preserved demo was reset and no new financial action was performed.

#57 local check passed620 backend/92 browser; its first Windows CI passed, while
Ubuntu exposed an AT-12 response-handle race. Narrow test-only correction #108
merged atbd593c5 after both full CI jobs passed605 backend/95 browser. The final
package includes that reviewed correction; approved reset code is byte-identical.
Current combined CI is the final validation gate; earlier failures are retained
in TEST_RESULTS.md and evidence/funded-reset-validation.json.

Historical unrelated development hydration observations remain tracked in #60;
unsupported advanced recovery remains explicitly deferred to #99. Neither is
silently claimed repaired. Both original genuine databases, wallets, private
configuration and original source branches are preserved. Earlier sections below
are historical checkpoints, not additional current requirement lists.


## PF-024 independent emergency UI integration (2026-10-17)

Based on main 9da89ae, after PF-020/#84 merged with explicit owner approval and
both current Ubuntu/Windows checks passing. PF-032/#81 is merged. Preserved the
original #55 stack and extracted only its emergency component into Workspace.
The UI uses the existing generated contracts and real emergency/status routes.

Corrected the old component's unsafe claim that every failed request left state
unchanged. Transport/5xx outcomes now remain unknown, trigger a state refresh,
and lock blind retries. Each expense consumes its checkbox acknowledgement.
Known conflicts display the real backend reason; current backend uses CONFLICT,
not only STALE_STATE. Expense success is retained separately from any later
certificate-status read failure. Earlier optimizer/certificate results are
cleared on state refresh; competing Workspace mutations are disabled in flight.
The pre-expense optimizer result is captured for comparison before that reset.

Focused PF-020/PF-024: 13 passed. Four emergency tests use the real local API
for acknowledgement, unconfirmed-policy refusal, version conflict and response
loss. One explicitly isolated rendering fixture checks success display and fresh
acknowledgement; it is not real expense or funded-scenario evidence. Existing
PF-032 backend tests cover actual atomic repricing and certificate invalidation
with isolated chain bounds. Full npm run check exited 0: 527 backend and 53
browser/API/proxy tests passed; Ruff, contracts, lint, typecheck and production
build passed. Generated contracts unchanged; diff check passed. Hosted CI and
review remain required. Positive funded-demo acceptance remains incomplete.


## Repository audit and PF-020 independent integration (2026-10-17)

Current main at start: de3921c (PF-038 backend/proxy merged). GitHub has 21 of
PF-001..PF-033 closed and 12 open: PF-014, 015, 016, 020, 022, 023, 024, 025,
026, 027, 028 and 031. Additional open work: PF-035/#60, PF-036/#65 and
Base Sepolia provisioning #66. Issue count is not an effort or acceptance metric.
Older checkpoints below are historical; emergency PF-032 is now merged via #81.
Public execute, workflow, attack and reset handlers still explicitly refuse.

PF-020's actual backend prerequisites (#62, #63, #48) are merged. Extracted
Wasik's Workspace implementation from #53 onto current main, preserving the
original stack. It consumes generated contracts and real planner/optimizer/
verifier routes, carries exact candidate values to Time Machine, and displays
issued certificate IDs without linking to the still-unmerged PF-022 screen.
Intent transport failures are now visible even if candidate planning succeeds.
Browser tests use the real deterministic demo planner in disposable e2e.db;
shared session cleanup uses the existing logout endpoint. No production auth,
schema, risk settings, policy activation or execution path changed.

Final focused PF-020: eight passed. Final npm run check: exit 0, 527 backend
and 48 browser/API/proxy tests passed, with Ruff, contracts, lint, typecheck and
production build passing. Generated contracts unchanged. First full run failed
only on the new test expecting a generic transport message instead of the actual
"Failed to fetch"; corrected the expectation, without changing timeouts/retries.
This preparation does not close #20, establish a positive allocation, or complete
any live-chain acceptance gate. Current hosted CI and review remain required.


## PR-stack checkpoint (2026-10-16)

GitHub-authoritative: PF-009 merged via #47; PF-018 via #48 (`be3b419`); PF-019 via #49 (`d062b1f`) after fixing and testing an obsolete-load form overwrite. PF-021/#50 merged at `70e6fe2` after 227 backend / 35 browser checks and fresh hosted CI. PF-025/#51 is blocked on PF-016; #52–#57 retain stack/backend blockers. The older checkpoints below are historical evidence. The owner waiver removes teammate-approval requirements, not current CI or dependency gates.

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

`/constitution` edits rules in plain units (USD, percent, one address per line), converts them exactly to cents/basis points/lowercase addresses, and saves only a draft (`POST /constitutions/drafts` with `base_version` = the active version). A review step shows every rule before/after against the active version and the SHA-256 policy fingerprint of the exact draft rules, computed in the browser with Vallet canonical JSON v1 (`src/lib/canonical.ts`, byte-for-byte equal to `app/core/canonical.py` on reference inputs). Activation needs a separate checkbox and button and sends that fingerprint as `expected_policy_digest`; `STALE_POLICY` reloads the current version and asks for a new draft. Active version, fixed rules and immutable history are shown. Saving never activates.

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
## PF-019 integration review (2026-10-16)

PF-018 merged via #48 at be3b41985c88b7d4c1e32d83a3f8bbd42c0a6b8f after current CI and a local full check (227 backend / 16 browser tests). PF-019 was retargeted to main and refreshed without replacing the author's changes. Its initial full check passed 227 backend / 27 browser tests, but unchanged downstream #56 reproduced AT-11 confirming 14000 cents after entering 11100. A controlled real-response reordering regression then proved that an obsolete initial Constitution load could replace an edited 111 with the seeded 150. PF-019 now ignores superseded loads and invalidates pending loads on effect cleanup; the same regression passes. Confirmation still requires the exact reviewed digest and checkbox. Final validation is recorded in TEST_RESULTS.md.

#51/PF-025 remains blocked on unmerged PF-016, regardless of its green UI CI; subsequent PRs retain backend/dependency blockers. No skipped gate, READY chain status, fixture configuration or execution claim guard counts as an execution receipt or AT-01 completion. Public execution remains disabled and the original baseline remains $200 short before fees/shocks. Windows portability is tracked separately as PF-034/#58.

## PF-034 Windows tooling (issue #58)

The isolated codex/pf-034-windows-check branch makes bootstrap invoke npm through the Windows command shell and selects the platform-specific Python executable for contract generation. The generated OpenAPI/TypeScript outputs are unchanged. An additional Windows CI job runs real bootstrap, full checks, contract/migration drift and dependency audit; Ubuntu foundation protection is retained. Local macOS checks passed; hosted Windows evidence belongs to issue #58 and its PR and must not be inferred from that local pass.

Stack status: #48 (`be3b419`), #49 (`d062b1f`) and #50 (`70e6fe2`) merged; #51 retargeted to main and blocked on PF-016. #52 requires PF-015; #53 requires PF-010/PF-017; #54 requires PF-031; #55 requires PF-032; #56 requires the complete backend/UI acceptance prerequisites; #57 requires PF-026/PF-027. All unmerged parent branches are preserved. AT-01's current READY-only assertion does not test execution or a receipt and cannot complete that gate.

PF-034 actual Windows evidence is now available: CI run 38893104695 passed bootstrap, the full 227-backend/35-browser check, both drift gates and audit on Windows as well as Ubuntu. The earlier Windows shell/Python-path failure remains documented. The final documentation commit requires fresh current-head CI before merge.


## PF-017 Vertex AI planner (Farid)

Implements the existing authenticated /intent/parse and /plans/generate contracts
using a provider-neutral Proposal boundary and the Google Vertex generateContent
REST API. User requested Vertex AI through their existing RentGuardians Google
Cloud account instead of API-key Gemini. OAuth remains in Google Cloud CLI
storage: the backend captures a short-lived token without logging it, never
reads signing keys, and sends only the goal plus minimal synthetic obligation,
cash, declared income and policy-confirmed context. No new dependency, public
schema, migration, shared configuration module or generated contract change.

Backend-local settings: PLANNER_MODE (live_llm default; deterministic_demo only
when DEMO_MODE=true), GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION (global default),
VERTEX_MODEL, VERTEX_ACCOUNT, and optional VERTEX_GCLOUD_CONFIG. Configure the
normal gcloud CLI on the execution host; the optional config directory supports
reusing existing local login storage. No API key or service-account JSON belongs
in this repository. Existing TEST_TOKEN_ADDRESS and APPROVED_RECIPIENT select
proposal destinations but never activate policy or authorize transfers.

Vertex requests have a 20-second credential subprocess timeout, 8-second socket
timeout, fixed output-token ceiling, no automatic retry/fallback, and a 64 KiB
response bound. The provider must return one complete STOP candidate with bounded
JSON matching the private reply shape; canonical CandidateAction validation then
rejects coerced/invalid money, unsupported fields or authority. At most three
unique positive-cent proposals are returned, with stable IDs bound to planning
context. All model reasoning remains explicitly untrusted.

Missing goal details, confirmed policy, approved token/recipient or permitted
configuration returns clarification and zero candidates. Missing live provider
configuration, malformed/blocked/truncated provider output, network/credential
errors fail explicitly. Demo mode is opt-in and visibly labelled, never a silent
fallback. Planning creates no stored candidate, simulation, certificate, approval
or execution and imports none of the verifier/approval/execution modules.

Focused tests exercise real migrated SQLite and session-protected routes with
isolated provider substitutions: canonical proposals, ambiguity/missing authority,
no writes, deterministic opt-in, no fallback, auth/CSRF, minimum context, explicit
account/project routing, token omission from prompts, bounded response and invalid
provider amount/authority/error cases. Live-provider evidence and complete check
counts are recorded in the PR; test substitutions alone do not complete the
required genuine Vertex call.

Provider API reference: https://docs.cloud.google.com/vertex-ai/generative-ai/docs/start/quickstart


PF-017 validation on 2026-10-16: focused suite 24 passed; full npm run check
passed 251 backend tests and 35 browser/API tests, Ruff, contracts, frontend
lint/typecheck/build. Two existing upstream Python deprecation warnings remain.
Live account probe: authenticated token refresh succeeds using the user's existing
RentGuardians Google Cloud login; Vertex API is enabled and billingEnabled=true
for the selected existing project. Actual generateContent requests return HTTP
403 PERMISSION_DENIED with the provider's project-level "Lightning dunning
decision is deny" diagnostic. No successful live inference is claimed. Restoring
provider access/billing eligibility is an external gate; do not mark PF-017
complete or treat substituted responses as genuine Gemini/Vertex evidence.
The first WSL probe exposed slow loading of the Windows Cloud SDK; installing
the native Linux CLI resolved that local credential-refresh timeout. No billing,
IAM permission, account selection, or financial assumptions were changed.

## PF-010 largest compliant proposal (Farid)

Implements the existing authenticated POST /optimize contract in the owned
optimizer module. It loads current state/confirmed policy/exactly one trusted
config from SQLite, checks metadata/digests, reads operational allowlists and
live Base Sepolia token/native balances, and searches integer cents using the
real PF-007 evaluator and PF-009 seeded simulation. No certificate or signing
is enabled. No seed income, selected risk configuration, model, schema,
migration, or shared route registration changes.

Monotonicity for pf-monte-carlo-v1: candidate amounts do not change random
streams or schedules, risky assets are never liquidated, every extra cent lowers
every cash path by one cent, and concentration only increases. All hard policy,
probability and individual stress constraints are therefore downward closed;
autonomy/new-recipient approval requirements do not deny a feasible proposal.
Unknown model versions return NON_MONOTONIC_FEASIBILITY. The maximum and its
next cent are independently recomputed. Unsupported total search workloads
fail explicitly. verifier_calls counts policy+simulation decision evaluations,
not certificate issuance. Each decision now uses PF-029 recompute directly, including its complete named-stress evidence check; no certificates are minted during search.

Runtime optimizer configuration (backend-only; no default values): RPC_URL,
WALLET_ADDRESS, TEST_TOKEN_ADDRESS, APPROVED_RECIPIENT, OPTIMIZER_GAS_LIMIT and
OPTIMIZER_MAX_FEE_PER_GAS_WEI. The last two are newly implemented only for
optimizer balance bounds; they do not configure the signer/executor. RPC keys
stay private. Token code, ABI response widths, chain 84532 and decimals 2..18
are checked; token balances round down to whole cents. All balance reads use
one observed block; current base fee must fit the fee ceiling. Native cash must
cover configured gas limit times maximum fee, separately from synthetic fee_minor.
This is a conservative gas budget, not a gas estimate, transaction simulation,
pending-balance reservation or execution guarantee. The executor must recheck
actual chain state, nonce, gas and fees at authorization/signing time.

SAFE_ACTION means financially compliant proposal under the displayed approved
assumptions and observed balance bounds; human consent may still be required.
It is never approval or authority to execute. A deterministic new candidate ID
avoids rebinding a previously simulated candidate when its amount changes.
There are no optimizer DB writes, certificates or signer calls. Missing approved
policy/config or chain settings/RPC returns explicit UNAVAILABLE. Baseline remains
short $200 before shocks/fees and cannot be forced into a positive demo.

Validation: focused tests exercise real policy/simulation, exact max/next-cent,
concentration, emergency, approval threshold, zero fees, chain token/native caps,
malformed/unavailable chain/config, auth/CSRF, immutable inputs, and no DB writes.
RPC substitutions are isolated test fixtures, not live infrastructure evidence.
Full npm run check passed: 257 backend tests, 35 real browser/API tests,
Ruff, contracts, frontend lint/typecheck and production build. Hosted CI is
tracked on the issue-linked PR; no live-chain transaction was performed.
## PF-029 trusted issuance implementation (2026-10-16)

Implemented the ready lead-owned PF-029 issue on codex/pf-029-trusted-issuance. The existing authenticated `/verify` handler now delegates to the trusted service without changing API schemas or generated contracts. Under a serialized SQLite transaction, it reloads authoritative state/confirmed policy/single selected config, recomputes simulation and all policy/named-stress gates, and persists a denial or a five-minute exact signed certificate with linked artifact/audit evidence. Operational chain checks are read-only; transaction signing/broadcast and public execution remain disabled. Runtime signing/configuration values remain blank and no financial assumptions or income are activated. See TRUSTED_ISSUANCE.md.

The existing independent PF-014 claim guard was exercised with the production risk recomputation callback and a genuine fixture-issued certificate; this remains a claim with no transaction hash, not a complete executor or live-chain outcome. PF-029's independent security review found no blocking defects; its requested additional corruption/stress/transaction-boundary regressions were added and passed. Integration still requires the issue-linked PR, current CI and lead security review. No PF-014/PF-015/PF-016 or pending UI issue is marked complete by this implementation.

PF-029 final local full check passed 273 backend / 35 browser/API tests, with no contract/migration drift and zero audited vulnerabilities. One earlier full run hit the unchanged PF-018 login helper timeout; PF-035/#60 tracks that unresolved failure, followed by three focused passes and the full unchanged-code pass. No timeout, retry, worker setting or browser assertion was weakened.

## Base Sepolia provisioning preparation — issue #66

Created fresh sender/recipient and verifier keys only in restricted ignored local
storage. Web3 RPC verifies chain 84532; sender has zero gas balance. Compiled
MockUSD only (0.8.24/optimizer 200/Paris) and passed local EVM deploy/mint/access
control/transfer/event/balance checks. Read-only deployment estimate 481599 gas;
fee proposal requires operator acceptance. Public evidence intentionally has no
token or receipts. Coinbase faucet requires user login. Lead source review,
funding, fee approval, deployment and full PF-014/PF-015 integration remain
required. Nothing signed/broadcast; no policy or financial assumptions activated.

Issue #66 final local npm run check passed: 273 backend tests and 35 browser/API
tests, Ruff, contracts, frontend lint/typecheck and production build. Generated
OpenAPI/TypeScript unchanged; git diff --check passed. Wallet permissions 0700/
0600, source hash, pending-manifest assertions and publication secret scans
passed. Local EVM contract checks used only test accounts, not the new wallet
keys. No Base Sepolia deployment or mint receipt exists yet.

### PF-066 faucet funding verified

Coinbase faucet delivered 0.0001 Base Sepolia ETH. RPC chain 84532, receipt status 1, block 48204654; sender balance 0 -> 100000000000000 wei. Hash: `0x6375b1e0065ca77b4192e2c64231d2b090cdc562f0b13f788230d89f85211da7`. Public evidence updated; token deployment/mint, source review and fee acceptance remain pending, signing disabled. Evidence-only update: receipt/balance assertions and diff checks passed; generated contracts unchanged.
## PF-014 internal signing slice (2026-10-16)

PF-029 merged via #61 (`97a319808510b0d09357a14b7302d22f179682d1`), satisfying that prerequisite. On `codex/pf-014-trusted-signing`, the internal executor now permanently reserves a claim before fresh independent authority/risk/chain checks and exact EIP-1559 signing. Failed or lost attempts remain reserved; no automatic re-signing is available. Public execution stays disabled; durable signed-byte storage, broadcast and receipt/ledger reconciliation remain PF-015 work. No shared schema or encoding changed. See EXECUTOR_GUARDS.md.

Focused validation passed 106 tests (24 new signing, 36 claim guards, 46 issuance). The initial 17 signing regressions failed against the missing boundary before implementation. The independent reviewer agent failed because of a usage limit; no PF-014 review acceptance is claimed. Full validation and current hosted CI evidence will be recorded separately. PF-014 remains open.

PF-014 final local validation: `npm run check` PASS — 297 backend tests, 35 browser/API tests, Ruff, generated contracts, frontend lint/typecheck/build. Generated OpenAPI/TypeScript have no diff. Root `.venv/bin/alembic check` passed with no new operations; an initial command incorrectly selected nonexistent `services/api/alembic.ini` and failed configuration loading. `npm audit --audit-level=high` found zero vulnerabilities. Current hosted CI and lead security acceptance remain outstanding; no earlier browser timing failure is claimed fixed.

## PF-017 express integration update (2026-10-17)

Supersedes the earlier OAuth-only access blocker for live planner acceptance.
The user supplied a new credential and requested resuming AI integration.
PLANNER_PROVIDER=vertex_express uses the documented aiplatform.googleapis.com
express endpoint and x-goog-api-key header, with backend-only LLM_API_KEY stored
as SecretStr. VERTEX_MODEL remains configurable; real checks used gemini-2.5-flash.
Existing vertex_oauth behavior remains available explicitly. No automatic fallback.
The key is never in URLs, prompts, frontend, logs, evidence or tracked files.
No shared settings module, public contract, migration or new dependency changed.

Real structured inference passed through the production adapter. Real authenticated
POST /plans/generate returned HTTP 200, live_llm and one canonical candidate using
a disposable synthetic SQLite fixture with explicitly confirmed test policy and
test destinations. No candidates, certificates or executions were persisted.
A separate real structured call returned clarification. These tests activate no
product financial assumptions and grant no signing or transfer authority.

Focused tests: 29 passed in the isolated completion copy. Full validation of
this separate PR-only checkout is recorded below after completion. The original
OAuth project's billing denial is not claimed resolved; express authentication
is separately authorized and succeeds. Rotate the chat-exposed key after testing.
Official express reference: https://docs.cloud.google.com/gemini-enterprise-agent-platform/reference/express-mode/api-reference

Configuration: PLANNER_MODE=live_llm, PLANNER_PROVIDER=vertex_express,
VERTEX_MODEL=<accessible model>, LLM_API_KEY=<private backend key>, existing
TEST_TOKEN_ADDRESS and APPROVED_RECIPIENT as appropriate. Put secrets only in
the ignored owner-readable local .env. Missing policy/destination asks clarification.
OAuth-only configuration remains documented above and explicitly selectable.

PR-only final validation: npm run check exited 0, 302 backend tests and 35
browser/API tests passed, including Ruff, generated contracts, frontend lint,
typecheck and production build. Generated contracts unchanged; git diff --check
passed. The complete isolated workstream previously passed 381 backend / 35
browser tests; these counts differ because unrelated unmerged finance features
are deliberately excluded from this PR. Source and staged credential scans pass.
The actual local development baseline was migrated/seeded separately without
activating policy, income or a simulation config. A real authenticated request
returned live clarification and zero candidates because policy is unconfirmed.

## PF-010 integration with merged PF-029 (2026-10-16)

Updated from main 97a319808510b0d09357a14b7302d22f179682d1. Optimizer search
now calls the production verifier recompute function for every candidate and
independently repeated max/next-cent boundary. Incomplete named-stress evidence
returns UNAVAILABLE. No verifier-owned code, signing or persistence changes.
Focused test_pf_010.py: 32 passed. Full npm run check: 305 backend tests and
35 browser/API tests passed, including Ruff, generated contracts, frontend
lint/typecheck and production build. git diff --check passed. AI integration
remains on hold at user request; PF-011 waits for reviewed PF-010 merge, and
PF-027/PF-032 still require the unfinished PF-014 executor. No live-chain receipt
or end-to-end execution acceptance is claimed.

## Ordered integration review (2026-10-17)

PF-010 merged via #62 at 8385d92e20fecbb004e38a88a84f261fd577b6c2. Focused 32 tests passed; final unchanged-code full check passed 305 backend / 35 browser/API tests. Earlier review-worktree validation lacked credentials; after provisioning, a separate full run reproduced the unresolved PF-035 login timeout (24 browser passed, 1 failed, 10 blocked). Three credential-safe diagnostic logins passed, but do not establish a fix. #60 retains actual evidence; no assertions, timing, retries or source changed.

PF-017 is refreshed from this main with both workstreams' progress history preserved. Review confirms explicit provider selection, header-only express credentials, bounded structured output, no silent fallback, and no authority-module imports or financial activation. Current-head validation follows.

PF-017 current-machine probe during ordered integration: express provider/model/key are configured and the credential passes local format validation, but the real request timed out waiting for the HTTP response at the adapter's existing eight-second socket bound. The sanitized diagnostic recorded TimeoutError at provider.py:142; no HTTP rejection status was obtained. This does not establish key validity, provider acceptance or a successful live response on this machine. The earlier author-reported successful live evidence remains separate. No provider timeout, fallback or assertion changed; no database or financial activation occurred. Focused planner tests passed 29.

## PF-014 signing integration review (2026-10-17)

PF-017 merged via #63 at 5b4d266b1699c832882ef73cf36b5965b559dab2 after 29 focused tests, 334 backend / 35 browser/API tests and both current hosted CI jobs passed. Its current-machine provider timeout remains a distinct operational blocker, not a claimed live success.

PF-014 is refreshed against that main with both documentation histories retained. Lead integration review by Codex under the owner's authorization inspected durable-before-sign claim ordering, second-transaction writer serialization, exact consumed-approval and audit binding, real risk recomputation, live transaction reconstruction, pre/post-sign certificate expiry and independent EIP-1559 decoding/recovery. No blocking finding for this internal one-attempt slice. The earlier reviewer-agent usage-limit failure remains recorded; no independent teammate approval is fabricated. Failure/lost-result stranding is intentional and prevents automatic re-signing. Public execution, durable signed-byte storage, broadcast and receipt/ledger reconciliation remain incomplete PF-015 work. Fresh focused/full/current-head CI evidence follows.

## PF-037 private durable-envelope proposal (2026-10-17)

Prepared the separate lead-owned contract-change issue #68 on
codex/pf-037-durable-execution-journal. Adds only a private append-only envelope
table and migration, without public API or canonical encoding changes. Each
existing claim can bind one bounded BLOB and unique lowercase computed hash.
SQL update/delete/replacement guards and a non-empty downgrade refusal preserve
recoverable bytes. SQL shape checks are not cryptographic validation; PF-015
must validate actual bytes/hash/certificate before insertion and every use.
No signer, broadcast, runtime row writer or route activation is added. See
PRIVATE_EXECUTION_JOURNAL.md. This remains proposed, not approved financial or
execution authority.

Focused tests passed 19, plus the foundation migration roundtrip (20 combined).
The first 15 tests failed before the table existed; later regressions reproduced
SQLite INSERT OR REPLACE bypass, text in the BLOB column and destructive populated
journal downgrade before the corresponding fixes. First full check: 376 backend
passed, 1 failed because foundation expected exactly 14 tables. That assertion
now explicitly names all 15 expected tables; no schema gate was removed. Final
full/current-head CI evidence belongs to this contract-change PR before merge.

PF-037 final local validation passed 377 backend / 35 browser/API tests, including
all lint/typecheck/build/contracts. Isolated database migration/drift passed and
public generated contracts have no diff. Proposed schema remains separate from
runtime execution activation and awaits current CI and lead contract review.

## PF-011 security-suite publication (2026-10-17)

Prepared independently from current main fac69aa0d4545721a17ef1ee6a8c9ae7e1644955,
including merged PF-010/#62, PF-017/#63 and the PF-014 internal signing slice/#64.
Adds 24 adversarial tests using actual policy, seeded simulation, optimizer,
verifier and authenticated API/database paths. Covers planner injection text,
borrowed funding/token/tuition denials, approval never overriding a blocked
destination, denied-action approval persistence, forged public authority,
malformed money, baseline NO_SAFE_ACTION, unavailable configuration/RPC,
independent final and next-cent checks, unsupported models and emergency
session/CSRF rejection. Uses existing synthetic fixtures; RPC unavailability
is isolated only in tests. No production runtime assumptions or settings change.

Validation: `.venv/bin/python -m pytest services/api/tests/test_pf_011.py -q`:
24 passed. `npm run check`: exit 0; 382 backend tests and 35 browser/API tests
passed; Ruff, generated contracts, frontend lint/typecheck/build passed.
Generated OpenAPI/TypeScript unchanged; git diff --check passed. Existing two
Python deprecation warnings remain. No skipped test or weakened assertion added.

Emergency cash/destination/repeated-expense accounting regressions remain in
PF-032's separate local tests and are not claimed delivered by this PR. Full
attack/executor/live-chain acceptance remains PF-031/PF-014/PF-015/PF-026 work.
PF-011 awaits scoped PR review/CI/merge; downstream issues remain open.

## Base preparation integration review (2026-10-17)

PF-014 internal signing merged via #64 at fac69aa0d4545721a17ef1ee6a8c9ae7e1644955 after 106 focused tests, full 358 backend / 35 browser/API tests and both refreshed hosted CI jobs passed. It does not close PF-014/PF-015 or enable public execution. PF-037/#68 tracks the separate additive private durable-envelope contract needed before broadcast.

Reviewed #67's MockUSD source and preparation manifest. Independently reproduced Solidity 0.8.24 / optimizer 200 / Paris compilation with source unit MockUSD.sol: zero compiler errors, creation bytecode 2016 bytes. Source SHA-256 and creation-bytecode keccak both match the checked-in manifest exactly. This is preparation evidence, not deployment/fee acceptance. The sender is recorded unfunded and all funding/deployment/mint receipts remain null. No keys, runtime configuration, signing or financial assumptions are activated. Refreshed main preserves all authors' progress history.

Base preparation #67 merged at dc179b68d7e39e1d6b383dccb1d35eef3d020186 with both current CI jobs passed. Farid's funding update was preserved. Independent read-only RPC matched chain 84532, successful receipt at block 48204654, block hash and 0 -> 100000000000000 wei wallet balance. Token deployment and mint receipts remain absent; deployment/fee flags remain false. This is genuine faucet funding evidence, not execution acceptance. PF-037 now includes this main; conflict resolution preserves both histories and adds no application changes beyond the proposed journal contract.

PF-037 final review added BEGIN IMMEDIATE to downgrade before its emptiness check, serializing that check and DDL against a concurrent application insert. The existing 20 migration/storage focused tests passed unchanged after this hardening. Current-head hosted full checks must pass; no new runtime path or public API change.

PF-011 integration review (2026-10-17): refreshed from main dc179b6 after the documentation-only conflict prevented PR CI from starting. Both histories and all 24 adversarial tests are retained. Independent focused PF-011 run passed 24. No production module, policy, financial config, shared schema, execution authority or public contract changed. Current-head hosted full checks remain required before merge.

## PF-035 pre-hydration authentication hardening (2026-10-17)

A controlled JavaScript-disabled probe on main found an enabled credential form
whose native fallback attempted GET /login with password in the query. The probe
used a public isolated string and aborted the request before network; it did not
use or transmit a real credential. Added two real-browser regressions: no-JS
controls must stay disabled with a POST fallback, and held real JavaScript must
leave controls disabled until hydration finishes. Both failed against old code
and passed after useSyncExternalStore gates controls until React installs the
submit handler. No login assertion, timeout, retry or worker setting changed.

The first full run passed 382 backend tests but browser was 36 passed / 1 failed
in the existing PF-019 late-load regression: Save draft never appeared. Its
harness numbered requests AFTER route.fetch completed, so a newer request that
completed first could be held while the correct generation guard discarded the
older response. A controlled real-response probe forced arrival [1,2] and
completion [2,1], reproducing loading while response 2 was held and normal UI
immediately after releasing it. The harness now identifies arrivals before I/O
and forces the newer fetch to finish first, still releasing the older response
after editing. All original value/review assertions and timing are retained.

A temporary isolated mutation removed the production generation guard: the
corrected regression failed (expected 111, received 150). Production source was
restored exactly and the regression passed. No production Constitution change
is included. Final npm run check passed 382 backend / 37 browser/API tests with
Ruff/contracts/lint/typecheck/build and unchanged generated public contracts.
Current CI and lead authentication/shared-test review remain required. This
fixes the proven native-submit/readiness defect and the proven harness ordering
bug; it does not establish the cause of historical busy-login delays or PF-022's
empty certificate field. PF-035 stays open for those remaining observations.

PF-011/#70 merged at 9c7954cb0b57668ac926039196d204afdec76585 after 24 independent
focused tests and current Ubuntu/Windows full CI (382 backend / 35 browser) passed.

## PF-038 current-host live planner observations (2026-10-17)

Based on main 2b83c88, including merged security suite #70 and hydration fix #71.
Three direct production-adapter calls with the same synthetic tuition planning
context validated Proposal responses in 9.18, 1.86 and 1.97 seconds. No production
source, model settings, timeout, retry or fallback changed. Eight seconds is the
existing per-socket timeout, not a total deadline. Prior independent TimeoutError
remains historical evidence; these successes do not establish a causal repair or
reliable availability. Issue #72 remains open. Safe timing/count observations are
in evidence/planner-current-host.json; docs/PLANNER_OPERATING_EVIDENCE.md records
scope and limits. No prompts, response text, credentials or raw diagnostics saved.
No state/policy/configuration activation, candidate persistence, certificate or
signer invocation occurred. Local calls used the ignored backend credential only.

Focused planner tests: 29 passed. Full npm run check: exit 0, 382 backend and 37
browser/API tests passed; Ruff, generated contracts, frontend lint/typecheck/build
passed. Two existing Python deprecation warnings remain. Generated OpenAPI/TS
unchanged and diff check passed. PR #69 merged while this run was in progress;
its newer persistence changes are not claimed tested by this 2b83c88-based run.
PF-014/PF-015 remain open; other prepared finance features remain locally staged.

## PF-037 final integration review head (2026-10-17)

Refreshed the proposed contract from main 2b83c88, including reviewed PF-011/#70 and PF-035/#71. Both merged only after current Ubuntu and Windows CI passed; PF-035 local full validation was 382 backend / 37 browser/API tests. Documentation conflicts preserve all histories. The private journal model/migration/guards are unchanged by integration; current-head full CI is required again before contract acceptance. No runtime journal writer or public execution activation is added.

PF-038/#72 tracks live planner latency on the demo host. A real production-adapter diagnostic changed only the child-process socket bound to 30 seconds and obtained HTTP 200, STOP and validated structured output in 13.03 seconds total (401 tokens). It did not write a database or activate authority. Production remains at eight seconds. Total elapsed is not a per-phase measurement; the precise cause and reviewed operating fix remain Farid's work. Key/body/response text was not logged.


## PF-015 durable handoff and one-attempt dispatch (2026-10-17)

PF-037/#69 merged at dcf8a968f03c4d82ff87050e9ad1dc4a6974e9d8 after explicit
owner contract approval and passing exact-head Ubuntu/Windows CI (401 backend /
37 browser tests). Its private table is now an approved dependency.

PF-015 adds internal service functions, with no router, schema or migration
change. Preparation binds actual signed bytes to the genuine permanent claim,
certificate, current authority, recomputed risk and signing audit before storing
bytes and keccak hash atomically. Dispatch commits PENDING plus a reservation
audit before RPC; a fresh writer lock covers renewed authority/live chain checks
and the single send. No automatic retry, re-sign, replacement or rebroadcast is
implemented. A crash after reservation may strand an unsent transaction; callers
must reconcile the stored hash rather than treat PENDING as proof of broadcast.

Receipt/reorg/confirmation reconciliation, exactly-once ledger adjustment, public
route activation and real-chain acceptance remain incomplete. PF-015 and PF-014
remain open. No runtime wallet/configuration, financial assumptions or public
execution was activated. Focused isolated tests use real SQLite and signatures,
with substituted RPC only; these are not live transaction evidence.

PF-015 slice local full validation passed: 423 backend / 37 browser/API tests,
Ruff/contracts/lint/typecheck/build, with no generated public contract change.
No live network send was performed. The issue is not closed by this slice.

## PF-015 canonical receipts and atomic synthetic ledger (2026-10-17)

PR #74 merged at 2f6851cfc9f46f4517195385599927a5dbe3aa9b after lead-workstream
execution/security review and current Ubuntu/Windows CI passed (423 backend /
37 browser tests). It preserves the one-attempt dispatch boundary.

The receipt follow-up authenticates historical authority at claim time without
renewing it, so expiry or a changed current state does not prevent reconciliation.
It reads only the existing hash, validates canonical Base Sepolia receipts and
exact token-transfer event evidence, requires at least two confirmations and
persists outcome/block-hash evidence in existing audit records. No schema change.

Planning effects use the approved risk model's integer-cent cash/position/explicit
synthetic-fee semantics. Effects and outcome/audit updates commit atomically;
concurrent/repeated polls do not double-debit. Reorgs reverse only an unchanged
immediate result by appending a state version; later financial edits cause a
visible manual recovery conflict. Missing synthetic cash is never invented.
Public execution remains disabled. Review added a recovery-error precheck before
internal signing and repeated checks under serialized handoff/dispatch locks.
This blocks a recovery conflict racing an already prepared attempt even when its
state version is unchanged. Future PF-014 public integration must use the guarded
service; standalone claim/signing helpers do not complete that gate.
See EXECUTION_RECONCILIATION.md. No real-chain receipt or acceptance completion is
claimed; PF-014/PF-015 and their dependent gates remain open.


Review also blocks another PENDING/REORGED attempt across different wallet nonces,
so unsettled transfers cannot reuse an unchanged planning cash balance. The
confirmation threshold is fixed by the first receipt audit; it cannot later be
reduced or changed in a way that falsely reports a policy change as a reorg.
Both concerns have focused regressions. These checks affect internal services
only; public execution and live evidence remain incomplete.

Final receipt/recovery local validation passed 463 backend / 37 browser/API tests
and all static/contract/build checks. Final dispatch/reconciliation focus passed
62 tests. Public generated contracts are unchanged. Hosted CI and lead-workstream
execution review remain required; no live transfer or receipt was performed.

## PF-014 internal executor composition (2026-10-17)

PF-015 receipt/ledger PR #75 merged at 8927410fa12ec47db7b2f8840537859385625d0a
with current Ubuntu/Windows CI success and lead-workstream security review.
PF-014 now composes the reviewed preparation, one-attempt dispatch and receipt
reconciliation boundaries in an internal function in its owned router module.
The HTTP handler remains unchanged at NOT_IMPLEMENTED/501; no activation flag,
shared schema, runtime configuration or financial assumption is introduced.

Existing matching dispatched attempts only reconcile their stored identity.
Mismatched idempotency/certificate identities and stranded CLAIMED attempts
refuse; ambiguous sends reconcile without retry/re-sign. This does not provide
manual recovery tooling or public/live acceptance. PF-014/PF-015 remain open.

PF-014 internal composition local full check passed 468 backend /37 browser/API
tests and static/contracts/build checks, with unchanged generated public contracts.
No live transaction, receipt or public activation was performed.

PF-038 evidence integration refreshed through main 0482226 after #76 merged
with independent agent review and current Ubuntu/Windows CI success. Both planner
and execution histories are preserved. Independent planner focus passed 29 tests
on the earlier refresh; no planner runtime source or settings changed. The
reported 9.18/1.86/1.97-second calls remain author-recorded historical evidence,
not a claim that intermittent timeout causality or availability is resolved.
Issue #72 stays open; current refreshed-head full CI remains required.
## PF-032 isolated backend preparation (2026-10-17)

Based on main 8927410 (merged receipt reconciliation #75). Only emergency.py,
service tests test_pf_032.py and this progress entry are included. No shared
router, PF-026 acceptance, attack fixture or methodology changes are included.
The service atomically debits 200000 cents of liquid non-high-risk assets,
appends state with CAS, reprices with the same confirmed policy/config and
records linked audit evidence. Destination comes from operational configuration,
not policy-list order. Realized-expense metadata is cumulative, never deducted
a second time; clock and schedules are preserved. All failures roll back.
Public emergency route remains 501 on this backend-only branch.

Focused tests: 10 passed. Full npm run check: exit 0, 473 backend / 37 browser/API
tests; Ruff/contracts/frontend lint/typecheck/build passed. Generated contracts
unchanged, diff check passed; two existing Python deprecation warnings remain.
Tests use real database/policy/simulation/optimizer with isolated chain bounds.
PF-014 remains open, so this branch is local and not published or marked complete.
Shared-router activation and full route/security evidence are a separate change.

## PF-032 backend draft publication requested by owner (2026-10-17)

User requested pushing prepared work and checking merge eligibility. Refreshed
backend onto main 07b44ef (including internal executor #76 and planner evidence
#73). Draft PR #77 publishes backend/tests only; router remains separate. Focused
10 passed; fresh npm run check exited 0: 478 backend /37 browser/API tests, Ruff,
contracts, lint/typecheck/build passed. Generated contracts unchanged; diff check
passed. Two existing deprecation warnings remain. PF-014 stays open, so draft
publication is review preparation, not prerequisite completion or merge acceptance.
## PF-032 separate router integration preparation (2026-10-17)

Backend-only commit 988e70c is isolated on codex/pf-032-emergency-backend-local,
based on main 8927410. The child codex/pf-032-emergency-router-local changes only
the existing emergency handler and PF-032 integration tests/progress. Attack and
reset remain 501; no shared model, migration or public schema changes.
The router requires authenticated CSRF-protected identity and DEMO_MODE. The
backend-only 501 isolation assertion is removed only on this activating branch.
Route tests are test_pf_032_routes.py, test_pf_032_acceptance.py and
 test_pf_032_dispatch.py (the latter two consolidate existing local PF-032 risk
acceptance evidence without introducing workflow/attack implementations).

All focused PF-032 files: 35 passed. Coverage includes exact cash boundaries,
multiple balances, risky/illiquid exclusion, prior/repeated emergencies, configured
destinations second in policy lists, missing settings, policy mismatch, invalid
request bodies, demo/session/CSRF rejection, concurrent/stale requests, audit and
recalculation rollback, historical certificate preservation, 275000 -> 225000-cent
funded-fixture repricing, pre-sign stale refusal with zero signer calls, and
post-sign/pre-dispatch stale refusal with zero sends and no re-signing. Production
policy/simulation/verifier/signing/persistence/dispatch checks are real; RPC and
scheduling are isolated fixtures, never claimed as live-chain acceptance.

Full npm run check exit 0: 498 backend / 37 browser/API tests; Ruff, contract
checks, frontend lint/typecheck/build passed. Generated OpenAPI/TS unchanged;
diff and private-credential scans passed. Two existing Python deprecation warnings
remain. The backend-only branch separately passed 473 backend / 37 browser/API.

PF-014 remains open. Both changes are committed locally; publication waits for
its completion/merge and a fresh main integration check. Router change needs
lead review. PF-032 is not closed, no signing configuration or financial settings
were activated, and no transaction was sent by this preparation.

PF-032 independent review found no blocking backend defect at9ff18ce, but the
full PF-014 prerequisite remains incomplete. Independent focused10 tests passed.
Added a same-version concurrent emergency regression: exactly one state/outflow
and audit event commit, the other request conflicts. Focused11 passed. Local full
check on07b44ef-based backend plus that test passed479 backend /37 browser tests
and static/contracts/build checks. This does not establish certificate/approval
invalidation or positive-repricing acceptance; those regressions remain needed
before activation. No production source or public route was changed by review.


## PF-015 private recovery inspection (2026-10-17)

Added a read-only internal inspection of verified dispatched attempts, reporting
persisted identity/status/hash, active ledger-effect/current state consistency,
last audited observation/threshold and QUERY_EXISTING_HASH or MANUAL_LEDGER_REVIEW.
It contacts no RPC and changes no database row. Reports exclude raw signed bytes.
Stranded claims still refuse; manual mutation/recovery is not implemented.
Three tests failed before implementation then the complete reconciliation focus
passed43 tests. Public execution remains disabled and no live chain result is
claimed. PF-038 historical evidence merged via #73 at07b44ef after independent
review and both current CI jobs passed; timeout causality remains unresolved.

Recovery-inspection full local check passed471 backend /37 browser/API tests
and all static/contracts/build checks. No generated public schema change.

PF-032 emergency acceptance follow-up adds genuine issuance/approval invalidation
and positive repricing regressions. A real200000-cent emergency advances state;
both the prior certificate and a separately human-approved certificate fail the
real executor with STALE_STATE before signing or claims. Certificate and approval
history remain unchanged and approval is not consumed. The positive case runs
the real policy/simulation/optimizer before and after expense and obtains a
smaller positive SAFE_ACTION maximum with next-cent rejection. Its extra cash
and zero-risk assumptions remain isolated test fixture data, not runtime approval.
Focused13 emergency tests pass. Public emergency/execute routes remain disabled;
PF-014 remains incomplete, so PF-032 stays draft/dependency-blocked. Full check
results follow; no production service was changed by these added regressions.

Final PF-032 acceptance-test follow-up full npm run check passed484 backend /
37 browser/API tests, Ruff/contracts/lint/typecheck/build. Public generated
contracts unchanged. Independent agent source review found no issue in the two
new regressions; the agent did not execute tests. Current-head hosted CI remains
required, and draft dependency status is unchanged.
## PF-015 guarded internal ledger recovery (2026-10-17)

Prepared explicit internal recovery for a REORGED accounting conflict where later
financial edits left the execution's affected assets unchanged. Requires exact
inspected state hash, historical authority/audit/signed-byte binding, fresh chain
absence/noncanonical evidence and reproduced certified cash/position effect.
Preserves all unrelated current fields/assets; touched cash/positions refuse.
Appends state/reversal/reconciliation and clears the error atomically. Repeats
refuse. Automatic reconciliation, public HTTP501 and nonce reservations are
unchanged. No runtime recovery, new approval or live-chain evidence is claimed.

Five regressions first failed due to the missing function, then the reconciliation
suite passed48. Additional cases cover RPC, wrong actor and final audit failure
rollback. Independent agent review found no blocking security/correctness issue;
it inspected source only. Final focused/full results follow. PF-015 stays open.

Guarded-recovery final focus passed51 reconciliation tests. Full npm run check
passed479 backend /37 browser/API tests, Ruff/contracts/lint/typecheck/build.
Generated public contracts unchanged. Fresh CI and lead security review remain
required; no runtime recovery or live-chain result was performed.

## PF-022 certificate form hydration guard (2026-10-17)

Refreshed original PR #52 from main f88214b without replacing its parent/UI work.
Controlled no-JavaScript and held-real-JavaScript regressions both failed before
the change: Certificate ID was enabled before React installed change/submit
handlers. The form now disables input/submission until real hydration using the
established login hydration gate. No timeout/retry/existing assertion changed.
This proves and repairs a pre-hydration interaction gap, not every historical
unknown-certificate wait. Current GitHub #52/#53/#54 checks already passed before
this change; earlier failing observations were stale and are not erased.

All41 read-only browser checks passed after the change, including both new tests,
real unknown-certificate HTTP409, retained ID and absent decision/execution panels.
Independent source review found no actionable findings; reviewer did not run tests.
Full repository validation follows. PF-015 dependency/public execution stay blocked.

PF-022 final full npm run check passed479 backend /55 browser tests plus Ruff,
contracts, lint, typecheck and build. Public generated schemas unchanged. The
controlled hydration gap is fixed; historical unrelated timing failures remain
open. Parent #51 was refreshed from main while preserving original UI changes.
Current-head CI and PF-015 dependency still govern merge eligibility.
## PF-016 key-independent internal workflow preparation (2026-10-17)

Owner requested finishing work that does not require the missing testnet key.
Prepared internal planner -> real optimizer -> independent trusted verification
-> linked workflow audit, without importing approval/execution or calling an EVM
signer. Public workflow and execute routes remain501. This is a draft preparation
slice while PF-015's full public/live prerequisites remain incomplete; it does
not close PF-016 or unblock the dependent UI/acceptance stack.

Clarification refuses before issuance. The original shortfall returns the real
optimizer NO_SAFE_ACTION with no certificate. Current state/policy/config and
full audit integrity are checked; a late race cannot produce WORKFLOW_PREPARED.
Services commit their own genuine stages, so a later failure can leave historical
verification/certificate artifacts; no cross-service atomicity is claimed. The
completion audit binds actual action/verification/certificate IDs plus goal,
plan and optimization digests, without planner text or secrets.

Initial four tests errored because the service module was absent, then passed.
Expanded focus passed8 tests covering real issuance/audit IDs, no approval or
execution records, ambiguity, baseline denial, state races before/after issuance,
configuration change, audit-write failure and corrupt audit history. Fixtures
use real policy/simulation/optimizer/crypto/SQLite with isolated RPC and explicit
test-only finances. No live financial configuration, approval or chain evidence
is invented. Full check and review evidence follow.

PF-016 review found a configuration A -> B -> A race: checking only the current
configuration could link optimization under A to a genuine certificate under B.
A regression reproduced the gap (expected DomainError but none was raised).
Finalization now binds the persisted verification and simulation metadata/full
configuration and the certificate's embedded simulation/action/state/policy,
canonical hash, signature and time. Current policy-content digest also matches.
The expanded nine-test focus and full validation results follow. No original
assertion, timeout or route behavior was weakened to resolve this review finding.

Final focused PF-016 check passed9 tests. Independent follow-up source review
found no unresolved actionable findings. Initial full check passed488 backend
and all static/contracts/build stages, but browser acceptance failed at the first
foundation login:26 passed,1 failed,10 did not run. Sign out was absent at5000ms;
login snapshot showed cleared password/enabled Sign in. PF-035 remains unresolved.
The workflow remains draft preparation; no full-check success, public activation,
complete PF-016 outcome or live-chain result is claimed.

Published draft #80 at25ddd5a. Unchanged browser repeat again produced26 passed,
1 failed,10 not run at the same foundation login assertion. Nine workflow tests
passed again, alongside focused Ruff/diff checks. Hosted CI is pending; draft
and dependency gates remain. No merge or public execution activation occurred.
PF-032 draft #77 refreshed from main f88214b after guarded recovery merged.
The documentation-only merge conflict preserved both evidence sections; emergency
source and its thirteen tests are unchanged. Focus passed13. Full npm run check
passed492 backend /37 browser tests and all Ruff/contracts/lint/typecheck/build
checks. No generated contract changes. Dependency gates and public HTTP501 remain.

## PF-032 separate router draft publication #81 (2026-10-17)

Resolved progress-only publication conflict and refreshed the router onto the
lead's backend head a176af5, including main f88214b and the added concurrency /
approved-certificate evidence. All backend additions preserved. The backend-only
501 check is removed on this activating branch; its positive service/HTTP test
instead proves stale-version conflict and unchanged state. No financial assertion
was relaxed. Router PR #81 targets backend PR #77 and remains draft for lead review.

Focused PF-032 tests: 38 passed. Full npm run check on f17b983 exited 0: 517 backend
/37 browser/API tests; Ruff/contracts/lint/typecheck/build passed. Generated public
contracts unchanged, git diff --check and private-credential scan passed. Two
existing Python deprecation warnings remain. The obsolete pre-refresh full run
was stopped after detecting newer backend code; no success is claimed for that run.
Backend PR #77 has passing exact-head Ubuntu/Windows checks. PF-014 remains open,
so neither draft is merged and PF-032 stays open. No runtime signing, policy or
risk settings were activated; no live transaction/receipt is claimed.

## PF-038 bounded provider request (2026-10-17)

Based on main fa6bc08. Reproduced old connect/header timings: connect 0.154s,
header timeout 8.005s. A separate 30-second diagnostic returned HTTP200 and valid
Proposal. Added a disposable provider subprocess with a 30-second request-wide
limit (plus OS launch/cleanup overhead), captured private stdin/stdout, 64KiB
input/output bounds and repeated parent canonical validation. The worker retains
all provider parsing/credential checks, uses a socket bound inside the global
limit, and prints no raw errors. Credentials are never command-line arguments.
No retries, silent fallback, public models or financial authority changed.

Existing 29 planner regressions remain; provider-unit tests exercise the same
private HTTP implementation, with nine new deadline/process tests. These include
real worker cancellation despite valid partial stdout, invalid worker settings,
worker failure/oversize/malformed money sanitization and private-key argv isolation.
Focused PF-017/PF-038: 38 passed. Two real worker-backed express calls validated
in 12.826s and 2.185s with synthetic unconfirmed context and no DB/signing path.
Safe phase/timing evidence: evidence/planner-request-deadline.json.

Full npm run check exit 0: 526 backend /37 browser/API tests, Ruff/contracts/lint/
typecheck/build passed; generated contracts unchanged and diff/credential scans
passed. Two existing Python deprecation warnings remain. The proxy still has a
10s cap on this backend branch: prepare the separate lead-reviewed planner-only
35s proxy change before claiming PF-038 complete. Current CI/review/merge remain.

## PF-038 planner-only proxy budget companion (2026-10-17)

Separate shared server-router change stacked on backend PR #82. Discovered the
existing proxy's 10000ms cutoff independently prevented valid slower provider
responses. Only intent/parse and plans/generate now use 35000ms, allowing the
30000ms backend provider budget plus process/transport overhead. All other reads,
execution and mutation budgets remain 10000ms; route/header/auth allowlists and
public contracts unchanged. Lead review required before merge.

Actual proxy-handler regression with an isolated upstream delayed 11 seconds:
old code 2 failures (HTTP503), 1 pass; changed code all 3 passed (planner HTTP200,
ordinary read/execute budget still 10000ms). A genuine authenticated API diagnostic
returned HTTP200/live_llm clarification in 2.274s using a disposable seeded,
unconfirmed-policy fixture. State/audit unchanged; no candidate/certificate/
execution records. No real provider test is skipped or substituted into CI.

Full npm run check exit 0: 526 backend /40 browser/API/proxy tests, Ruff/contracts/
lint/typecheck/build passed. Generated OpenAPI/TS unchanged; diff and actual
private-credential scans passed. Two existing Python deprecation warnings remain.
Both reviewed PRs must merge before closing #72; no guaranteed provider uptime,
financial configuration, signing or chain acceptance is claimed.

## PF-038 final credential-precedence hardening (2026-10-17)

Backend #82 merged at owner instruction after both exact-head hosted checks
passed. Proxy branch synchronized with that merge without file changes. Final
review found that omitting an explicitly None llm_api_key from worker stdin
could allow child BaseSettings to fill it from inherited environment. Parent
settings now serialize that explicit null, preserving exact credential selection;
non-null secrets still use private stdin only. Added a regression with a conflicting
inherited key. Focused planner tests 39 passed, Ruff passed. Previous local full
526/40 remains historical; refreshed full hosted CI is required for this new head.
The prior proxy CI run is superseded by this security fix, not reported as a
current success. No response fallback, authority or provider selection changes.

## PF-014 public adapter and owner-directed takeover (2026-10-17)

Owner directed Codex/akiibot to take over all Farid and Wasik tasks. Contributor
instructions and ownership documentation reflect that assignment; module and
lead-review boundaries remain intact. All 15 open GitHub issues are assigned
to akiibot. Workspace #84 merged after explicit approval and both hosted checks.

POST /execute now connects the existing independent executor when the operator
explicitly enables EXECUTION_ENABLED (default false). Its policy comes only from
existing private transaction configuration; no client enable/policy fields are
accepted. Missing/invalid settings fail closed with sanitized errors. The existing
authenticated actor, independent claim/signing, durable one-attempt broadcast and
receipt reconciliation are preserved. No schema, migration, canonical payload or
generated public contract is changed. Actual runtime enablement is not performed.

New HTTP integration tests exercise real signing/store/authority with isolated
RPC fixtures: one dispatch under concurrency, ambiguous send reconciliation,
stranded-claim refusal, receipt resumption, auth/CSRF/digest and authority injection
rejection, sanitized configuration failures and explicit/default disablement.
Focused HTTP/signing/dispatch/reconciliation suite: 119 passed. Full npm run check
passed: 544 backend and 48 browser/API/proxy tests, Ruff, generated contracts,
frontend lint/typecheck/build. Public generated contracts unchanged; diff check passed.
This is not live chain acceptance; PF-014/PF-015 remain open for review/integration.

## PF-036 explicit funded-scenario preparation (2026-10-17)

Owner approved the additional $5,000 synthetic scenario and delegated demo-input
selection. Selected hypothetical config is documented in FUNDED_DEMO_SETUP.md;
no calibrated probabilities or actual income are claimed. A default-preview CLI
requires exact scenario/config digest confirmation to publish a NEW isolated DB.
Existing migrations/seed/state append/audit are reused. Baseline v1 is retained,
funded v2 and config are persisted together, and the Constitution stays a draft.
Existing DB paths refuse, staging is private, and publish is atomic/create-only.
No public contract, migration, runtime config, signer or original DB is changed.
Focused tests: 9 passed. Full npm run check passed: 536 backend /48 browser
tests, Ruff/contracts/lint/typecheck/build. No runtime provisioning performed.

## PF-040 read-only chain readiness (2026-10-18 Asia/Dhaka)

Issue #91 replaces the stale PF-030 placeholder in authenticated GET /chain/status
using the existing ChainStatus contract. The read-only service loads RPC/wallet/token
settings without any signer key, pins Base Sepolia 84532, checks deployed code and
supported decimals, and reads token/native balances at one observed block. Missing
or invalid settings report CHAIN_NOT_CONFIGURED; RPC/network/token failures report
sanitized UNAVAILABLE. READY describes connectivity and balances, including zero
balances; it does not grant execution authority or establish receipt acceptance.
No schema, migration, transaction format, policy or runtime setting changes.

Sixteen focused isolated route tests pass, including authentication, wrong chain,
malformed responses, unsupported decimals, secret-bearing errors, zero balances,
pinned-block reads and execution-disabled/key-independent readiness. These are
isolated test fixtures, not live Base Sepolia acceptance. Full npm run check passed: 569 backend /48 browser tests and
Ruff/contracts/lint/typecheck/build. A separate live read-only service check
returned READY with the expected 10,000-token balance. The current public route
remains unchanged until this PR merges. Current hosted CI and lead shared-route
review are required.
## PF-015 genuine application execution (2026-10-18 Asia/Dhaka)

After actual owner Constitution confirmation and separate exact-certificate consent,
the existing authenticated application executor sent 2,000 MockUSD on Base Sepolia.
Transaction 0x74da3bb8b2ce5f7fe53754b4413c1e591c9941eac6b528f34afaeb2b25a01e49
is CONFIRMED. Independent receipt/Transfer/balance checks and repeat reconciliation
prove one execution/envelope and one ledger application, state v2 -> v3. See
LIVE_EXECUTION_ACCEPTANCE.md and evidence/base-sepolia-application-execution.json.
This is genuine API/RPC evidence, not a browser/full AT or scenario B/C completion.
Sensitive acceptance review and remaining recovery scope stay explicit.

## PF-027 methodology/API/threat notes (2026-10-18 Asia/Dhaka)

PF-014 is complete after owner-approved #89/#93; PF-027 dependencies are satisfied.
Added SIMULATION_METHOD.md and THREAT_MODEL.md and replaced obsolete foundation
API notes with the complete generated operation inventory and current operating
boundaries. Documents distinguish finite hypothetical simulation outcomes from
forecasts, four named stresses from three scenarios, policy approval from exact
certificate consent, immutable payload from mutable execution, and genuine API/
receipt evidence from isolated tests and incomplete full acceptance. Recovery,
compromised-host/DB, session/RPC/resource and production limits stay explicit.
One focused regression verifies documented routes/operation IDs against generated
OpenAPI without redefining schemas. Full validation and current CI follow.
## PF-041 emergency repricing and new-recipient consent (2026-10-18 Asia/Dhaka)

Issue #95 reproduces a real mismatch with the owner-confirmed Constitution: a
new operational recipient caused emergency repricing to return403 even though
that policy permits proposals subject to exact new-recipient approval. The new
isolated regression failed403 before the change and passed200 after removing
only the known-recipient prerequisite. Blocked recipients, disallowed token/chain,
stale state, missing authority, atomic cash debit and future stresses remain.
No approval, certificate authority, signer or policy mutation is added by repricing.
The real verifier still returns REQUIRES_APPROVAL for any safe new-recipient action.

Updated obsolete tests to distinguish unknown recipients from explicitly blocked
ones; retained no-debit assertions for actual forbidden destinations/tokens and
added stronger policy-unchanged/no-approval/no-execution coverage. The full first
check found one remaining obsolete route expectation (572 passed/1 failed); its
recipient case now explicitly blocks the destination rather than treating unknown
as forbidden. All42 focused emergency/authorization/dispatch/acceptance checks pass.
Only isolated test state changed; no runtime emergency expense or policy was sent.
## PF-014 completion and PF-031 controlled attack (2026-10-18 Asia/Dhaka)

Owner-approved live application evidence #93 merged at c066e27 after final-head
Ubuntu and Windows CI passed (run39059691050). PF-014 is closed: independent
claims/replay/concurrency, default-off authenticated execution, and genuine exact
consent/transfer/reconciliation/one-time ledger evidence are integrated. PF-015
remains open for explicitly recorded changed-asset/lost-handoff recovery scope.
PF-031 and PF-027 listed dependencies are now satisfied and labels audited.

PF-031 implements a deterministic untrusted $4,000 borrowed-funding proposal.
Borrowing is always forbidden by the existing Constitution contract; the injected
planner prose claims approval but carries no authority. The actual verifier
persists simulation/candidate/rejection with no certificate. The production
executor claim boundary is then exercised with an explicitly unissued attacker
certificate identity and refuses INVALID_CERTIFICATE. No signing/send function
is called by this demonstration, including an unexpected claim acceptance.
A linked ATTACK_EXECUTOR_REJECTED event binds candidate, verification, simulation,
actual executor error and response digest. Non-demo, unauthenticated, CSRF/body,
configuration and unavailable-executor cases fail explicitly.

Nine focused tests pass with signer-construction/sign spies that fail on any call.
A genuine authenticated API invocation against the existing isolated funded demo
(no substituted services) returned DENY/no certificate and INVALID_CERTIFICATE,
signer_called=false/tx_hash=null. Execution/envelope/state counts stayed 1/1/3.
Public evidence: evidence/controlled-attack.json. This is backend rejection evidence;
it does not complete the red-team UI, browser AT suite or other scenario acceptance.

## PF-023 independent red-team UI (2026-10-18 Asia/Dhaka)

Built independently on merged PF-031 (#94), without importing the blocked
certificate/audit stack. Red team navigation now opens the controlled proposal
screen. Each attempt requires a fresh acknowledgement; the generated client sends
no public attack parameters. A successful rejection banner requires the actual
DENY, absent certificate, INVALID_CERTIFICATE, signer=false and null tx values.
Audit records match this response's action/verification IDs. An audit read failure
preserves the received rejection; a lost response is explicitly unconfirmed and
locks blind retry. No session-check failure is described as a sent request.

A genuine browser -> Next proxy -> existing isolated demo API check returned
HTTP200, DENY/no certificate, INVALID_CERTIFICATE, signer_called=false/tx_hash=null
and three linked audit records. No route interception or substitute services were
used. Execution/envelope/state counts stayed 1/1/3; no policy or funds changed.
See evidence/red-team-browser.json. Frozen historical response/audit replay is
separately labeled isolated rendering coverage, never backend acceptance.
Full all-scenario AT acceptance and the Audit Explorer remain outstanding.

## PF-015 bounded recovery decision prepared (2026-10-18 Asia/Dhaka)

Main b67b05f already includes authorized signing, durable one-attempt dispatch,
receipt/ledger reconciliation, read-only inspection and unchanged-asset recovery.
The unsupported cases are lost signed-byte handoff and changes to affected ledger
assets after an execution effect. Existing paths refuse instead of re-signing or
overwriting history. EXECUTION_RECOVERY_SCOPE.md proposes this conservative MVP
boundary; advanced operator design is tracked in #99. Lead approval is outstanding;
#15 and dependent completion gates remain open. No runtime recovery, reset or
transaction was performed. The existing unmerged four-stress evidence correction
is preserved here and compared directly with the original signed certificate.


## PF-016 public preparation and linked consent boundary (2026-10-18 Asia/Dhaka)

After owner-approved PF-015 scope #100 merged at f724f2f and both CI jobs passed,
#16 is ready and #80 is refreshed from main. The declared authenticated workflow
route now calls the existing preparation service using session identity. Its
result remains plan/optimization/verification only; approval and execution are
separate operations. No public contract or transaction encoding changes.

A regression first reproduced HTTP501 and now returns a real optimized certificate.
Fourteen focused tests pass, retaining state/policy/config races and audit integrity
checks and adding HTTP session/CSRF/authority refusals. A cross-route isolated test
proves no consent or signing during preparation, APPROVAL_REQUIRED before an explicit
decision, then one PENDING dispatch with certificate-bound audit and one-time approval
consumption; repeated identity only reconciles. This is isolated RPC evidence, not
a new live transfer or confirmed receipt. Full validation/current CI and sensitive
lead review remain outstanding before integration. Earlier login/501 notes are
historical checkpoints, not current reproduced failures.


## PF-025 audit/verifier integration and genuine browser observation (2026-10-18 Asia/Dhaka)

After owner-approved #80 merged34901ef with both current CI jobs passing, #25
is ready. #51 is refreshed onto that main, preserving Workspace and Red-team.
Its Audit/verifier pages, hash-chain checker and shared certificate details/status
components are reused; #52 must import these components. Inherited tests use the
existing session cleanup fixture; authentication logic and worker count are unchanged.
All52 scoped/dependency browser checks passed, including nine PF-025 cases.

Genuine proposed UI -> Next proxy -> approved API checks recomputed/linked all21
existing audit events and opened the original public certificate via its audit
link. Real status was EXPIRED/signature_valid=true; ten certificate/execution-linked
events include the genuine ledger effect and existing transaction hash. Ledger
events link through execution_id, not a fabricated direct certificate_id. The
capture checker was corrected to follow that existing graph. Full financial state
and audit stayed equal; execution/envelope/state counts stayed1/1/3. No services
were substituted and no expense, approval or transfer occurred. Evidence is in
evidence/audit-browser.json and its two PNGs; the certificate screen was visually
checked. This captures the review UI, not a completed positive AT-01 journey.
Full npm run check/current CI remain required before integration.


## PF-027 documentation refreshed after workflow/Audit integration (2026-10-18)

PR #96 now follows reviewed main9c840e1. API inventory describes the merged
authenticated goal preparation and separate consent/execution boundary, including
partial artifacts on later-stage failure. Threat notes reference owner-approved
PF-015 refusal scope and #99 advanced recovery. No route, schema, policy or runtime
behavior changes. Fresh validation is recorded with this revision before review.
## PF-022 integration prepared after shared Audit merge (2026-10-18)

PR #52 now targets reviewed main9c840e1 and imports the merged shared details,
status and transaction components. Workspace IDs and Audit links open Certificate
review. Original generated approval/execution requests remain distinct; exact
identity is retained before dispatch and uncertainty prevents a new attempt.
Only a matching recorded audit claim permits explicit same-identity reconciliation.
Read failures preserve received outcomes and disable financial actions.

Fourteen focused tests and full596 backend/76 browser pass on source64b193c;
visual review then corrected one hint so it no longer assumes tab storage exists.
A genuine screen check of the preserved demo on source62a0b48 verifies all21 audit
events, ten certificate/execution links, actual EXPIRED/signature_valid=true and
recorded final APPROVE. It offers neither a new execution nor reconciliation
without the original identity. Full state/audit and execution/envelope/state
counts1/1/3 remain unchanged. Evidence: evidence/certificate-browser.json/.png.
No service substitution, financial action or policy change. Positive browser
execution remains missing; #22/#26 are not closed by isolated rendering fixtures.
Current hosted CI and required lead approval remain integration gates.


## PF-043 positive browser optimizer deadline reproduced (2026-10-18)

On merged main dbca5c5, real intent/plan calls succeeded but Next cut off positive
optimization at exactly10s (HTTP503). A separate schema-valid controlled manual
candidate sent directly to the actual backend/RPC returned SAFE_ACTION/$2,000,
next_cent_rejected=true in11.089s. Its local120s observation bound was diagnostic
only and changed no production code or timeout. An initial diagnostic omitted
required planner_mode and was refused422; no positive claim uses that request.

PF-043/#102 adds only optimize to the existing35s bounded proxy preparation
allowance. Reads, approval/execution budgets, allowlists, cookie/Origin/CSRF and
body bounds are unchanged. An isolated11s transport regression first failed503
against the old route; all four focused proxy checks then passed. Existing
financial budgets are explicitly checked at10s. This changes application request
handling, not test timeouts, retries or financial algorithms/authority.

A genuine proposed UI observation on6dc3e92 returns live_llm candidates followed
by actual SAFE_ACTION/$2,000 and next-cent refusal. This successful sample took
7.8s; it is not falsely described as another beyond10s sample. Snapshot hash stayed
unchanged, state versions remain2 and execution/envelope counts0/0. No certificate,
approval, expense or execution sent. Evidence: optimizer-proxy-operating.json and
positive-optimizer-browser.png. Full check, current hosted CI and shared-proxy
lead review remain required before integration. The complete financial browser
journey remains open; new exact certificate approval is still required.


## Genuine complete browser journey on proposed PF-043 integration (2026-10-18)

The owner separately approved #103 for merge after current CI and authorized
exactly cert-26a61888-39cb-42c5-933c-9df791c4df26/hash
62ae85f5e925cc72b7cd6f93a1b922421a854a2320ee01cc2c902cd930d009ab before expiry.
The real browser recorded APPROVE at22:05:49 UTC, then requested one execution.
Its initial proxy response was503/unknown. The screen retained the original
identity and, after recorded durable dispatch evidence, explicitly reconciled
that same identity to PENDING and then CONFIRMED. Three HTTP requests represent
one signing/envelope/dispatch, not three transfers. Ledger applied once, v2->v3.

Actual transaction0xd13c41c1141b22ab3604978582ee5643a06a9b83af360f8de8d76b7e46ad378d
is confirmed at block48253237. Independent read-only RPC matched canonical block,
receipt status1, exact transaction nonce/fees/calldata and the token Transfer of
2000000000 units to the authorized recipient. Certificate payload stayed equal;
all14 browser audit events recomputed and linked. Database counts: one approval,
one execution, one envelope, three states. Original demo counts1/1/3 and hash
remain unchanged. No expense/reset/additional transfer.

See evidence/base-sepolia-browser-execution.json, its original certificate and
positive-browser-confirmed/audit PNGs. This is genuine proposed integration
evidence with no intercepted responses or service substitutions. Required #103
current CI/merge and the remaining acceptance/scenario/package work are still
open. Methodology #96 merged a713792 with both current checks passing.

## PF-044 required bounded runtime preparation (2026-10-18)

Scenario C's genuine production browser passed login/live planning but exceeded
its unchanged30s optimizer observation. The unchanged approved state/config/policy
returned SAFE_ACTION/$2,000 via a direct read-only diagnostic in52.337s, beyond
the application's35s preparation bound. No C certificate or expense was sent.
Issue #104 isolates this required runtime gap rather than expanding proxy limits.

The proposed engine precomputes identical daily costs/protected reserves and
per-path integer income arrival totals, and uses equivalent scalar finite/floor
operations. PCG64 streams, sample ordering, paths/horizon, parameters, integer
cash arithmetic, rounding, workload limits, four stresses and independent
verifier boundary checks are preserved. The final direct sample took9.803s;
its complete optimizer response equals the original. The approved C simulation
also matches the original in every normalized field, including all sampled
cash paths, metrics and stresses. These timings are observations, not guarantees.

Focused risk/optimizer/emergency checks passed87/87; exact prechange-output
fixtures passed8/8, including delayed incomes, simultaneous dues, volatile
assets and valid1/366-day horizons. A real production-browser read-only run now
reaches live_llm -> SAFE_ACTION/$2,000 with next-cent refusal. See
`evidence/simulation-runtime.json` and its browser screenshot. The prepared
Emergency UI is visible but its checkbox was untouched; no certificate, expense,
approval, transfer or reset was sent. C remains version2 with zero certificates
and executions; both confirmed demonstrations retain their1/1/3 histories.

Full `npm run check` is running at this preparation checkpoint. A draft PR may
collect current hosted CI in parallel; full local validation must pass before
review is requested. Sensitive risk-code lead approval and both current CI jobs
remain required before integration. The exact C expense authorization persists
unused. Development-login observations remain unresolved in #60; production
preparation is not presented as a repair of those failures.

## PF-035 two-phase browser startup readiness (2026-10-18)

The #105 full local run passed605 backend and frontend static checks, then
reported61 browser passed/2 failed/14 not run. The first failure preserved a
populated credential field and disabled Signing in button; its private snapshot
was redacted. The other failure is the independently prepared #23 hydration guard.
Both full hosted checks for #105 passed; the local failures remain disclosed.

Checking the document alone lets the first login absorb cold proxy work. An
isolated6250ms upstream-startup transport probe forwards actual authentication
responses unchanged: page-only readiness fails the original5000ms Sign out
assertion. API-only readiness also failed on cold Dashboard/navigation work;
clearing only derived cache did not establish a repair. The retained change keeps
existing document readiness and adds one real unauthenticated proxy/API health
check in global setup before browser tests. The same unchanged foundation test
then passes; its financial/authority counts remain1/0/0/0. See
`evidence/browser-readiness.json` for explicit isolated-probe scope.

Normal unmodified-stack focus passed4/4: first foundation smoke, real login/read/
CSRF/logout, unhydrated login guard and actual JavaScript hydration. Lint/typecheck
pass. No authentication implementation, timeout, retry, worker or assertion change.
The actual API health response must be200/statusok or setup fails. Unchanged
Ubuntu/Windows CI runs the complete npm run check before lead review/integration.
This fixes the observed false-readiness class, not every historical empty-field
or HMR observation. #60 remains open for those recorded observations until further
causal evidence exists; no later pass is described as universal repair.

## PF-023 acknowledgement hydration correction (2026-10-18)

Reopened #23 after current local validation showed the checkbox checked while
Run controlled attack remained disabled. The existing SSR checkbox was enabled
before React installed its onChange handler. A controlled regression pauses the
actual JavaScript chunks after real API authentication: original code fails
expected-disabled/received-enabled at the unchanged5s assertion. The proposed
UI uses the already-approved login hydration pattern, keeps both controls disabled
until their handlers exist, then requires the same fresh acknowledgement.

The new regression and all five existing PF-023 checks pass6/6. The real protected
API still rejects public input422; response-loss locking and preserved rejection
results/audit failures retain their assertions. Lint/typecheck pass. No API,
authentication, signing, financial approval, timeout/retry/skip or schema change.
No attack is sent in the controlled hydration test. Existing genuine #98 evidence
remains the actual rejection proof; fixture rendering is not live acceptance.
Unchanged hosted CI runs full npm run check before review/integration. The separate
startup-readiness fix #60 and risk-runtime review #105 remain independent gates.

PF-023 hydration guard merged via #106 at9f9e112 after both current CI jobs passed; #23 is closed again. Current #105 refresh preserves the exact engine hash, golden evidence and all original histories. Prior a32a0a2 full local run:605 backend/static checks passed;61 browser passed/2 failed/14 not run. Both full hosted jobs passed on a32a0a2. The new base includes the independently reviewed UI guard; latest combined CI remains required before risk integration. C policy is active but its one authorized expense remains unused.

#106 merged9f9e112 after both current full CI jobs passed; #23 is closed. This refresh retains exactly the same global startup function already validated on d36c938 (full CI Ubuntu5m19s/Windows10m19s), now combined with the reviewed Red-team guard. Fresh current CI remains required; lead approval is pending. Existing C expense authorization remains unused.


## PF-024 genuine Scenario C (2026-10-18)

Owner-approved runtime #105 merged9d1b6f3 after both current CI checks passed.
The separate approved C policy was already active. The production browser used
actual live planning, optimizer and independent verification, then sent exactly
one authorized expected-version2/$2,000 expense. HTTP200 appended state3, debited
$2,000 and recomputed the exact safe maximum from$2,000 to$799 (23 checks; next
cent refused). Earlier certificate cert-283f104f-671f-4bbd-91e8-9964a5b9ac05
remains byte-for-byte unchanged and its signature checks, but status is
SIGNED_BUT_STALE because the financial state changed. Policy did not change.

Seven audit events recompute/link intact; durable counts are3 states/1 certificate/
0 approvals/0 executions/0 envelopes. No transfer or reset was sent. Both confirmed
demos remain separate and preserved. The exact C expense authorization is consumed.
See evidence/emergency-browser.json and the before/after, stale-certificate and
audit images. The actual browser recording is preserved privately for packaging.

The initial private capture assertion incorrectly expected STALE rather than the
existing contract SIGNED_BUT_STALE after the successful expense. Capture stopped,
without another expense. Separate read-only browser checks confirmed actual status,
signature, immutable certificate and audit. The after image is an unchanged final
recording frame; its Recording label reflects capture during final UI settling.
This limitation is recorded rather than hidden. Current full npm run check is
running before #85 review; #24/#65 remain open until integration criteria are met.

PF-024 final current local validation on59c2f13 completed successfully:605 backend
tests (121.62s),83 browser tests (1.8m), Ruff/contracts/lint/typecheck/build all
passed. Original assertions/timeouts/retries unchanged. Latest hosted CI and
lead integration review remain required; this is not the final AT matrix/fresh
checkout acceptance. No further financial action was performed.

Owner-approved #107 mergedb317c94 after exact-head8d16a41 passed both full
hosted jobs (Ubuntu5m0s/Windows12m20s). #85 now refreshes on that reviewed base;
only docs conflicted, and all histories/current checklist were retained. Emergency
implementation and genuine C artifacts are unchanged. Full local605/83 remains
valid for its recorded59c2f13 head; latest combined hosted CI is required.


## PF-026 acceptance-only refresh (2026-10-18)

Owner-approved #85 merged e45b095 after final-head Ubuntu4m58s/Windows13m15s
CI passed. #24/#65/#104 are closed against integrated genuine A/B/C evidence.
All #26 prerequisites are now actually merged. #56 retains only its own helpers
and tests; every inherited product screen/component is restored from reviewed
main, and all original commits remain preserved.

Remove obsolete acceptance skips and replace readiness-only AT-01 with goal,
proposal, optimizer, certificate, exact approval, real cryptographic signing,
one dispatch and same-identity confirmed reconciliation in the existing loopback
chain fixture. Only the chain/receipt are simulated. Existing backend bypass,
tamper and concurrency tests are mapped rather than rewritten. Public isolated
credentials replace developer-password/key fallbacks in browser tests. Baseline
checks retain version1; a guarded private fixture appends funded version2 only
for the acceptance journeys. No production route/schema or application code changes.

Read-only actual production scan on f681750 checked8 private values against86
responses,19 static files,312 tracked files and8 runtime logs, plus cookie/storage:
no private values found. Public Base RPC documentation is excluded from secret
classification. See evidence/key-isolation-browser.json. Fresh clone b317c94
bootstrap, Chromium installation and schema drift check passed, with independent
local credentials and no copied demo DB/keys. This is setup preparation, not the
final acceptance full run. Focused browser checks are running before full review.

Fresh checkout1a92f4e full npm run check passed605 backend (126.34s)/92 browser
(1.6m), all static/build/contracts. Its own .env, password and baseline DB are
byte-for-byte unchanged. Ubuntu CI passed, Windows failed mid-suite in PF-023
signIn: SSR password input remained disabled30s. No acceptance tests ran on
Windows after that prerequisite failure. This current #60 observation is not
claimed fixed. Add credential-safe failure-only script/status/error-category
telemetry before another current CI run; no auth behavior or test budget change.

Latest38a73dd fresh-checkout full validation passed605 backend/92 browser with
all static/build/contracts and byte-preserved own credentials/baseline DB.
Uncached actual-response collection passes; errors remain fatal. Prior instrumented
dd77dc6 Windows full CI passed. Latest Ubuntu passed on38a73dd. Evidence-only
refresh records these results; exact-head both CI and lead review remain required.
The earlier Windows unhydrated-input case stays documented in #60, not declared
causally repaired. No product/backend/contract code changed in this acceptance PR.

PF-026 integration review, 2026-10-18: owner approved #56 after current CI
passes. Both jobs passed on4dc79a6 against the historical stacked base. Retargeted
#56 to reviewed main e45b095 (already an ancestor of the head); the product diff
remains empty. This documentation update requests fresh CI for the actual main
integration target before merge. No runtime financial action is authorized.


PF-047 / #120 Supabase runtime review preparation, 2026-10-18: prerequisite
storage contract #121 merged at 9e95a25 after owner approval and Ubuntu, Windows
and PostgreSQL CI passed. Existing serialized authority entry points now use its
common lock for SQLite/PostgreSQL; no public API or certificate encoding changes.
Persistent startup validates TLS/public authentication and refuses staging a
wallet key while execution is disabled. Initial hosted execution remains false.

Local corrected PostgreSQL suite: 299 passed in81.27s, including actual PG reset
fixtures and FK-complete guards for all five execution statuses. Chain adapters
are isolated fixtures, not live transfers. Existing SQLite backend: 638 passed
in81.71s; contracts, Ruff, frontend lint/types and production build passed.
Full npm run check reached browser tests but could not bind the owner's occupied
port3000; that running application was preserved. Current Ubuntu/Windows browser
CI is required before merge. A separate actual browser journey on isolated ports
verified PG state/hash persistence and session revocation across API restart.

The owner delegated selection of the existing $17,000 synthetic profile for the
new empty Supabase store (selection digest d966ea53f445fdf948fc92a174d07db425aba90753d5c7683279a47f85d30314).
No cloud application migration or profile provisioning has run. No policy,
expense, reset or transfer is authorized. Runtime lead review/current CI and
hosted validation remain pending; #119 holds the single remaining checklist.


PF-047 hosted milestone, 2026-10-18: #122 approved/merged at3b9fe98 after all
three current CI jobs passed: Ubuntu638 backend/95 browser, Windows638/95,
PostgreSQL17 299. New Supabase-only selected profile provisioned and verified;
all14 application tables have RLS and public client roles lack private-schema
access. Render source3b9fe98 is live at dep-dbac3k67bikc73e2gakg using the installed
Python directly. The prior rollout's Live badge disagreed with actual state and
was rejected; its cause is unresolved, not a proven uv defect.

Actual hosted browser and HTTPS evidence confirmed $17,000 synthetic cash/version2
and hash d17754200d0bb9e28fc1e598b9f1010f83750e3229dc87bb4f884b5eba456877.
A deliberate restart launched a new process, revoked the old browser session,
and preserved exact state/drafts/policy history/audit/chain-read responses after
reauthentication. Secure cookies, auth, CSRF/origin refusal and logout passed.
Policy remains inactive; one provisioning audit event, no new expense/reset/
transfer. Execution still needs dedicated hosted signer/test funds, live planner
configuration and exact financial authorizations. #119 remains the single checklist.


PF-047 hosted acceptance evidence, 2026-10-18: actual Vercel/Render/Supabase
browser journey reached one owner-approved confirmed2,000pfUSD testnet transfer,
0xa748c4875ba7d7e0fd04528ffe35803c562ff532bec791ae70e44741d2a8f462,
block48284502. Exactly one claim/signature/envelope/dispatch/ledger effect;
18-event audit chain and exact chain fields independently validated. Original
A/B/C demos preserved. Initial reconciliation was UNAVAILABLE; the retained
original attempt reconciled successfully without re-sign/send; cause unresolved.
Owner credential corrections and dedicated key/config approvals are recorded
without private values. No application, public contract, timeout, key, financial
rule or runtime setting changes in this evidence-only branch. Actual post-confirmation restart preserved exact certificate/execution/identity/
envelope/approval/state/audit; new process revoked the old session. Current CI
is pending. The single remaining checklist
stays in #119.

PF-049 / #126 Figma v2 frontend, 2026-10-19: the web UI was rebuilt to match the approved Figma file
(Fintechathon, page Design): new tokens, component kit, floating top nav, Home, Ask, Approve and send, Rules (+ history),
Activity (+ story, check certificate) and Security. API calls, request builders, safety guards, schemas and routes are
unchanged; old routes redirect. Verified: typecheck and lint clean, `next build` passes, Playwright e2e 99/99 against
the isolated test database. Not run: backend pytest. Known gaps: Figma 12b headline still reads "Your rules"; the
display font Ambit is replaced by Instrument Sans. See docs/FRONTEND_FIGMA_V2.md.

PF-049 / #126 integration corrections, 2026-10-19: review branch preserves PR #127
head5c1e243 and its contributor history on main8731de3. Home reserve/eligible-cash
arithmetic corrected; Activity/Story accept only complete backend Execution
observations matching the latest hash-verified audit artifact, with explicit
unknown when evidence is incomplete. Combined consent now explicitly authorizes
sending, remains certificate-bound, and retains reorg/confirmation reconciliation.
Reopened modal focus and unsupported planner-safety claims corrected. Request encodings, financial rules and original local/hosted financial evidence
untouched. Separate contract proposal #129/#128 adds authenticated read-only
execution observations with no reconciliation/signing/dispatch.
Final local npm run check passed:647 backend tests, contracts without drift,
Ruff/lint/types/build and112 browser tests. Complete fixture journey includes a
separate tab reading authoritative status without a second send. Current
integration CI and lead/visual review are required; see
[the integration review](PF_049_INTEGRATION_REVIEW.md) for the single acceptance
and owner-decision list. PR #114 is not combined; no extension work is imported.
Figma visual fidelity is unverified without file access; no merge/deploy authorized.


PF-049/PF-050 owner acceptance,2026-10-19: owner approved #129 and the current
visuals and authorized completion/integration/deployment after passing checks.
#129 merged atc3942926af4ca178840ad69e7c135c934a96c951 with Ubuntu/Windows/PG
passing; #130 is refreshed onto main with an unchanged code tree and renewed CI.
The accepted current visuals include the font fallback; no unperformed Figma
comparison is claimed. Deployment/hosted read-only preservation evidence pending.

PF-049 final integration and deployment,2026-10-19: #130 merged ate944d002 after
final-head Ubuntu, Windows and PostgreSQL passed; original #127 also marked merged
with contributor history preserved. Approved #129 backend c394292 is live on
Render; exact merged-main frontend e944d002 built and promoted to the existing
Vercel site. Actual browser Home/Ask/Rules/Activity/Story/proof reads passed.
Authenticated HTTPS checks passed8 pages,20 assets, query-preserving redirects,
secure cookies, CSRF/origin refusal and logout. Zero matches for4 private-value
canaries in responses. Financial statev3/hash, policy/draft/history,3 certificates,
execution and20 audit events stayed exact; independent read-only digests of all15
private PostgreSQL tables stayed exact. No new live financial action or credential
change. Full send/reconcile journey is isolated evidence, not a duplicate live
transfer. Current visuals/font fallback accepted by owner; unavailable Figma
comparison remains explicitly unverified. #99 recovery and #114 extensions stay
separate. [Final checklist](PF_049_INTEGRATION_REVIEW.md) and
[hosted evidence](../evidence/pf-049-hosted-readonly/README.md).

PF-042 / #99,2026-10-19: reviewed actual issue and current mainac1f0e2;
no overlapping active implementation found. Prepared the concrete operator
protocol for lost signed bytes and changed affected assets, including exact
evidence/acknowledgement, permanent refusals, future replay/compensation authority
and atomic crash/concurrency gates. Existing runtime behavior, contracts and
hosted financial state remain unchanged. New isolated tests use real signing
and consumed approval, compare every persisted table, and prove concurrent
refusal, no second signer/send, no approval resurrection and complete rollback
at both recovery audit boundaries. See [protocol](OPERATOR_RECOVERY_PROTOCOL.md).
Design review remains required before #99 closes; advanced repair is not shipped.

PF-042 validation:96 focused SQLite execution/HTTP/recovery tests and79 targeted
isolated PostgreSQL17 tests passed. Full npm run check passed:653 backend,
112 browser, Ruff/contracts/lint/types/build; no generated contract drift.
A new loopback test instance replaced an unavailable old test port and was shut
down afterward. Current CI/lead design acceptance remain required before merge.

PF-042 owner acceptance: in response to the concrete PR #132 approval question,
the owner delegated judgment (“do what you feel best. You have the power in this
case”). Codex selected the conservative protocol; the actual decision is recorded
at https://github.com/akiibot/proofFi/pull/132#issuecomment-6260243961.
All three jobs passed on reviewed headaf5b827. Acceptance wording is documentation
only; final-head CI remains the integration gate. No further owner decision is
needed for design integration. No advanced repair or live authorization is implied.


PF-155 / #155, 2026-10-20: submission documentation prepared from main92a7ff2
in a separate checkout. Added reviewer/test/documentation guides, README trust-flow
Mermaid diagram and repository map, deployment topology and new-install runbook.
Clarified older video versus redesigned hosted captures and corrected the obsolete
public-hosting/PostgreSQL limitation. Existing application, tests, contracts,
migrations, dependencies, CI and deployment configuration are unchanged.
Locked bootstrap passed;123 relative documentation links resolved, fenced blocks
are balanced, SQLite migration drift check passed and generated contract diff is
empty. Both new Mermaid diagrams rendered successfully with Mermaid11 in Chromium
using temporary tooling outside the repository. Full npm run check exited0:
653 backend tests (221.82s),112 browser tests (5.9m), Ruff/contracts/lint/types/build
passed. npm audit reported0 vulnerabilities. Current PR CI is required before
merge; PostgreSQL acceptance is delegated to the dedicated real-PG CI job, not
claimed from this local SQLite run.
No runtime demo, policy, expense, reset or transfer was performed.


## PF-157 / #157: Home tutorial integration (2026-10-20, Asia/Dhaka)

Wasik's [PR #154](https://github.com/akiibot/proofFi/pull/154) adds the Home
first-run spotlight tour, skip/Escape/completion persistence and account-menu
replay. Integration preserves his commit and merges the current documentation-only
main update. Independent review identified a keyboard focus restoration bug:
the previous focus was captured after the tour had already focused its button.
A regression reproduced that failure; capture now precedes focus movement, with
Account as the fallback when a replay menu item has disappeared.

All six focused browser checks passed, including the new focus restoration and
automatic first-visit/reload tests. The automatic-path test changes only the
isolated browser's automation flag; production behavior is unchanged. `npm run check` exited 0: 653 backend and
118 browser tests, Ruff, generated contracts, lint, types and production build
passed. Both unchanged AT-12 secret-isolation groups passed. Final-head Ubuntu,
Windows and PostgreSQL CI remain merge gates. Local
browser validation uses disposable SQLite/chain fixtures and temporary alternate
ports to preserve running demos; those port changes are excluded from commits.
No financial API, authentication, signing or backend source changes are included.

The owner requested merge and deployment when ready. Rollout acceptance and the
exact deployed revision are tracked in [#157](https://github.com/akiibot/proofFi/issues/157):
existing Vercel project only, exact merged source, live tutorial smoke and read-only
financial/policy/audit preservation comparison. Deployment is pending at this
source record; a passing test fixture is not live financial evidence.

## PF-159 / #159: one-click judge demo contract proposal

Owner requested implementation of passwordless judge entry after approving the
isolated synthetic demo / sending-disabled product flow. Investigation found the
current single-user engine, global audit/certificate reads and environment-derived
verifier settings cannot safely serve public judges as the existing operator.
The concrete [judge-session design](superpowers/specs/2026-10-20-judge-demo-design.md)
proposes immutable per-session SQLite/application scopes, additive authentication,
explicit scoped verifier dependencies and server-side approval/execution refusal.
No runtime, schema, generated contract, operator state or deployed setting changes.
Written-spec/lead contract review is pending; dependent implementation/rollout is
tracked separately in #160 and is not complete. Independent written-spec review found and resolved backend streaming body limits
and cross-tab/BFCache isolation requirements; re-review found no remaining concrete
design blockers. `npm run check` exited 0: 653 backend / 118 browser checks plus
Ruff, contracts, lint, types and production build. Existing runtime tests remain
regression evidence only; they do not prove the proposed guest feature exists.
Temporary local test ports were restored before commit. Generated contracts and
runtime sources are unchanged; no demo output or financial action is invented.

## PF-160 / #160: isolated judge runtime contract (2026-10-20)

The owner approved the written design in chat; the approval is recorded on
[#159](https://github.com/akiibot/vallet/issues/159#issuecomment-6276840862).
Design PR #161 merged after Ubuntu, Windows and PostgreSQL CI passed. That review
covers the design; the runtime authentication/shared-contract change still needs
its own lead review and current CI before merge. Public entry UI and actual
hosted rollout are separately blocked in #162.

The backend adds consent-based `/auth/judge` and server-derived `/auth/access`,
with regenerated OpenAPI/TypeScript. Existing operations and schemas remain
unchanged. Each guest receives a migrated, disposable SQLite database, immutable
application scope, unconfirmed synthetic funded profile, private session namespace
and ephemeral certificate trust. Approval, sending, execution lookup, operational
reset and executor probes are refused before operational handlers. Existing
operator storage, authentication shapes and transaction/certificate encodings are
preserved. `JUDGE_ENABLED` remains false by default; no hosted setting is changed.
See [JUDGE_DEMO.md](JUDGE_DEMO.md) for exact bounds and release requirements.

Focused evidence: 32 tests passed, including real two-guest/operator database and
certificate isolation, explicit policy confirmation, actual SQLite disk-full
rollback, streamed body cap/deadline, global/session budgets and lifecycle races.
Only external planner/RPC inputs are substituted inside isolated tests. Removing
the execution guard caused the denial regression to fail (422 instead of 403);
restoring it passed. Reviewer-identified shutdown/publication and cleanup/lock
races were reproduced and fixed; final backend review found no remaining important
bugs. No operator policy, expense, transfer or live guest session was created.

`npm run check` exited 0: 665 backend tests and all 118 browser tests (7.4m),
Ruff, generated contracts, lint, types and production build passed. The final
32-test focused run covers the additional lifecycle/budget fixes added after the
full backend collection began. Local browsers used temporary alternate ports to
preserve running demos; port edits were restored before commit. Current-head
Ubuntu/Windows/PostgreSQL CI remains required; no local PostgreSQL run is claimed.

## PF-160 integration and PF-162 UI work (2026-10-20)

The owner approved runtime head aaeda1f796d54a04f5a95a4514f3bb2642009df6 in chat:
“Approve implementation and merge after CI”. The record is on
[PR #166](https://github.com/akiibot/vallet/pull/166#issuecomment-6278211158).
Current Ubuntu (667 backend / 118 browser checks), Windows and PostgreSQL CI all
passed. #166 merged at 8184bacdff23aca3632c3de5115bb91e9bc366c5; #162 is now ready.

PF-162 adds the disclosed synthetic Launch flow, server-access gate, scoped client
storage and capability-aware screens. Implementation/acceptance is in progress;
no UI PR, completed acceptance or hosted enablement is claimed yet. Initial launch
UI regression failed before implementation; a real judge now reaches Home and its
fresh tour in the isolated browser fixture. Only the external guest AI provider
is substituted there; the actual application, session registry, databases,
policy/simulation/verifier and existing loopback chain fixture are used.

Backend staged on existing Render Free at approved merge8184bac, deployment
`dep-dbba59navr4c73d3ivd0`, Live1m16s. Actual fixed-profile launch returns503
“Judge demo is not enabled”. Operator snapshots before/after are exactly equal
for state/drafts/history/audit/certificates (v3/audit25/certs3), chainREADY.
No public judge enablement or new live financial mutation. Fresh UI review found
no Critical/Important bugs; one minor disclosure improvement is deferred. Three
focused browser scope tests passed, including delayed real data and metadata
responses across replacement and synchronous overlay hiding. Full UI check pending.

Full UI integration first exposed outdated expiry/style/hydration assertions;
they now check immediate expiry gating, primary Launch styling and absent financial
controls before hydration. A later full run passed123/124browser checks and667
backend checks; the phone flow exposed real120/minute admission exhaustion from
75redundant metadata reads. Diagnostics reproduced auth/access429. The final fix
removes a redundant pre-fetch metadata read while retaining local generation
admission and fresh post-JSON/CSRF and gate checks. All5focused phone/scope/error
journeys then passed1.8m, including delayed real metadata/data and unchanged
operator records. Final full suite is running; no failing head is merged or exposed.

### PF-162 rollout correction, 2026-10-20

UI #170 merged at7fea7da after all three CI jobs passed; live rollout reached
genuine signed judge proof and server403 sending refusal. Operator state/history/
audit/certificates/execution reads remain exactly equal. Hosted guest expense
exposed the10-second proxy budget around a full optimizer recalculation; acceptance
was withheld and judge entry paused. The correction uses the existing35-second
optimizer budget for that route only, retaining10-second approval/execute limits
and unknown-outcome retry locks. Final actual acceptance stays in issue#162.

### PF-172 recorded judge walkthrough

Owner approved instant, explicitly labeled recorded playback with separate Try live. Public /demo displays genuine18October hosted evidence ($2,000 /24 optimizerchecks) and links the original certificate. It makes no backend call, authenticates nobody, and never offers a saved result as current authority. Login adds Watch guided demo while preserving Launch demo for real services.


### PF-174 Simulate integration

Existing Wasik PR #163 is integrated with current main on its original branch.
The Simulate screen calls the existing candidate/simulation APIs and renders
returned futures, risk metrics and stresses. Merge resolution retains scoped
judge-session tour storage and the judge banner. Status copy reports request
state rather than invented backend progress; four-second display pacing is
disclosed. Suggestions and keyboard submission respect saved-rule and busy gates.
No API, trusted assumption or execution changes. Existing verification is running;
final results and merge evidence belong to PR #163 and issue #174.


### PF-175 bounded Flash planner output

The deployed monthly-use suggestion exposed a live intent-parser 503. Both Ask
endpoints use the same provider; Gemini 2.5 Flash previously used its default
thinking budget inside the existing 2,048-token output and 30-second deadline.
An isolated live comparison of the same synthetic prompt returned STOP in 19.45s
with 888 thought tokens by default, versus 1.69s with thinking disabled. This
supports reducing avoidable latency/output-budget pressure; the original 503
remains sanitized and is not proven to have been a specific provider finish reason.

For the supported exact Gemini 2.5 Flash/Flash-Lite model IDs only, the adapter now
sets thinkingBudget=0. Other models, strict schema validation, STOP-only acceptance,
credentials, deadlines, financial assumptions and verifier/execution remain unchanged.
Google documents support for this setting:
https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/thinking
Focused provider/planner/deadline checks: 43 passed; Ruff passed. Full existing
checks, reviewed merge and actual deployed reproduction remain to be recorded in
issue #175 and its single implementation PR. No new CI workflow is added.


### PF-175 owner-directed Gemini 3.8 migration

On 2026-10-20 the owner requested Gemini 3.5 Flash or 3.8 Flash because the
Vertex 2.5 models retire today. Google's lifecycle table confirms the date:
https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions
Both requested models returned validated live proposals with existing credentials
(3.5 MINIMAL: 2.34s; 3.8 LOW: 3.05s). Selected gemini-3.8-flash.
The private adapter uses its supported LOW thinking level, omits deprecated
temperature, and allows 8,192 output tokens within the existing response-byte and
30-second process bounds. No fallback to a retired model or demo planner is added.
The public schemas, trusted risk checks and financial confirmation rules remain
unchanged. The environment example now names the selected model explicitly.
Current CI and hosted configuration/deployment acceptance remain in issue #175.


### PF-178 Simulate rules guidance

The preview's isolated judge demo starts with a saved, unconfirmed draft and empty
token/recipient allowlists. Simulate previously collapsed draft status and missing
allowlist setup into “Save your rules first”. Typed-amount failures now explain the
specific next step: confirm a draft, or add the missing approved test token and/or
known recipient to active rules and confirm the update. No policy values or
financial assumptions are populated by the UI. Live backend reads confirmed the
ordinary preview account retains an active policy with one token and one recipient;
the observed empty setup belongs to fresh isolated judge sessions. No tests run.
