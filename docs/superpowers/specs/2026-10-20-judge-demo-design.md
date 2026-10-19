# PF-159: passwordless, isolated judge sessions

Status: PROPOSED — owner/lead written-spec and contract review required.
Design issue: #159. Runtime/UI/rollout follow-up: #160 (blocked on this review).
Base inspected: c9110e175a4b12352bcf8e4ac0066d12e6a93825.
This proposal adds no runtime capability or active financial configuration.

## Intent and success

The owner approved a one-click **Launch demo** entry for judges, with disposable
synthetic data, real planning/rules/simulation/verification, the Home tutorial and
transaction sending disabled. Password sign-in retains the existing complete
operator/testnet workflow. A judge must neither observe nor alter operator or
another judge's data. No password is embedded in HTML, JavaScript or URLs.

The current application is deliberately single-user: authentication returns
`demo-user`; `create_app` binds an engine/factory; routers use `request.app.state.engine`;
audit and some certificate reads rely on database isolation rather than tenant
filters. Issuance/workflows also load verifier keys/configuration from the process
environment. A public login against that application would grant its shared
operator authority. Merely changing an actor ID or hiding Send is insufficient.

## Approaches considered

1. **Per-session database and immutable application scope (selected).** Retain
   existing single-user engine semantics inside each judge sandbox, selected by
   an authenticated opaque token. Reuse real engines without adding tenant filters
   to every financial table. Requires explicit guest runtime/key dependencies.
2. **Many users in the operator PostgreSQL store.** Requires a separate tenancy,
   row ownership and audit contract plus changes to currently global reads. This
   is substantially broader and creates avoidable cross-account exposure.
3. **Public password or public session for the existing account.** Small UI change,
   but exposes shared records and existing execution authority. Does not meet the
   accepted isolation/sending requirements.

## Entry and visible behavior

Keep `/login` public, adding a primary Launch demo action and secondary operator
password form. Explain before the button that the sandbox uses the published
synthetic funded profile, lasts 30 minutes, has no automatic policy confirmation
and cannot approve or send a transaction. A details disclosure lists the exact
profile assumptions; clicking the clearly labelled button explicitly selects that
profile. No extra consent screen or prefilled secret is needed.

Success opens Home and requests the existing tour even when this browser previously
finished the operator tour. A persistent Judge demo / Sending disabled indicator
and accessible explanation replace approval/send controls. Rules, planning,
simulation, genuine verifier evidence and guest audit remain usable. Missing live
provider/RPC/configuration returns actual unavailable/error states; no fake live
output, receipt, tx hash or success card is substituted.

Keep explicit policy confirmation: no confirmed Constitution is seeded. Home can
teach navigation and direct judges to Rules. A deliberate guest confirmation or
expense affects only that guest's synthetic database. Security's existing executor
probe and operational reset stay operator-only; explain their unavailability in
judge mode. Original A/B/C workflows remain intact behind operator login.

Launching a judge session replaces this browser's current authentication session,
just as the existing login does. Operator re-entry requires the password. There
is never an implicit fallback from an expired judge session to an older operator
session. The entry page states this session-switch behavior.

## Additive authentication contract

Existing routes, operation identities, SessionInfo, cookie attributes, financial
models, canonical signed payload and transaction encoding remain unchanged.
The existing opaque `prooffi_session` cookie identifies one server-side scope;
its value contains no role, engine path or financial state.

| New operation | Request | Response / authority |
| --- | --- | --- |
| `POST /auth/judge` (`start_judge_session`) | `JudgeStartRequest`: fixed allowlisted `profile_id`, strict boolean `accept_synthetic_assumptions=true`; extra fields forbidden | `JudgeSessionInfo`: existing CSRF/expiry fields plus `mode=judge`, `execution_enabled=false`, profile ID/digest and non-secret scope ID. Sets fresh opaque cookie. |
| `GET /auth/access` (`session_access`) | Valid cookie | `SessionAccess`: `mode=operator|judge`, exact server-derived capabilities, expiry, optional judge profile ID/digest and scope ID. No credential or private key. |

`JudgeStartRequest.profile_id` is the literal `synthetic-funded-demo-v1`;
`accept_synthetic_assumptions` must be JSON boolean true (not 1). Response expiry
is an aware UTC datetime; profile digest is the existing lowercase SHA-256 Digest.
Capabilities are a unique list drawn from `read`, `rules`, `plan`, `simulate`,
`verify`, `expense`, `approve`, `execute`, `attack`, `reset`. Judge authorization is
exactly the first six. Operator authorization preserves existing permissions;
operational readiness flags and real service errors still apply separately.
`scope_id` is a server-generated opaque public Identifier for a guest cache
namespace; it is distinct from the secret session token and cannot select storage
or grant access. Operator responses do not expose an engine/scope locator.
The new endpoints accept/return only canonical Pydantic contracts with extra fields
forbidden, never private runtime settings or an engine location.

Use existing ApiError codes: 401 for missing/expired/revoked session, 403 for guest
capability denial or bad Origin/CSRF, 422 for invalid input, 429 for capacity/budget,
503 for unavailable configuration/provisioning. Session creation requires the exact
trusted Origin; all subsequent writes retain matching CSRF and existing cookie
Secure/HttpOnly/SameSite=Strict/path behavior. Do not trust request headers, role
fields, URLs, cookies with role text, profile overrides or query parameters as
capability or database authority.

Existing `/auth/session` and `/auth/logout` work for the selected mode. Password
login remains the existing operator operation and revokes the replaced guest only
after successful operator authentication. Failed operator login grants no new
scope. Guest logout/replacement/expiry revokes its token and schedules cleanup.
If access metadata cannot be loaded, the UI shows unavailable and grants no
approval/send controls; it must not assume operator mode.
Token generation checks both namespaces; only hashed tokens are retained server-side.

Regenerate canonical OpenAPI and TypeScript with the runtime contract PR; do not
hand-edit them. This design-only PR intentionally has no generated schema delta.

## Database and request isolation

A bounded server registry maps token digests to a judge scope. Each scope owns one
random, server-created temporary SQLite database migrated through the current
reviewed SQLite migration chain, and one application instance with fixed engine,
session factory, authentication and capability bindings. The existing single-user
`demo-user` and artifact formats may repeat across separate databases.

A dispatcher validates the cookie namespace before routing into that scope.
It must never mutate a shared `app.state.engine`, global factory or environment
variable per request. The child scope is fixed for the admitted request and all
its background/threadpool work. The operator app retains its existing PostgreSQL
engine, auth and routes. Unknown/expired guest identities cannot select operator
storage. Paths and client-supplied IDs never choose a database file.

All existing reads and writes, including audit/certificate lookups and workflow
side effects, must run against the selected scope. No operator DB clone, record
export, certificate, audit history or wallet key is copied into a judge database.
The public proxy keeps its exact route allowlist and forwards only the existing
opaque session cookie and approved Origin/CSRF headers. It never gains an internal
operator token or arbitrary upstream target.

## Browser state isolation

The UI currently retains last-safe amounts, goal text, execution evidence and
approval/execution request identities in sessionStorage. Server-side isolation
alone does not prevent stale UI data appearing after a same-tab mode switch.
Resolve authenticated access metadata before starting financial data hooks or
reading remembered values. On successful Launch/login/logout, unmount the old
application, discard in-memory request/CSRF/data caches and perform a full-page
navigation; stale asynchronous responses must not populate the new scope.

Keep existing operator recovery keys intact and accessible only to operator UI.
Guest caches use a namespace tied to the non-secret server-issued scope ID; never
read or write operator keys in guest mode. A fresh guest scope cannot reuse a
prior guest's display or pending-request cache. Cleanup on exit/expiry removes
only that guest's client cache, without discarding operator unknown-outcome IDs.
Cookies change across tabs, so same-tab teardown alone is insufficient. Publish
a non-sensitive cross-tab authentication-change notification before switching,
then invalidate financial content in every listening tab. Notifications may only
invalidate/revalidate; they never carry tokens or grant a scope. Revalidate
`/auth/access` on focus/visibility activation and on `pageshow`, including persisted
BFCache restores. Hide financial content on `pagehide`/hidden transitions so a
restored old DOM cannot briefly expose a prior scope; retain an unavailable/loading
gate until fresh no-store access metadata matches. Block stale async responses
and actions throughout that transition. A browser without cross-tab notification
support must fail closed for concurrent scope switching rather than silently
promise isolation. Existing operator recovery IDs remain preserved.
The tour is explicitly requested for each fresh guest and may retain its existing
non-sensitive browser preference. This is application/session separation, not a
claim to protect data from a compromised browser profile or same-origin script.

## Real services and capability boundary

Introduce an immutable server-side runtime/capability context. The operator uses
its current defaults. Guest route construction registers only approved sandbox
operations. Guest `/approvals`, `/execute`, `/executions/{id}`, `/demo/attack` and
`/demo/reset` return 403 FORBIDDEN before any operational-policy, claim, signer,
dispatch, reconciliation or operator-record lookup. Unknown routes retain explicit
NOT_IMPLEMENTED. Direct HTTP calls, forged IDs and unknown-outcome retries do not
relax these denials. UI disabling is explanatory, not the enforcement mechanism.

Planner still returns untrusted candidates and imports no approval/verifier/
execution code. Real policy, simulation and optimizer algorithms are reused.
Workflow preparation still calls the independent verifier. To avoid the current
environment-key fallback, issuance, workflow integrity checks and certificate
verification receive explicit scoped settings/public-key maps in judge mode.
Required guest values missing means unavailable, never operator fallback.

Each judge scope generates an ephemeral Ed25519 **certificate** key and distinct
key ID. It is never added to the operator trust map. Guest certificates use the
unchanged canonical payload/encoding and cannot authorize the operator executor.
No EVM transaction key is generated, accepted or passed into the guest runtime.
Read-only chain observations may use the existing public chain/token/recipient/
wallet settings; they confer no sending permission and must be labelled testnet.
Do not replace real RPC observations with the browser test-chain fixture.

The existing live planner provider may be used only through a bounded server-side
adapter with no EVM signer capability. No key is sent to the frontend or prompt;
operator provider configuration cannot be modified by judges. No automatic goal
submission, live request on page load, background keepalive or invented fallback.

## Synthetic profile and consent

Use the exact checked-in `docs/funded-demo-config.json` profile and its canonical
config digest `69f1faf7aed9c279e88745675bfbc807f6d3d1528284e0a79c3d8cd88739acbb`.
The button discloses $17,000 synthetic cash, no income, unchanged obligations,
1,000 paths/120 days, seed 18421, illustrative 2% daily volatility, 20% probability
of an additional $2,000 emergency and a $1 synthetic planning fee. Explain that
these are demonstration inputs, not calibrated probabilities or actual assets.

The explicit Launch action calls the existing create-only funded provisioning
service on a NEW empty judge database. Preserve immutable baseline v1, append
funded v2 and keep the Constitution unconfirmed. No public trusted-config input,
financial probability editing or operator provisioning is added. Restart or
profile mismatch must not fall back to provisioning operator storage.

## Lifecycle and public resource budget

Judge access is default-off until reviewed deployment enablement. Fixed defaults:
30-minute non-sliding expiry, at most eight live scopes, three session starts per
minute globally, 120 requests/minute per guest and 240/minute across guests, at
most two concurrent expensive guest computations. Use an independently enforced
limit of three live planner calls per guest and 18 total guest planner calls per
hour. Resource exhaustion returns 429 without affecting operator login budgets.
These engineering ceilings are not financial assumptions. Public capacity limits
bound resource use but do not guarantee availability against deliberate abuse.
Guest and operator work share host CPU; actual rollout must check operator latency
under the bounded guest workload before enabling the public entry.

Cap each database at 16 MiB and aggregate guest disk use at 128 MiB; account for
SQLite side files. Enforce a 65,536-byte request-body limit in the backend dispatcher
before full buffering, Pydantic parsing, provisioning or expensive-work admission,
for `/auth/judge` and all guest operations. Count actual streamed bytes regardless
of missing/forged Content-Length or chunked transfer. Reject overflow immediately
with 413 ApiError/VALIDATION_ERROR and no echoed input. The public Render endpoint
must enforce this independently of Vercel's existing proxy check; Origin is a
browser CSRF control and is not a defense against direct HTTP clients. Reserve
capacity before migrations/provisioning; failed creation cleans only its own
unpublished scope. Server restart invalidates all guest sessions and removes
orphan guest files safely inside the dedicated directory. An expired scope stops
new admission immediately; a reference-counted lease keeps files alive only until
already admitted bounded operations release them, then closes engines/deletes
that scope. No live database is deleted while a worker owns a lease.

Live provider/RPC calls retain current bounded deadlines; cancellation or request
loss never creates an approval, sign, send or financial operator retry. On expiry,
the UI returns to entry with an honest expired-demo message and a fresh-start
option. An explicit fresh launch creates a new scope, never resets shared state.

## Verification and rollout acceptance

Required focused regressions, using real DB/crypto/engines and isolated external
service substitutes only in tests:

- Two simultaneous judges plus operator: distinct state/config/policy/audit/
  certificate visibility; guessed IDs, concurrent confirm/expense/workflow and
  repeated IDs cannot cross scopes. Existing global reads are exercised directly.
- Guest tokens fail in operator scope; operator tokens do not become guest tokens;
  invalid/expired/revoked tokens fail closed. Preserve current login/CSRF/session
  tests and exact cookie/Origin behavior. Failed login does not switch authority.
- With valid request-shaped financial inputs and execution globally enabled for
  operator, all guest approval/execute/recovery/probe paths deny. Instrument real
  signer/dispatch boundaries in isolated tests to prove zero invocations and no
  operator table changes; removing the capability guard must fail regression.
- Prove no guest key lookup calls the operator environment fallback and guest
  certificates fail operator trust. Preserve all original signed encodings.
- Genuine profile creation, explicit Launch consent and separate explicit policy
  confirmation. Missing provider/RPC remains unavailable; no mocked feature UI.
- Direct-backend oversized and chunked requests, including absent/incorrect
  Content-Length, reject before provisioning/provider/simulation admission and
  keep retained body bytes bounded. Proxy-only protection is insufficient.
- Capacity/start/planner budgets, creation races, lease expiry, cancellation,
  restart orphan cleanup and disk-limit failures preserve operator data.
- Seed browser storage with operator goal/last-safe/evidence and unresolved
  request identities; switch to two fresh guest scopes in the same tab. Neither
  guest may display/read those operator values or the other guest's cached data.
  Returning to authenticated operator mode preserves its exact recovery identity.
  Slow responses and stale CSRF caches cannot cross a scope change. Also launch
  from a second tab while an operator tab is open, then activate that tab and
  exercise Back/BFCache restoration; previous financial content stays gated until
  current scope is revalidated. Test notification-unavailable failure behavior.
- Browser: Launch, disclosure, Home tour, Rules confirmation, actual planning/
  simulation/verification, disabled sending, isolated expense, expiry, restart,
  return to operator login; desktop/phone/keyboard and no leaked private values.

Run focused tests and `npm run check`, generated contract/migration drift checks,
and current Ubuntu/Windows/PostgreSQL CI before any merge. Review contract/runtime
changes separately from dependent product UI integration; the latter cannot merge
before its approved prerequisite. No new operator/schema migration is required by
the selected isolation model; any discovery that changes that requires a new
lead-reviewed contract proposal.

Deploy only after the runtime contract and dependent UI have been reviewed and
merged. Preserve Vercel/Render/Supabase identities, free tiers, operator settings,
original local A/B/C artifacts and the live financial store. Enable judge mode
explicitly after backup/read-only snapshots. Verify two actual isolated browser
sessions against the real hosted backend, actual errors and genuine crypto; prove
zero EVM signing/sending and exact operator records before/after. Default flag off
is rollback: revoke/clean judge scopes, preserve operator data and prior frontend.
Do not claim release completion or close #160 on a design or simulated receipt.

## Review decision requested

Approve the additive session/access contract, per-session SQLite/application
isolation, explicit scoped verifier runtime, public resource limits and the
separate operator-only execution boundary. This approves a concrete design, not
a transfer, policy activation, runtime enablement or deployed implementation.
