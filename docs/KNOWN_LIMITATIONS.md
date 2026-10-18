# Known limitations

Current MVP: single local user/wallet, Base Sepolia and synthetic planning balances.
The original baseline is $200 short; the positive scenario requires the explicitly
selected synthetic funded alternative. Risk inputs are hypothetical, seeded and
reproducible, not calibrated forecasts. Four named stresses remain mandatory.

The controlled red-team proposal demonstrates rejection of a deliberately unsafe
candidate; it does not establish general prompt-injection success or immunity.
The backend and signer remain trusted local software. No on-chain policy guard or
production custody is claimed. Hash-linked audit cannot resist an administrator
rewriting the database. Sessions are in one API process; restart revokes them.

Reset restores only recorded funded state before any execution history, preserves
policy/history, and refuses after any claim/dispatch, including confirmed/failed.
Use a new create-only stage then. Unsupported changed-asset/lost-handoff recovery
refuses and retains evidence; advanced automation is deferred explicitly to #99.
No preserved genuine demo has been reset. Prior financial approvals are consumed.

Genuine A/B/C evidence is separate from public loopback CI chain fixtures. The raw
current tour inspects copies of the actual A/C databases and reconciles an existing
confirmed claim with actual read-only RPC; it creates no new financial effect.
Certificates expire after five minutes; expired proof does not erase historical
confirmed execution. New actions require fresh independent checks and exact consent.

Historical development login/hydration observations remain tracked in #60. Scoped
startup and acknowledgement fixes have measured proof; passing latest Ubuntu and
Windows acceptance does not establish universal repair of earlier observations.
Public hosting, PostgreSQL, multiple users/wallets/chains and mainnet are out of scope.

## Historical foundation snapshot

The following records early foundation limitations and is not current MVP status.

Historical foundation snapshot below. Current status: foundation #34 is merged, both teammates have write access and issues are assigned. The owner waived teammate/CODEOWNER approval on 2026-10-16; required PRs, strict current CI, actual dependencies and lead acceptance of sensitive/shared changes remain. Use TASKS.md and the current policy in CONTRIBUTING.md for ongoing work.

The foundation is locally functional but the product is incomplete. All AT-01..AT-12 product gates remain unpassed. Feature endpoints return NOT_IMPLEMENTED; the dashboard makes this explicit. No signed certificate, risk metric, approval or transaction is simulated as completed.

The lead approved the architecture; pending another developer review and protected merge, feature issues stay blocked. Farid (@Alfa5nm) and Wasik (@WasikZubair) have verified write-access invitations; invitation acceptance and actual issue assignment remain pending. Branch protection status is recorded in PROGRESS.md, not assumed.

No active Constitution, test token, approved destination, funded wallet, RPC adapter or AI provider exists. Keys remain unset. No genuine chain evidence exists. Baseline has no expected income and a $200 shortfall before fees/shocks; meaningful positive Scenario A and reduced Scenario C require explicit assumption selection.

PF-033 implements demo sessions, CSRF/origin enforcement, rate limiting and explicit mutation forwarding in its separate API v1.1 contract-change PR. The approved financial schemas are unchanged. Session storage supports one API process; restarts revoke sessions. Public-mode settings require HTTPS origins and Secure cookies, with TLS hosting still to be configured. A login session does not constitute financial approval. PostgreSQL has not been tested. Audit storage is not immutable against an administrator; a hash chain is future PF-016 work.

Current immutable records rely on controlled repository writes and digest checking, not database triggers prohibiting administrator edits. Execution uniqueness is schema scaffolding; independent gates, atomic lifecycle/reconciliation and no-double-sign proofs are future PF-014/015.
