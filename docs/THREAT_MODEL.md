# Threat notes and residual risks

This is an implementation-linked design account, not a penetration test, security
certification or claim of production custody safety. The approved architecture is
in [ARCHITECTURE.md](ARCHITECTURE.md); operational constraints and authentic evidence
remain in the linked module documents and GitHub issues.

## Assets and trust boundaries

Protect the dedicated testnet signer and verifier seed, authenticated decision
provenance, confirmed policy, state/configuration history, exact transaction bytes,
approval consumption, durable execution identity and ledger/audit consistency.
Provider credentials, login passwords and opaque session/CSRF values are private.
The browser and planner are untrusted. Planner prose and a schema-valid candidate
carry no authority. The backend reloads trusted state/policy/configuration; the
independent executor checks authority again before signing. Only executor code may
call the signer. The planner must not import verifier, approval or execution modules.

## Threats, controls and practical limits

| Threat or attacker control | Implemented control | Remaining limitation |
|---|---|---|
| Prompt injection, fabricated reasoning or unsafe structured candidate | Typed proposals remain untrusted; deterministic policy/simulation recomputation; hard failures cannot be approved away. | Prompt instructions do not make an LLM trustworthy. The controlled malicious-planner route is tracked in PF-031 until merged and accepted. |
| Supplying fake balances, policy, simulation success, approval actor or replacement calldata | Public bodies exclude internal trusted input; authoritative artifact/hash bindings and exact transaction reconstruction. | A compromised backend/DB administrator can replace the authority itself. |
| Unauthenticated mutation, cross-site requests or arbitrary proxy forwarding | HttpOnly/SameSite cookie, exact Origin, CSRF, login/mutation limits and explicit proxy allowlist. | One process, in-memory sessions and limits; restart revokes sessions. Public mode requires HTTPS/Secure cookies and correct hosting. No production multi-user claim. |
| Editing a certificate, changing amount/recipient/fees or reusing consent | Domain-separated Ed25519 signature, canonical digest, five-minute exclusive expiry, current state/policy/configuration checks, one final decision bound to one certificate/action. | Verifier-key compromise can forge attestations. Retain trusted historical public keys; a valid signature alone does not authorize current execution. |
| Direct executor bypass, concurrent requests or duplicate sends after timeout | Independent gate, serialized claim/approval consumption, unique identities, one signing attempt, durable exact envelope before dispatch, deterministic hash and reconciliation. | A lost signing handoff can strand a claim. PENDING can mean an ambiguous or reserved-but-unsent attempt. Never clear claims or blindly sign/send again. |
| Wrong RPC chain, token, destination, decimals, nonce or gas terms | Base Sepolia pinning, operational allowlists, deployed-code/balance/fee reads, exact EIP-1559 decoding and sender recovery, repeated independent checks. | A malicious provider/host can lie or become unavailable. L1 fee observations are not enforceable EIP-1559 caps. Testnet success does not establish mainnet readiness. |
| Fake receipt, revert, insufficient confirmations or reorg | Canonical block/receipt/transaction/Transfer checks, required depth, visible failure/reorg state and exactly-once ledger effect. | Confirmation depth is a policy threshold, not finality. Reorgs after later financial edits can require manual recovery. Changed-asset/lost-handoff recovery remains open in PF-015. |
| Stored artifact or audit modification | Canonical digests, artifact metadata checks and linked event hashes; controlled append-only writes and immutable signed payload separate from execution status. | An administrator with DB/key control can rewrite history. Audit sequencing is tamper detection under the stated trust model, not administrator-proof storage. |
| Large or malformed provider/simulation input | Typed limits, bounded provider reply/deadline, workload checks before RNG allocation and sanitized API errors. | Resource limits do not establish general DoS resistance; network/hosting failure can still deny service. |
| Secret leakage through UI, diagnostics or evidence | Server-only settings, no backend credentials in browser requests/prompts, sanitized validation/provider errors; public evidence excludes private envelopes/keys. | Operators must keep ignored private files, logs and backups private. Local hostile software or a compromised process remains outside this protection. |

Authentication is identity, not financial consent. Constitution confirmation is
explicit; each required action approval binds the exact reviewed certificate.
No policy draft or operator enable flag grants missing certificate authority.
The default-off public executor requires separate operating configuration and
independent validation even after enabled. Revoking/restarting a browser session
does not erase an existing on-chain transaction.

## Failure and recovery discipline

The original signed payload excludes mutable execution status. Pending, failed,
confirmed and reorged observations belong to separate execution records. Persisted
raw signed bytes are a sensitive recoverable capability: never publish them, place
them in prompts, return them through HTTP, or delete them to retry an attempt.
Historical signature/approval checks continue during reconciliation after expiry;
this preserves a known transaction identity without granting a new signing attempt.

Automatic reversal is conservative. Internal guarded recovery can restore only
unchanged affected assets under exact inspected state and fresh chain absence or
noncanonical evidence. Arbitrary changed assets and lost signed handoffs remain
unresolved; fail closed rather than invent cash, restore approvals or release a
nonce. See [EXECUTION_RECONCILIATION.md](EXECUTION_RECONCILIATION.md) and
[PRIVATE_EXECUTION_JOURNAL.md](PRIVATE_EXECUTION_JOURNAL.md).

## Evidence and deployment boundaries

Focused tests cover tampering, replay, concurrent claims, wrong authority, ambiguous
broadcasts, receipt/reorg/recovery cases and authentication. Services may be
substituted only inside isolated tests. The actual owner-confirmed application
transfer and repeat ledger reconciliation are recorded in
[LIVE_EXECUTION_ACCEPTANCE.md](LIVE_EXECUTION_ACCEPTANCE.md). That receipt is one
real testnet execution, not completion of the full product or every adversarial
case. PF-026 owns AT-01..AT-12 and all three scenarios.

SQLite, a single user and a dedicated testnet wallet are the approved deployment
boundary. PostgreSQL, distributed sessions, real money/mainnet, independent-host
verification and compromised-host resistance are not established here. New routes,
authority models, migrations or encodings need the recorded separate contract and
lead review process; documentation cannot silently activate them.
