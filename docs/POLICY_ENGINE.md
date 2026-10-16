# Deterministic policy engine

PF-007 evaluates the confirmed Constitution against trusted state, a canonical candidate action and a simulation run already bound to the same state/config. It does not load public authority, issue certificates, approve actions or execute transactions. PF-029 will load those trusted artifacts and call this evaluator independently.

The evaluator returns nine ordered `RuleOutcome` records: the eight Constitution families plus the hard owned-funding restriction. Tuition and every other protected obligation remain segregated. The emergency floor is then required in addition, without counting tuition twice. The concentration denominator is `max(0, current owned synthetic assets - unpaid tuition - emergency floor)`; projected income is excluded. Existing high-risk holdings and a proposed test-token allocation form the numerator. Cross-multiplication enforces the configured basis-point boundary without floating point.

Amounts above the autonomy limit and unknown recipients return `REQUIRES_APPROVAL`. Blocked recipients, asset/chain violations, protected-fund or emergency-floor violations, excess high-risk concentration, failed Monte Carlo thresholds and borrowed funding return `FAIL`. Any `FAIL` makes the overall decision `DENY`, even when another rule requests approval. Approval can never override a hard constraint.

All amount arithmetic uses integer USD cents and probabilities use integer basis points. State, policy, action, simulation and config digests/IDs are revalidated before evaluation. Corrupt or mismatched trusted evidence raises an explicit failure for the caller to map closed. The seeded baseline remains $200 short before fees and shocks; this engine does not invent income, probabilities or a successful allocation.
