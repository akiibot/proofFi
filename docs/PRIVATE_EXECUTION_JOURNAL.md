# PF-037 private execution-envelope contract

Status: proposed additive persistence contract for separate lead review, issue #68.
No public schema, migration history, certificate payload, transaction encoding or
execution status is replaced. Public `/execute` remains NOT_IMPLEMENTED. This
change does not complete PF-014/PF-015 or any live-chain acceptance gate.

## Storage and authority

`execution_envelopes` adds one immutable row per existing execution claim:

| Field | Private storage contract |
|---|---|
| id | Existing server identifier convention; primary key |
| created_at | Existing server-written UTC record timestamp |
| execution_id | Required unique FK to executions.id |
| raw_transaction | Required SQLite BLOB, 1..4096 bytes |
| transaction_hash | Required unique lowercase 0x-prefixed 32-byte hash string |

The bytes are backend-only recoverable signing capability. They must never enter
API models, audit details, logs, prompts or frontend bundles. No runtime service
reads or writes these rows in this PR. No signer or network request is added.
The preparation timestamp and computed hash do not prove broadcast or a receipt.

SQL enforces shape and relational integrity, not cryptography. PF-015 must decode
and recover actual EIP-1559 bytes, bind every certified transaction field to the
permanent claim, validate audit integrity and compare the real keccak(raw) hash
before insertion and every use. The SQL tests deliberately use opaque synthetic
storage bytes, not a valid signed transaction or a fabricated chain receipt.

UPDATE and DELETE triggers prohibit ordinary writers from modifying the journal.
A BEFORE INSERT collision guard also refuses INSERT OR REPLACE, which otherwise
can bypass SQLite DELETE triggers with recursive_triggers disabled. A compromised
administrator can drop these guards; storage is not administrator-proof.

## Migration and rollback

Revision `6bbbdad71a37` follows the existing foundation revision. It adds only the
new table, constraints and three SQLite triggers. Existing claims, policies,
financial snapshots and audit rows are preserved. SQLite is the supported demo
backend; this migration refuses other dialects rather than claiming untested
portability. Regenerate OpenAPI/TypeScript; no public contract diff is expected.

An empty journal may be downgraded for an isolated migration check. Downgrade
refuses a non-empty journal before issuing DDL, preserving recoverable bytes.
Do not delete claims or signed envelopes to retry an attempt. An administrator
recovery/export procedure is future separately reviewed work, not a runtime
escape hatch in this change.

## PF-015 integration still required

The signer first makes its permanent claim. PF-015 must preserve the exact
returned bytes in this journal before attempting any send; a crash before that
commit leaves a stranded claim that cannot be re-signed. Before first broadcast,
independently repeat authority/expiry/state/policy/chain checks. Durably record a
broadcast attempt before sending; after ambiguity reconcile the existing hash
and, where permitted, rebroadcast only the exact stored bytes. Never sign a
replacement automatically. Receipts, confirmation depth, reorg/revert handling
and exactly-once planning-ledger effects remain PF-015 work.
