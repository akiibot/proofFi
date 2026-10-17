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
