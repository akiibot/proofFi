# Engineering decisions

Status: **APPROVED**. No prior implementation or architecture existed. The user requested foundation first; the attached master prompt's instruction to continue through all features does not expand this turn's scope. Neither document is a source of authorization to invent credentials, addresses or financial assumptions.

After lead approval, record the approving review/commit below and change status to APPROVED. All subsequent shared-contract/migration/authorization changes require a separate `contract-change` PR, generated artifacts, migration/test evidence and lead review. Do not silently replace these choices.

| ID | Engineering choice | Reason / source distinction |
|---|---|---|
| D01 | Modular monolith; Next.js App Router and Python 3.11 FastAPI | Recommended by the documents; process and folder boundaries selected for three contributors. |
| D02 | npm workspaces, npm lockfile, uv lockfile, SQLite + Alembic | Engineering defaults for reproducible local startup; no database server prerequisite. PostgreSQL migration requires its own reviewed/tested change; not claimed tested today. |
| D03 | Pydantic is canonical; checked-in OpenAPI and generated TS | Prevents competing schemas. Contract version 1.0.0 approved by the lead. |
| D04 | Integer USD cents (bounded below JavaScript safe integer), string EVM base units, integer probability basis points | Engineering serialization choice; no floating point in signed payload. Computation may use NumPy floats internally with explicitly documented conversion at the boundary. |
| D05 | Whole immutable typed snapshots stored in JSON with normalized artifact tables/FKs and mutable user-head pointers | Keeps obligations/balances/income as a single atomic versioned unit rather than disconnected editable rows. Embedded entities have stable IDs. Append-only semantics enforced by repositories/contributor rules, uniqueness and digest checks; not an admin-proof database. |
| D06 | Snapshot as_of is UTC; seeded 2026-10-15, horizon relative days 1..120 | Reproducible seed; four months approximated as 120 days, not a claim of calendar-month equivalence. A later calendar-date change is contract-reviewed. |
| D07 | Base Sepolia 84532, ERC-20 transfer only | Engineering selection among permitted testnets. Exact deployed token/destination intentionally unset; blocked until configuration validation. Source: https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_chainId |
| D08 | One synthetic USD unit -> one test-token unit, with exact decimals conversion | Demonstration mapping, no exchange rate or purchasing-power claim. Transfer to approved demo destination does not constitute investing. |
| D09 | Separate native-gas balance and bound gas_limit / EIP-1559 caps; synthetic operational fee included in risk model | Fee valuation assumption must be selected explicitly in trusted config before verification; no invented current ETH/USD price. |
| D10 | ProofFi canonical JSON v1: recursively sorted keys, compact separators, UTF-8, no floats; SHA-256 | Not advertised as RFC 8785. Ed25519 signing is future PF-012; payload immutable, execution separate. UTC serialized Pydantic timestamps; signed domain fields use validated exact strings. |
| D11 | Concentration denominator = max(0, current owned synthetic assets - unpaid protected tuition - emergency floor) | Engineering definition approved by the lead. Excludes projected income; numerator includes existing plus proposed high-risk positions. Remaining liquidity and living expenses checked separately. |
| D12 | Baseline expected income empty; Constitution seeded as draft; no probabilistic config automatically activated | Avoids silently inventing income/risk distributions or human confirmation. Baseline has a $200 budget shortfall before shocks, so meaningful positive A/C comparison remains blocked on explicit assumptions. |
| D13 | Foundation API requires backend bearer; local read-only Next proxy | Local development only. Human session authentication/CSRF/rate limits must land in PF-033 before approval or public mutations. No frontend secret. |
| D14 | Feature work blocked until all foundation gates merge; PF-033 added | Extra authentication gate needed for coherent approvals. A owns PF-033; B/C begin nonconflicting ready work after merge. |
| D15 | codex/ branch prefix | Workspace convention used for initial branch; ongoing branch example codex/pf-008-named-stresses. Stable PF IDs retained from master prompt. |

## Approval record

The lead explicitly approved the foundation architecture in this chat on 2026-10-15: "Approve the foundation architecture". Approval applies to D01–D15 and contract v1.0.0 in PR #34. This is architectural acceptance; another developer review and protected merge are still required. No merge or financial-assumption change is implied.

## Financial decision needed before hero implementation

Select and display a realistic-for-demo income schedule and explicit scenario probabilities/fees, or accept that the literal baseline has no positive safe allocation. Do not change figures to manufacture an optimizer success. Named future emergency stress must explicitly state whether it represents an additional shock after Scenario C's realized expense.
