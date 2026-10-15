# PF-014 executor guards implementation plan

Goal: independently reject invalid execution requests and atomically claim authentic current certificates once, without enabling financial execution before PF-029/PF-015.

Architecture: preserve existing schemas/migrations/routes. Work on codex/pf-014-independent-executor stacked after PF-013 under the lead's continuing-work authorization. A server-only recheck callable consumes TrustedSimulationInput and returns recomputed PolicyVerdict/SimulationRun; no public input selects it. No default successful recheck. The runtime route remains NOT_IMPLEMENTED until the full orchestration is wired in PF-015. Claims never imply broadcast or confirmation.

Spec: docs/ARCHITECTURE.md, docs/DECISIONS.md, GitHub issue #14.

- [x] Add focused tests for absent/tampered/expired/stale certificates, wrong action, actor and approvals, altered transaction and trusted artifacts; verify missing gate fails first.
- [x] Implement services/api/app/execution/gate.py. Reload authority inside SQLite BEGIN IMMEDIATE. Independently validate signature, exact bindings, current state/policy, operational allowlist, stored candidate/config/run/verification and recomputed policy/risk evidence. Reject missing dependencies explicitly.
- [x] Claim certificate exactly once with unique idempotency key; reserve chain/sender/nonce against existing claims; consume exact approval and append audit in the same transaction. Never call signer or gateway from this claim service. Concurrent calls produce one claim; crashes leave a durable claim requiring reconciliation, never automatic reclaim.
- [x] Test denial, replay and concurrency, rollback on corrupt audit, immutable signed payload, and no signing/broadcast. Test substitutes only represent missing risk services in isolated tests; no product-risk completion claim.
- [ ] Document actual remaining dependencies, testnet configuration checklist and reviews. Run focused tests and npm run check; open stacked issue-linked PR with accurate limitations, keep #14 blocked.

Review focus: signed but stale evidence; approval removal below/above autonomy limit; different certificates sharing a chain nonce; idempotency-key reuse; clock expiry during recheck. Every rejection precedes any claim/signing authority. SQLite is the supported database; no untested PostgreSQL serialization claim.
