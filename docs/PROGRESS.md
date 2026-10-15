# Progress

## Current review policy

On 2026-10-16 (Asia/Dhaka), the repository owner instructed: "you dont need team mate approvals from now on" and "But make sure not to break anything". Teammate approval is waived for subsequent PRs. This supersedes the earlier #34-only waiver. PRs, passing current CI, dependency checks, lead review of sensitive/shared changes, separate contract-change PRs, and honest local test evidence remain required. This waiver is not a financial approval, policy activation, or architecture change.

## Current authoritative checkpoint

Foundation PR #34 merged into main at `9c49ef4815023c746b3c18556fe5963918731f2b`, including Farid’s reviewed #42 fixes. Issues #1–#5 are closed. The initial #34-only waiver is superseded by the 2026-10-16 owner waiver above. Teammate/CODEOWNER approval is optional; strict foundation CI, required PRs, lead review of sensitive/shared changes and admin enforcement remain. Both teammates have accepted write access and issues are assigned; #26 is shared by all three.

Open PRs #35–#41 and #43 have recorded passing hosted CI but no teammate approvals. They are branch implementations, not delivered features. The previous integrated branch check was 184 backend / 4 browser tests. Current revalidation failed: 184 backend tests passed but browser tests had 3 passed / 1 failed on the PF-033 login redirect assertion. Its root cause remains unresolved; no new main or full-product acceptance claim follows. Session/CSRF auth must survive integration. #40 is only execution claim guards. Trusted issuance #29 remains blocked on #7/#9/#12; real execution additionally lacks provisioned testnet infrastructure. The original $200 shortfall remains, and no income/probability assumptions are activated.

#44 fresh `npm run check` passed 25 backend / 2 browser tests and migration drift check passed (see TEST_RESULTS.md). It is refreshed from main for documentation review: central checklist, README link and current backlog/progress/evidence records only. Foundation dependencies are satisfied for #8/#12/#17/#30/#33; #17 is ready for Farid, and existing implementations should be reviewed rather than duplicated. #18 still depends on #33. No dependent issue is closed merely because code exists on a branch.

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
