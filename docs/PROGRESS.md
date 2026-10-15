# Progress

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

Developed on codex/pf-030-testnet-adapter, stacked after PF-012. Added concrete offline EIP-1559 signing and exact signed-transaction RPC transport, testnet/token/recipient/wallet/fee gates, explicit ambiguous broadcast handling without retries, and normalized pending/revert/confirmation/reorg receipt handling. Public execution remains disabled. Read-only Base Sepolia eth_chainId probe returned HTTP 200 / 84532; no broadcast. See TESTNET_ADAPTER.md. Shared models, migrations and OpenAPI unchanged.

Lead-work PRs: PF-012 https://github.com/akiibot/proofFi/pull/35 (hosted CI passed); PF-030 https://github.com/akiibot/proofFi/pull/36 (local full validation passed; hosted CI tracked on PR). Both remain unmerged and do not clear integration dependency labels.

## PF-033 lead implementation

On codex/pf-033-authenticated-sessions, stacked after the prior lead work. Added password provisioning/hash verification, opaque cookie sessions, explicit authenticated actor, expiry/revocation, Origin/CSRF validation, login/mutation rate limits, public HTTPS/Secure-cookie configuration checks, typed login/status/logout routes and real browser login/logout integration. Prototype service bearer is no longer accepted as user identity. No financial schema or migration change. The new HTTP v1.1 contract is for lead review in its separate contract-change PR. Browser tracing disabled to prevent credential/session leakage in traces.

Initial auth tests reproduced missing routes. Security regression identified non-ASCII header comparison causing TypeError; byte comparison now rejects it safely. Exact validation evidence is recorded in TEST_RESULTS.md. No policy activation, financial approval or execution is implied by login.

PF-033 PR: https://github.com/akiibot/proofFi/pull/37 (`contract-change`, stacked after #36). Clean-checkout bootstrap/full verification passed: 89 backend tests, 4 real browser/API tests. Authentication contract remains pending lead review/merge; financial model contracts unchanged.

## PF-013 bound human approvals

On codex/pf-013-bound-human-approvals, stacked after PF-033. Implemented the existing POST /approvals route with server-derived actor and persisted session-fingerprint audit binding. Real signature/hash/freshness/policy checks run inside serialized trusted-write transactions. Exactly one final approve-or-deny record per certificate; denials cannot be overwritten. Approval and hash-linked audit event commit/rollback together. No certificate issuance, signing, or execution was enabled. Shared financial/API models and migrations unchanged; a small auth implementation addition exposes the authenticated session fingerprint to trusted handlers, without exposing raw cookies.
