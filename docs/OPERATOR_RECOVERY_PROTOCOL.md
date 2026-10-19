# PF-042 / #99: explicit operator recovery protocol

Status: **proposed for owner/lead review**, based on main
`ac1f0e2808e735150696b2739584183b30ca599d`. This is the design deliverable
requested by #99, with executable tests of existing refusal and atomicity
boundaries. It does not implement or enable advanced recovery. Approval of this
design does not authorize a live repair or a transaction. The accepted MVP scope
in [EXECUTION_RECOVERY_SCOPE.md](EXECUTION_RECOVERY_SCOPE.md) remains unchanged.

## Outcomes and authority

| Inspected case | Permitted result | Permanently refused shortcut |
|---|---|---|
| Browser lost its retained request, durable row exists | Operator identifies the original private request tuple and reviews existing records; no new key is generated | Guess a key, infer identity from receipt alone, or use display cache as authority |
| Exact persisted envelope and dispatch reservation exist | Reconcile the existing hash through existing authenticated checks | Re-sign, resend, replace, cancel or claim that reservation proves broadcast |
| Signed bytes remain in the original trusted in-process handoff, with fresh exact authorization | Existing `persist_signed_attempt` may validate/store those exact bytes; existing dispatch checks still apply | Reconstruct bytes by signing again or relax expiry/state/policy checks |
| Process lost bytes before durable commit; no authenticated copy survives | Retain CLAIMED, consumed approval and signing evidence; classify as unresolved lost handoff and stop | Manufacture/recover a hash from a signing digest, clear claim/nonce reservation, restore approval, or call signer again |
| Reorg, affected assets unchanged, later unrelated edits | Existing internal `recover_unchanged_assets` with exact inspected state hash and fresh chain checks | Revert the entire snapshot or alter unrelated fields |
| Reorg, affected assets changed | Review the proposed compensation protocol below; current runtime continues CONFLICT | Apply the historical snapshot or inverse delta without complete provenance and exact human acknowledgement |
| Missing/corrupt history, uncertain chain, negative correction, changed asset identity, or incomplete provenance | Retain conflict and evidence, explicitly unresolved; no correction | Human acknowledgement overriding missing evidence, unexplained funds or a failed invariant |

A request identity consists of certificate ID, action digest and original
idempotency key, bound to the execution ID and owning user. Recovering this tuple
is not financial approval. A browser sessionStorage entry, exported screenshot,
operator note or explorer page cannot establish ownership or execution authority.
Current GET `/executions/{id}` does not expose the idempotency key. This design
adds no public identity lookup or privileged browser route. Any such endpoint
would require its own reviewed authentication/contract change.

## Inspect and preserve

1. Stop the affected journey. Keep the existing execution enablement unchanged;
   do not reset state, change keys or free a reserved wallet nonce. Conservatively
   treat missing bytes and ambiguous reservations as unresolved, not failed or
   safe to retry. Do not create a replacement action while investigating.
2. Use an authorized operator and a consistent read-only database transaction.
   On PostgreSQL use the existing authority lock for coherent multi-statement
   reads; on SQLite use a snapshot transaction. Preserve a private backup using
   the deployment's existing backup controls. Never upload raw signed bytes,
   request keys, credentials or complete private rows to issues or screenshots.
3. Bind the owner through the certificate's historical financial state; check
   execution row metadata against its payload, original request tuple, exact
   certificate/action/state/policy hashes, consumed approval and creation time.
   Verify the entire audit chain and unique claim/sign/envelope/reservation
   events. Verify envelope bytes, signature, every certified transaction field,
   SHA-256 and computed transaction hash if an envelope exists. A signing audit
   digest without bytes is evidence of signing, not recoverable transaction data.
4. Record exact current state ID/version/hash, active policy hash, latest
   execution artifact digest, audit tail sequence/hash, original active ledger
   effect event and its before/after snapshots. Reproduce that effect from the
   certificate, including its fee; never accept an arbitrary historic delta.
   Inspect every intervening version and its evidence. Inconsistent or missing
   records stop the procedure without mutating the application store.
5. For a persisted dispatched hash, use the existing canonical receipt/Transfer
   validator and configured confirmation threshold. Record observed chain ID,
   hash/block/receipt/confirmation details and time. An unavailable RPC, unknown
   receipt or explorer claim does not establish finality or non-broadcast.
   Reconciliation may append an observation; it is a separate explicitly invoked
   operation, not part of the read-only inspection report.

The incident report contains the operator identity, case ID, evidence digests,
timestamps, limitations and the chosen disposition. A rejected inspection is
recorded in the existing private incident/review system; this design does not
claim that an external note is an authenticated application audit event.
Preserve the original application's hash-linked audit unmodified. Hash chains
detect ordinary changes but cannot defeat a compromised database administrator.

## Proposed changed-assets compensation

This section defines a future, separately contract-reviewed accounting operation.
It is **not available in the current runtime**, and is never an RPC send path.
If the evidence requirements cannot be implemented, the disposition remains
unresolved CONFLICT; operator discretion does not replace them.

For each affected asset ID, reproduce the original certified effect as
`delta = applied_amount - original_amount` in integer USD cents. A proposed
compensation would append a new state with
`corrected_amount = current_amount - delta`, preserving every unrelated current
field and asset. This arithmetic is necessary but not sufficient authority.

The verifier must independently replay every intervening state transition using
its authenticated source artifacts and exact arithmetic, prove the current
balance, distinguish each already-reversed/compensated effect, and prove the
original position has not been transferred, consumed, replaced or reclassified.
An untyped manual balance change, unexplained version gap, new asset identity,
negative result, unsupported subsequent operation or absent evidence refuses.
Current append-only snapshots alone do not supply this complete replay proof;
the current implementation therefore correctly refuses changed affected assets.

No new income, risk distribution, valuation, exchange rate, loss allocation or
fee assumption may be introduced. A fee treatment not established by the original
evidence needs a separate reviewed financial decision; never silently refund it.
Re-run current financial/policy validation for the proposed corrected state and
show any shortfall. A correction cannot reuse an old certificate to authorize a
new action. Existing state versioning makes old spending certificates stale.

### Exact operator acknowledgement

Before a future implementation commits, present the authenticated operator/owner
with a private case manifest containing:

- Case ID and protocol version; owner and approving operator identity.
- Execution/certificate/action identity, original request identity digest,
  transaction hash, latest execution digest and complete evidence digest.
- Current state ID/version/hash, active policy hash, audit tail and active
  ledger-effect event; fresh canonical chain observation and threshold.
- Every original/applied/current/corrected affected asset value and metadata,
  fee treatment, exact proposed new-state digest, preserved later edits and all
  detected policy shortfalls. No raw transaction bytes or credentials.
- Expiry and one-use decision nonce, plus the explicit statement:
  “I authorize only this exact planning-ledger compensation for this execution
  and inspected state. It sends no transaction, creates no signature, restores
  no consumed approval, and does not establish that the transaction cannot
  reappear. If state, evidence or chain outcome changes, this decision expires.”

The operator must explicitly acknowledge this manifest's digest. Approval of the
design/PR, an ordinary payment approval, a UI status, or a blanket “repair it” is
not that acknowledgement. Rejecting a case never changes the original claim,
approval or financial state. Authorization is scoped to accounting correction,
not to any transfer, replacement, credential change or database reset.

### Atomic commit, concurrency and crash boundaries

A future implementation must use the existing database authority-lock discipline
and one transaction for the full commit. Reload and revalidate the exact user,
request, case decision, certificate, active effect, latest execution/audit tail,
current state and policy under the lock. Perform fresh canonical chain checks
against the original hash; timeout, reconfirmation, changed evidence or an expired
decision refuses. The chain can change after a read: preserve the original hash
and reconcile future observations; never promise permanent chain finality.

Append one new immutable financial snapshot with compare-and-swap on the inspected
head. Atomically append an audit event binding the operator decision/manifest,
before/after digests and the specific compensated effect, transition that effect
to inactive exactly once, and append the updated execution observation. The
original claim, consumed approval, signed envelope and historical events remain
unchanged. Do not clear a conflict until correction and audit commit together.

Uniqueness must prevent a second compensation of the same active effect, and
decision consumption must be atomic with the new head/effect/audit. These are
future private persistence contracts, not permission for direct table edits.
Duplicate/concurrent requests either return the same committed case result or
refuse stale authority. Never rerun a stale acknowledgement against a new head.

| Failure boundary | Required durable outcome |
|---|---|
| Signer returned, bytes never committed | Existing consumed claim/signing evidence; no second signature or inferred hash |
| Inspect/acknowledge, then another writer advances state or audit | Decision stale; no financial write |
| RPC unavailable or canonical outcome changes during review | Refuse compensation; preserve conflict and original attempt |
| Crash before/within compensation transaction, including audit failure | Old head/effect/error and decision remain as before; no partial snapshot/audit |
| Commit succeeds but response is lost | Case identity resolves to the one committed result; no second compensation |
| Original transaction later reconfirms | Reconcile original hash; existing exactly-once effect accounting applies, with any unsupported conflict retained |

No recovery component may import or call the signer, broadcast or approval-
creation/consumption APIs. New signing or replacement is permanently outside this
protocol. No change to public Execution status, certificate payload, transaction
encoding or financial rule is proposed here.

## Contract and implementation gates

1. Owner/lead accepts this concrete design. #99 is a design issue and can close
   only after that acceptance and its design/test PR are integrated.
2. Before implementation, open an issue-linked **separate contract-change PR**
   defining the private case/decision/event and uniqueness/immutability contract,
   identity/permission model, replay evidence, migration/rollback behavior and
   exact stale/duplicate semantics. Regenerate OpenAPI/TypeScript if any public
   route/model changes; otherwise verify generated artifacts are unchanged.
3. Implement consumers only after that prerequisite merges, with independent
   positive replay/compensation tests, exact acknowledgement tests, stale-policy/
   state/audit/chain races, response-loss idempotency, both audit-failure crash
   boundaries and all original refusal/sign/send/approval invariants on SQLite
   and PostgreSQL. Do not label existing unchanged-asset tests as advanced repair.
4. Any real operator correction needs its own exact manifest acknowledgement and
   applicable financial authorization. This task performs no live operation,
   restart, reset, policy activation, transfer or hosted configuration change.

## Executable evidence for this design

`test_pf_042_recovery_boundaries.py` and its PostgreSQL counterpart use isolated
fixtures, real certificate issuance/signatures and genuine consumed test approval:
lost bytes and envelope-commit failure survive connection reopening and concurrent
original/replacement-key retries; changed cash/allocation recovery refuses
concurrently; both recovery audit-failure points roll back every persisted table.
Successful unchanged-assets recovery after the injected failure still preserves
later unrelated edits. All cases assert no second signer/send and no resurrected
approval. Existing pending/reorg/receipt/exactly-once suites remain required.

These tests prove current safety boundaries, not an implemented advanced repair
feature, a full process/host restart, or a live chain result. The proposed future
case journal, replay verifier and compensation acknowledgement remain unimplemented.

### Validation run, 2026-10-19

- Focused existing execution/HTTP/recovery plus new boundaries: **96 passed**.
- Fresh isolated loopback PostgreSQL17, corresponding dispatch/reconciliation
  and new boundaries: **79 passed**. The initial documented port15446 was not
  running; the successful run used a newly initialized test-only instance on
  port15442, subsequently shut down. Supabase was never used for tests.
- Full `npm run check`: **passed**, including Ruff, **653 backend tests**,
  generated contracts without drift, lint, TypeScript, production build and
  **112 browser tests** (2.9 minutes), preserving AT-01 through AT-12.
- Current Ubuntu, Windows and PostgreSQL CI and explicit owner/lead design
  acceptance remain merge requirements. No hosted action or deployment occurred.
