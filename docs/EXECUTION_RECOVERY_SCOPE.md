# PF-015 recovery scope decision for lead review

Approved on 2026-10-18 (Asia/Dhaka) and integrated via PR #100 at `f724f2f`,
after explicit owner scope approval and passing current Ubuntu/Windows CI. PF-015/#15
is closed at this boundary; dependent implementation may proceed. This decision
changes no runtime behavior or contract. The tables below describe the reviewed
proposal against main `9e6d75b`.
Advanced operator recovery is tracked in [PF-042/#99](https://github.com/akiibot/proofFi/issues/99).
The concrete [PF-042 protocol proposal](OPERATOR_RECOVERY_PROTOCOL.md) defines
evidence provenance, permanently refused operations, exact acknowledgement,
concurrency/crash boundaries and separate implementation/contract gates. It is
awaiting owner/lead acceptance; it does not change this approved runtime boundary.

## Existing implementation and evidence

| Capability | Integrated implementation | Evidence |
|---|---|---|
| Exact authorization and one signing attempt | `execution/gate.py`, `execution/router.py`; #64/#89 | `test_pf_014_signing.py`, `test_pf_014_http.py` |
| Durable bytes before one-attempt dispatch | `execution/service.py`; #74 | `test_pf_015.py`: durable bytes, concurrent dispatch, ambiguous send, failed handoff/commit |
| Canonical receipt/Transfer and exactly-once ledger | `execution/reconcile.py`; #75 | `test_pf_015_reconcile.py`: confirmation, replay/concurrency, revert, timeout, reorg and ledger savepoint cases |
| Read-only inspection and explicit unchanged-asset reversal | `inspect_recovery`, `recover_unchanged_assets`; #78/#79 | Inspection/no mutation, later unrelated edits preserved, changed assets/stale inspected hash/reconfirmed chain refused |
| Genuine application transfer | #93 | `evidence/base-sepolia-application-execution.json` and original signed certificate; one execution/envelope/ledger effect, preserved hash and receipt |

Tests use isolated financial/RPC fixtures. The genuine API transfer is separately
recorded evidence; it does not establish a browser journey or Scenario C.

## Proposed minimum MVP boundary

- A lost signing handoff retains the consumed CLAIMED execution and available
  signing audit. HTTP resumption returns 409 ALREADY_USED with an explicit stranded
  claim message. No automatic re-sign, replacement, claim deletion, restored
  approval or blind rebroadcast is permitted. Missing bytes are not recoverable
  by querying a guessed transaction hash.
- A reorg with later changes to affected cash/allocation assets retains the
  REORGED execution, active historical ledger effect and visible recovery error.
  `recover_unchanged_assets` refuses 409 CONFLICT rather than overwriting later
  balances. Existing error/unsettled-attempt guards prevent further dispatch.
- Existing persisted-hash reconciliation and explicitly guarded unchanged-asset
  recovery stay available under their current internal boundaries. PENDING is
  ambiguous and is never presented as successful broadcast. A retry of the
  existing HTTP request identity only reconciles a dispatched attempt; a new
  idempotency key is not recovery.
- An operator preserves the database, private envelope, claims and audit history
  and stops the affected journey. The MVP promises explicit refusal and retained
  evidence for unsupported cases, not successful advanced recovery.

The missing feature is an approved protocol to resolve these unsupported states,
including what evidence and exact acknowledgement can authorize a correction.
There is no public advanced recovery endpoint or general operator repair tool.
PF-042 must design that protocol before implementing it; it cannot infer approval
from this document. No database reset, private configuration change or new live
transaction is needed to review this proposal.

## Approved decision and dependency consequences

The lead explicitly accepted conservative refusal as the MVP acceptance
boundary for lost handoffs and changed affected assets, and approved deferring
advanced recovery automation to #99. PR #100 integrated this record with both
current CI jobs passing; #15 is closed on its existing implementation and genuine
receipt evidence. #16 may proceed; #22/#25/#26 still retain their actual remaining
integration dependencies. Full browser acceptance, Scenario C acknowledgement and any
new exact transaction consent remain separate requirements.
