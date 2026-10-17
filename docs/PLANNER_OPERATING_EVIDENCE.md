# PF-038 current-host planner observations

Issue #72 records a prior provider response timeout without an HTTP status.
That failure remains valid historical evidence; it does not establish key rejection.

On 2026-10-17 local time, three consecutive direct calls through the unchanged
production `vertex_proposal` adapter with synthetic tuition-planning context
returned canonical private Proposal models. Timings and safe counts are in
`evidence/planner-current-host.json`. The context contained an explicitly
unconfirmed policy, no expected income, and synthetic amounts; it was not a
runtime state, confirmed policy, approved risk configuration or investment advice.
No database, certificate, signer or chain path was invoked. No response text,
prompt, credential, account identifier or raw error diagnostics are retained.

Measured total times were 9.18, 1.86 and 1.97 seconds. The adapter's existing
HTTPSConnection timeout remains eight seconds per socket operation, not an
end-to-end deadline covering DNS, connection, TLS, HTTP and response reads.
Therefore the 9.18-second result does not mean the socket bound was increased.
Production source and fallback behavior are unchanged. No retry policy was added;
these were three explicitly separate diagnostic calls.

An earlier minimal-context direct call also validated in 1.54 seconds; it is
not included in the three like-for-like context measurements. Instrumented calls
that failed before making a network request were excluded from provider evidence.

These observations establish working inference at the recorded time, not a causal
repair or guaranteed availability. The prior latency failure is not reproduced
by these direct calls. Keep PF-038 open for lead review of intermittent latency
and the desired total request budget. An end-to-end deadline or generation-budget
change would require a separate scoped implementation with deterministic tests;
this report neither raises timeouts nor changes model settings to obtain success.

Focused planner regression: test_pf_017.py, 29 passed. Full repository validation
is recorded in PROGRESS.md after completion. Earlier author success and the
independent timeout remain distinct observations. Credentials remain ignored,
backend-only and require private rotation if previously exposed in chat.


## PF-038 request-wide deadline implementation

A later phase diagnostic reproduced the old failure: TLS/connect completed in
0.154 seconds, followed by a header-read timeout at 8.005 seconds. A separate
30-second diagnostic returned HTTP 200 with canonical validation. These are
separate requests, not a controlled claim about identical provider workload.

The adapter now runs provider work in one disposable Python subprocess under a
30-second subprocess deadline. This engineering budget accommodates observed
13-second successful replies while remaining bounded; it is not a guarantee of
provider availability. The budget covers worker initialization, OAuth lookup,
DNS/TLS, request/response reads and JSON validation after OS process creation.
OS process startup and termination/reaping add small platform-dependent overhead.
Timeout kills and reaps the worker; partial output is never accepted and no retry
or fallback is performed. A blocked DNS resolver cannot leave a background thread
continuing to consume work after a request timeout.

The child keeps the existing 20-second OAuth bound and now uses a 30-second socket
bound inside the request-wide limit. Request input, provider response and worker
output are capped at 64 KiB. The fixed Python module is launched with the backend
module directory on its private PYTHONPATH. Settings/credential and minimal goal
context travel through private stdin, never command-line arguments. Only validated
Proposal JSON returns through captured stdout; errors emit no child traceback or
provider body. The parent validates the Proposal again. Public models, explicit
provider/model selection and lack of signing authority remain unchanged.

Two genuine calls through the new worker boundary validated in 12.826 and 2.185
seconds, using synthetic context and an unconfirmed policy. Safe evidence is in
evidence/planner-request-deadline.json. No database, certificate or transaction
was created. This addresses the reproduced eight-second operating limit and adds
a cancellation boundary; it does not promise every future provider call succeeds.
Review and current CI remain required before issue closure.


The existing web proxy has a separate ten-second deadline. A companion shared
router change must allow 35 seconds for intent/parse and plans/generate only;
otherwise a legitimate slower provider reply can still be cut off by the proxy.
Other endpoint budgets remain ten seconds. PF-038 closes only after both reviewed
changes merge and the proxy regression/current CI pass.


## Planner proxy companion validation

The shared proxy companion applies 35 seconds only to intent/parse and
plans/generate, leaving all other route budgets at ten seconds. A regression
through the actual proxy handler with an isolated upstream delayed eleven seconds
failed on both planner routes before the change (HTTP503); both passed afterward
(HTTP200). The ordinary read/execute budget test passed before and after. These
are transport fixture tests, not fabricated live provider evidence.

A separate real authenticated POST /plans/generate against a disposable seeded
SQLite fixture returned HTTP200/live_llm clarification in 2.274 seconds through
the production provider worker. Its policy stayed unconfirmed, candidates were
empty, state/audit were unchanged, and candidate/certificate/execution tables
remained empty. Safe evidence is evidence/planner-deadline-api.json. Fixture
initialization/login are separate from runtime financial activation.

Combined validation: 526 backend tests and 40 browser/API/proxy tests passed,
including all existing assertions and the three new proxy checks. Generated
contracts are unchanged. Required review and current hosted CI gate closure.
