# Human approval lifecycle

PF-013 implements POST /approvals with the existing ApprovalRequest -> Approval contract. No schema/migration/client contract change. The endpoint requires the real cookie session, trusted Origin and matching CSRF token from PF-033. The actor is server-derived; client actor/state/version/verified fields are rejected by schema validation.

Approval is requested using only certificate_id, the exact action_digest shown to the human, and explicit APPROVE or DENY. The service loads the stored artifact and independently verifies schema, signature/key trust, hash/action/config bindings, time validity, stored metadata, current snapshot/version, active policy/digest, and absence of prior execution use. Current forbidden tokens/recipients/borrowed funding remain hard refusals. A signature is not a substitute for PF-029's trusted risk/policy issuance, which remains unfinished.

One certificate receives one final human decision. Both APPROVE and DENY are persisted, duplicate decisions return CONFLICT, and denial cannot be overwritten. A new decision after denial requires fresh trusted verification and a new certificate. No generic reusable approval flag exists. An unnecessary approval request is rejected if the signed certificate did not request approval.

The record binds certificate/action/state/policy, actor, timestamp and unconsumed status. Its same-transaction audit event additionally binds the authenticated session's SHA-256 fingerprint, without storing/exposing the raw cookie. Approval does not mutate the signed payload or consume a certificate; the future executor must independently authorize and atomically claim/consume it.

## Transaction and audit semantics

SQLite uses BEGIN IMMEDIATE before trusted reads so competing writers cannot change state/policy between validation and decision persistence. The alternative row-lock path locks user head then certificate; PostgreSQL remains untested. Unique approval-per-certificate is a final database guard. Concurrent requests create one decision, with the losing request returning CONFLICT.

Approval and audit append commit together. An unavailable/corrupt audit head rolls the decision back. Audit encoding uses the canonical JSON SHA-256 digest of AuditEvent fields excluding event_hash, with previous_hash linking the prior stored event. All single-user writers must serialize through the user-head/SQLite writer lock before append. The helper checks the current head's metadata/hash; full-chain verification/export and the rest of workflow event coverage remain PF-016. This is not administrator-proof immutability.

The status route from PF-012 observes VALID after matching approval, and APPROVAL_REQUIRED after denial. Neither status is a signing permission; expiry, changed state/policy or prior use still blocks execution independently. Two approved certificates do not reserve or authorize overlapping wallet expenditure; PF-014 must serialize execution claims and budget use.

## Verification scope

Tests use isolated, explicitly signed fixtures in a migrated test database; no product certificate is seeded or issued. They exercise the real authenticated API and SQL transactions, including two concurrent HTTP decision requests, immutable denial, exact bindings, stale/tampered/expired/spent/missing cases, CSRF/session refusal, hard restrictions, audit sequencing/hash validation and rollback. No EVM signer/broadcast is invoked. Full UI approval panels remain Wasik's PF-022 work, and full product acceptance gates are not passed by these tests.
