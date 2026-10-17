# Progress

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

`/constitution` edits rules in plain units (USD, percent, one address per line), converts them exactly to cents/basis points/lowercase addresses, and saves only a draft (`POST /constitutions/drafts` with `base_version` = the active version). A review step shows every rule before/after against the active version and the SHA-256 policy fingerprint of the exact draft rules, computed in the browser with ProofFi canonical JSON v1 (`src/lib/canonical.ts`, byte-for-byte equal to `app/core/canonical.py` on reference inputs). Activation needs a separate checkbox and button and sends that fingerprint as `expected_policy_digest`; `STALE_POLICY` reloads the current version and asks for a new draft. Active version, fixed rules and immutable history are shown. Saving never activates.

Browser tests now run on a fresh, separately seeded `.local/e2e.db` (`apps/web/e2e/server.mjs`, `playwright.config.ts`): read-only checks first, then `*.journey.spec.ts`, one worker. This keeps writing journeys out of the developer database and stops them breaking the foundation check that expects no active Constitution. Needs lead review because it changes shared test configuration.

Validation: full browser suite 27 passed (PF-019: 6 journeys against the real backend including a concurrent-activation STALE_POLICY case, 5 unit checks for units, canonical digest, form round-trip and diff); lint and typecheck pass.

## PF-021 Time Machine (ready for review)

`/time-machine` builds a manual candidate (amount, token, recipient; prefilled from the active Constitution) and calls the real `POST /simulate`. It shows the SimulationRun exactly: goal-satisfaction and reserve-breach probabilities next to the active Constitution's thresholds (comparison only, labelled as not verification), 5th-percentile and expected terminal liquidity, every sampled liquidity path as an SVG chart with a $0 line, all four named stresses with their parameters, and the full config (model, paths, horizon, seed, probabilities, fee, assumptions, config and state fingerprints). Copy states that it is seeded scenario arithmetic, not a prediction. Backend refusals (no Constitution, no selected config) show the backend's own reason and a next step.

The seed selects no simulation config by design (D12), so `/simulate` refuses to run in the normal dev database. To test real engine output, `e2e/server.mjs` adds one config labelled "E2E TEST FIXTURE … not an approved financial assumption" to the throwaway `.local/e2e.db` only (`e2e/seed_e2e_simulation_config.py`, which refuses any other database), as the backend's own PF-009 tests do. Needs lead review.

Validation: browser suite 34 passed (PF-021: 3 journeys on real engine output incl. determinism and phone width; real "Constitution required" refusal on the fresh seed; client-side validation; chart geometry and candidate unit checks). Ruff, lint and typecheck pass.
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
