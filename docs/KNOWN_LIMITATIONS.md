# Known limitations

Historical foundation snapshot below. Current status: foundation #34 is merged, both teammates have write access and issues are assigned. The owner waived teammate/CODEOWNER approval on 2026-10-16; required PRs, strict current CI, actual dependencies and lead acceptance of sensitive/shared changes remain. Use TASKS.md and the current policy in CONTRIBUTING.md for ongoing work.

The foundation is locally functional but the product is incomplete. All AT-01..AT-12 product gates remain unpassed. Feature endpoints return NOT_IMPLEMENTED; the dashboard makes this explicit. No signed certificate, risk metric, approval or transaction is simulated as completed.

The lead approved the architecture; pending another developer review and protected merge, feature issues stay blocked. Farid (@Alfa5nm) and Wasik (@WasikZubair) have verified write-access invitations; invitation acceptance and actual issue assignment remain pending. Branch protection status is recorded in PROGRESS.md, not assumed.

No active Constitution, test token, approved destination, funded wallet, RPC adapter or AI provider exists. Keys remain unset. No genuine chain evidence exists. Baseline has no expected income and a $200 shortfall before fees/shocks; meaningful positive Scenario A and reduced Scenario C require explicit assumption selection.

PF-033 implements demo sessions, CSRF/origin enforcement, rate limiting and explicit mutation forwarding in its separate API v1.1 contract-change PR. The approved financial schemas are unchanged. Session storage supports one API process; restarts revoke sessions. Public-mode settings require HTTPS origins and Secure cookies, with TLS hosting still to be configured. A login session does not constitute financial approval. PostgreSQL has not been tested. Audit storage is not immutable against an administrator; a hash chain is future PF-016 work.

Current immutable records rely on controlled repository writes and digest checking, not database triggers prohibiting administrator edits. Execution uniqueness is schema scaffolding; independent gates, atomic lifecycle/reconciliation and no-double-sign proofs are future PF-014/015.
