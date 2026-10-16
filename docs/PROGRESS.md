# Progress

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

PR #40 is refreshed from current `main`. The fresh full gate passed with 155 backend tests and 4 real browser/API tests plus lint, typecheck, production build and generated contracts; migration check reported no new operations. Exact-head hosted CI remains required. Merging this guard slice must not close PF-014 or imply PF-029/PF-015 completion.

Lead delegated the interim financial choice: preserve baseline/no invented income, with explicit no-safe-action outcome when checked. Positive hero/emergency demos remain outstanding. TESTNET_SETUP_CHECKLIST.md lists actual public infrastructure values and local secrets needed, including configuration that is intentionally not yet wired.

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
