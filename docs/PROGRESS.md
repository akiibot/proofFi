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
