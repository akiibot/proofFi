# PF-009 execution record

- User approved written spec and confirmed implementation plan; execution inline on `codex/pf-009-seeded-monte-carlo`.
- Engine red run: five tests failed with missing module. Initial implementation: five passed.
- API red run: two tests failed because `/simulate` returned 501. Trusted loading/persistence implementation: eight tests passed.
- Expanded focused coverage: 19 passed. Initial full gate: 223 backend tests, four browser/API tests, lint/typecheck/build/contracts passed; migration/generated-contract checks clean.
- Review found two actionable gaps: unbounded ledger-list work despite path-day cap, and acceptance of mutated replay timestamps. Timestamp regression reproduced HTTP 200 instead of expected 503 before fix.
- Ruling: add a ledger-work cap before RNG allocation, including schedule size — path-days alone does not bound memory/CPU; oversized trusted models explicitly refuse.
- Replay now validates full audit chain and exact original artifact digest. Added preallocation refusal, timestamp corruption, market-sample reuse and replay audit-corruption coverage. Final verification follows these changes.
- No seed configuration, public configuration input, financial assumptions or chain evidence added.
- Final focused suite: 23 passed; follow-up independent review reported no remaining important finding. Full rerun after fixes: 227 backend tests passed, browser 3/4 (financial-state proxy 503); unchanged subsequent full rerun passed 227 backend and four browser tests, lint/typecheck/build/contracts. Both failures remain documented without a causal-fix claim. Migration/generated-contract checks clean.
