# Judge sandbox runtime (PF-160)

The owner approved the written PF-159 design in chat on 2026-10-20; record:
https://github.com/akiibot/vallet/issues/159#issuecomment-6276840862.
The design merged via #161 after current Ubuntu/Windows/PostgreSQL CI passed.
Runtime implementation requires its own lead review and passing current CI.

## Runtime contract

`POST /auth/judge` accepts exactly `profile_id=synthetic-funded-demo-v1` and JSON
boolean `accept_synthetic_assumptions=true`. It requires the exact trusted Origin;
there is no password in the public entry. `JUDGE_ENABLED` defaults false. Disabled
entry returns UNAVAILABLE. All errors use existing ApiError codes and do not echo
request bodies, paths, keys, SQL or provider responses.

The exact existing profile digest is
`69f1faf7aed9c279e88745675bfbc807f6d3d1528284e0a79c3d8cd88739acbb`.
It provisions only a NEW migrated SQLite database, retains baseline v1, appends
funded v2 and leaves the Constitution unconfirmed. Public input cannot alter
financial or simulation assumptions. A later explicit Rules confirmation is a
separate operation. No stored operator data or financial history is copied.

The opaque `prooffi_session` cookie retains Secure/HttpOnly/SameSite=Strict/path
behavior and existing CSRF requirements. Successful Launch revokes the browser's
old operator/guest session only after publishing the new scope. Failed creation
preserves old authority. Successful operator login similarly retires the prior
guest. `/auth/access` reports server-derived mode/capabilities/expiry and a guest
cache scope ID; that non-secret ID grants no authority and is never a DB selector.
Existing `/auth/session` and `/auth/logout` keep their shapes/operation IDs.

## Isolation and refusal

A registry maps only token digests to fixed child applications. Each child owns a
separate migrated database and private authentication namespace. Every financial
read/write, including global audit/certificate reads, stays in that database.
No per-request mutation of shared app engine, session factory or process environment
is used. Guest tokens have no root/operator authentication record.

Guest paths for approval, execution, execution lookup, controlled executor probe
and operational reset return FORBIDDEN before operational policy/signing/dispatch/
reconciliation. The child authentication boundary independently checks the same
allowlist. Unknown guest routes return NOT_IMPLEMENTED. UI changes cannot grant
these capabilities; PF-162 adds explanatory controls after reviewed runtime merge.

Guest verifier keys are generated ephemeral Ed25519 certificate keys, never EVM
transaction keys. Their public keys are absent from operator trust. Scoped keyrings
reach issuance, workflow evidence checks and certificate verification; missing
judge configuration returns unavailable instead of operator fallback. Public chain
configuration is snapshotted and passed to allowed read-only operations. Live
planner calls are bounded and use an allowlisted subprocess environment containing
no signer/verifier/password/database secret. External provider/RPC failure is
reported honestly; production has no simulated-chain or fake live-provider fallback.

## Resource lifecycle

- Thirty-minute non-sliding sessions, eight live scope slots, three scope starts
  per minute globally; operator login/session budgets remain independent.
- 120 guest requests/minute/session and 240/minute globally; two concurrent body
  readers/expensive operations. Public entry has its own 240/minute admission cap.
- Three live provider calls per guest and 18/hour globally. Replacing/logging out
  a session does not reset global provider/start histories.
- Direct backend streamed bodies are limited to 65,536 bytes and ten seconds total,
  independently of Vercel and Content-Length. Oversize returns 413; timeout returns
  408. Admission precedes guest body reads, and completion/timeout releases leases.
- Dedicated `JUDGE_DIRECTORY` defaults `.local/judge-sessions`. A cross-process
  lock prevents a rolling process from deleting an active owner's databases. A
  restart can remove only orphan `judge-*` directories under its owned private root.
- SQLite uses 4KiB pages, a 1,856-page main-file ceiling, DELETE journaling and
  memory-only temp tables. Main plus rollback files stay below 16MiB per scope;
  eight scopes reserve below 128MiB aggregate. No operator migration changes.
- A request lease outlives cancellation/expiry/logout until admitted work releases
  it. Revoked/expired scopes accept no new work; a periodic sweep retires engines/
  files once no lease remains. Shutdown prevents publication of in-flight creations.

The public limits bound resource exposure; they do not promise availability against
hostile clients or isolate CPU as a separate machine would. Live enablement must
verify operator latency under bounded guest load. Operator credentials must stay
private; do not prefill or publish them to achieve public access.

## Release boundary

This backend PR does not implement the public button/browser scope gate or enable
judge access on the deployed site. PF-162 owns those dependent changes and actual
hosted acceptance. Keep the flag disabled until reviewed merge, current CI, actual
two-judge isolation, genuine read-only/operator preservation checks, key isolation
and sending refusal have been verified on the deployed build. No new transfer,
policy activation, fee assumption or paid service is authorized by this document.

Rollback disables judge entry, revokes/cleans guest scopes after their active leases
complete and restores the previous frontend. Never reset operator storage, remove
unknown-outcome recovery IDs or replace its credentials/configuration.

## Browser consumer (PF-162)

The UI reads `/auth/access` before mounting financial hooks. It hides financial
content and body portals synchronously on blur/pagehide/hidden transitions, then
revalidates on focus/pageshow/visibility. Cross-tab signals can only invalidate;
missing both notification transports withholds access. Generation-bound metadata,
parsed financial responses and CSRF checks prevent old replies from entering a
replacement scope. A guest request queue respects the two-reader backend limit;
operator concurrency is unchanged.

Judge cache keys use `vallet.judge.<server_scope_id>.<original_key>` for safe amounts,
asks, execution observations, retained requests/decisions and tour completion.
Operator names are unchanged, preserving unknown-outcome recovery. Departure
removes only the prior guest namespace. An unavailable session stays gated with
retry/login controls; a revoked cookie returns to the entry page. The session
expiry timer also invalidates the view.

The isolated browser helper replaces only the external guest proposal provider.
It retains actual auth/registry/databases/rules/simulation/certificate crypto and
uses the existing loopback chain fixture. Those tests do not establish live AI,
real-chain dispatch or hosted acceptance. Production has no import of that helper.
