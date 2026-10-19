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

## Continuing lead work before teammate onboarding

On 2026-10-15 the lead instructed: "you keep conitnuing your part, They will be added later". Lead-owned implementation may proceed on stacked branches based on the approved foundation while invitations/reviews are pending. This overrides the earlier development-start restriction; it does not fabricate a merged dependency or authorize bypassing protected PR review. Feature issues retain blocked integration status until their dependencies merge.

PF-012 cryptographic implementation details: Ed25519 signs a domain-separated, length-prefixed key ID plus raw SHA-256 payload digest; five-minute maximum certificate lifetime, exclusive expiry, future-issued certificates not currently valid. These specialize D10 without changing the approved API models. See CERTIFICATES.md.

## PF-033 session contract change for review

Implementation stays within the approved single-user modular monolith. Proposed API v1.1.0 adds LoginRequest/SessionInfo/LogoutResult, login/session/logout routes, cookie authentication, and FORBIDDEN/RATE_LIMITED error codes. It removes the prototype bearer identity path. Canonical financial snapshots, action/certificate/transaction encodings and schema versions are unchanged. HTTP consumers and generated client are updated together in the separate contract-change PR. Integration requires lead contract review; no approval of this new contract is fabricated.

Engineering defaults: opaque HttpOnly/SameSite=Strict cookie, 30-minute expiry, in-memory sessions capped at 32 for one API worker, scrypt (N=16384,r=8,p=1) password hashes with per-password salts, exact trusted origins, matching CSRF for every POST, 5 failed login credentials/minute globally and 120 mutations/minute/session. Restart revokes sessions and resets limits. Public-mode configuration enforces HTTPS origins and Secure cookies. Bootstrap creates only ignored local demo credentials and does not print their values.

## PF-013 implementation semantics

A human decision is final per certificate, including DENY. A fresh decision requires a new trusted certificate. SQLite serializes trusted reads and decision/audit writes using BEGIN IMMEDIATE; future executor must repeat authorization and atomically consume. The existing audit schema records SHA-256 of canonical unsigned event fields, excluding event_hash, and links previous_hash. Authenticated session provenance is an audit detail containing only SHA-256 of the opaque cookie, not the raw credential. No public or financial schema change; full workflow audit coverage remains PF-016.

## Interim demo assumption decision

On 2026-10-15 the lead delegated the interim income choice ("do what you feel will be best for now") and requested a testnet configuration checklist because infrastructure is not yet provisioned. Preserve the specified financial baseline, empty income and unconfigured probability assumptions. Do not manufacture a positive allocation; a completed optimizer must report NO_SAFE_ACTION where appropriate. This is an interim honest baseline, not completion of the successful A/C demonstrations. See TESTNET_SETUP_CHECKLIST.md.

## Owner waiver of teammate approval

On 2026-10-16 (Asia/Dhaka), the repository owner instructed: "you dont need team mate approvals from now on" and "But make sure not to break anything". Teammate approval is waived for subsequent PRs. This supersedes the earlier #34-only waiver. PRs, passing current CI, dependency checks, lead review of sensitive/shared changes, separate contract-change PRs, and honest local test evidence remain required. This waiver is not a financial approval, policy activation, or architecture change.

GitHub review requirements may be changed to zero mandatory approvals with CODEOWNER approval disabled; keep strict foundation CI, required PRs, conversation resolution, admin enforcement and force-push/deletion restrictions. Lead review remains procedural for sensitive/shared changes.

## PF-008 deterministic stress semantics

Named stresses run individually on the existing integer-cent ledger. Only liquid non-high-risk balances fund obligations; risky holdings remain for terminal valuation. Income precedes same-day outflows, and primary-goal funding requires all same-day costs to be fundable. The future $2,000 emergency occurs on day 1 and is additional to any realized expense already reflected in balances. Tuition protection remains independent of other protected payments and releases only when the tuition goal payment is applied. These conservative timing, valuation and segregation rules add no income or probability assumptions. See RISK_METHODOLOGY.md.

## PF-037 approved private storage contract

An additive SQLite execution_envelopes table preserves exact signed bytes and a
computed hash per existing claim before any future broadcast. It does not alter
D01–D15, public schemas, certificates or transaction encoding. Ordinary writers
cannot update/delete/replace an envelope; populated downgrade refuses. SQL shape
constraints do not authenticate bytes: PF-015 must independently validate actual
signature/fields/hash and authorization before storage/use. PF-037 itself added
no runtime writer or public route. See PRIVATE_EXECUTION_JOURNAL.md and issue #68. This is
an approved private persistence contract, not a completed executor. The owner
explicitly approved PR #69 in the Codex conversation on 2026-10-17. Exact head
0c00a09ab08f1e2969814d9c2d3d4f0bb874a994 passed Ubuntu and Windows CI (401 backend /
37 browser tests); it merged at dcf8a968f03c4d82ff87050e9ad1dc4a6974e9d8.
Approval record: https://github.com/akiibot/proofFi/pull/69#issuecomment-6223581642.

## PF-046 approved PostgreSQL storage extension

On 2026-10-18 the owner selected Supabase Free for persistent hosted storage and
requested implementation. The separate storage contract in
[POSTGRES_STORAGE_CONTRACT.md](POSTGRES_STORAGE_CONTRACT.md) adds a private PG
migration history, equivalent immutable journal constraints and a transaction-scoped
serialization helper. It does not replace SQLite/local demos or change public
schemas/certificates. Owner approved PR #121 conditional on all three current CI jobs passing; Ubuntu,
Windows and PG17 passed on16cf2846c874ddfbf29f3ea6aed471e6047825c2 and it merged
at9e95a25389ecc75254857b6d8e0cd43b72ab0dd9. Dependent runtime integration under
#120 still needs its own lead review/current CI before deployment or enablement.


## PF-050 and PF-049 owner acceptance (2026-10-19)

The owner/lead approved PR #129 and the current Figma v2 visuals and directed
Codex to complete integration and deploy if checks pass. Approval covers #129
head28b8218888e650ee656135f0f7a1f0e72d524ee5 and the reviewed #130 consent,
recovery and UI behavior at1dbe2531933d2e7cd7db45a09762a4600cfb08fb. All three
required CI jobs passed on those heads. #129 merged atc394292; refreshed #130
requires current CI before merge. Current visuals/Instrument Sans fallback are
accepted; exact Figma fidelity remains unverified. Deployment does not authorize
a new transfer, expense, reset, policy activation, credential change or paid
resource. Preserve existing Supabase and original A/B/C evidence.

## PF-042 operator recovery design proposal (2026-10-19)

The owner requested completion of #99. The issue requires a concrete separately
lead-reviewed design before advanced recovery implementation. The proposal in
[OPERATOR_RECOVERY_PROTOCOL.md](OPERATOR_RECOVERY_PROTOCOL.md) preserves existing
runtime refusal, permanently excludes re-signing lost bytes and blind rebroadcast,
and specifies evidence/replay, exact acknowledgement and atomic compensation
requirements for changed assets. No new runtime authority, schema, API, financial
rule or live repair is implemented. Design acceptance is pending; this request
to prepare the issue is not recorded as approval of an unseen protocol. A future
implementation requires a separate reviewed contract-change prerequisite.
