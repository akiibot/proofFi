# PF-050 / #128: read-only execution observation (contract change)

Status: owner/lead approved on2026-10-19 (Asia/Dhaka); merged via #129 at
`c3942926af4ca178840ad69e7c135c934a96c951`. Approval applies to reviewed head
`28b8218888e650ee656135f0f7a1f0e72d524ee5`, with Ubuntu, Windows and PostgreSQL CI
passing. Human approval is recorded at
https://github.com/akiibot/proofFi/pull/129#issuecomment-6256071006. API version
1.1.0 → 1.2.0. New authenticated GET `/executions/{id}` returns the existing
`Execution` schema; no new payload encoding, financial rule, migration or table.

Problem: `EXECUTION_RECONCILED.details` includes receipt_status and block_number
but omits status and confirmations. A receipt_status=1 can describe PENDING,
CONFIRMED or REORGED. Activity must read the complete persisted Execution rather
than infer confirmation. Its digest can be checked against the latest execution
audit artifact. Historical audit events/certificates remain immutable.

Before: authenticated callers have no read-only execution lookup. `/execute`
requires retained request identity and can reconcile/mutate, so it must not be
used as a substitute GET by Activity. After: GET returns the last persisted
observation without polling RPC, reconciliation, signing, dispatch, audit writes
or ledger mutation. It does not assert fresh chain truth or authorize sending.

Ownership is checked through Execution → Certificate → historical FinancialState
user_id, independently of the current policy/state/expiry. Absent or other-user
IDs return the same 409 CONFLICT. Invalid IDs return422; invalid stored
Execution/metadata returns sanitized503. Auth remains the existing session
boundary; no secret/token/header is added. Proxy permits only GET with one
bounded identifier segment; POST/arbitrary suffixes remain unavailable.

Example (synthetic fields only): a successful receipt at block100 with one of
two required confirmations returns status PENDING, block_number100,
confirmations1. After reorg a stored REORGED observation is returned unchanged,
even if the historical receipt_status audit field remains1.

Consumers: PF-049/#126 Activity and payment Story; backend schema generation and
Next read proxy. Regenerated `contracts/openapi.json` and `schema.d.ts` add one
operation; existing schemas remain identical. No data migration/backfill needed.
Deploy backend before consumers; mixed-version clients show unknown on failed
reads rather than guessing or sending. No deployment performed here.

Validation: focused isolated tests cover all five statuses, exact returned
payload, unauthenticated/absent/other-user reads, corrupt metadata, identifier
bounds, no POST endpoint, and unchanged audit/state/execution records. They work
with execution disabled and deliberately unusable test-only RPC/signer settings.
9 focused tests passed. Full CI required on current PR head.
