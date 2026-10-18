# PF-046 proposed PostgreSQL storage contract

Status: **APPROVED** via PR #121, merge9e95a25389ecc75254857b6d8e0cd43b72ab0dd9. Owner approved the exact contract in the Codex conversation conditional on all current Ubuntu/Windows/PG checks passing; all three passed on16cf2846c874ddfbf29f3ea6aed471e6047825c2. Owner requested Supabase Free on
2026-10-18. That PR implemented the storage prerequisite only. Dependent runtime integration
is reviewed separately under: [#120](https://github.com/akiibot/proofFi/issues/120).

## Contract and before/after

| Boundary | Existing SQLite | Proposed PostgreSQL |
|---|---|---|
| Initialization | `alembic.ini`, existing revision history | Separate `alembic-postgres.ini`, frozen baseline `pg0460000001` |
| Namespace | Local SQLite file | Backend-only `prooffi_private` schema; no browser Data API |
| Trusted transaction | `BEGIN IMMEDIATE` before authority/audit reads | READ COMMITTED + one database-wide transaction-scoped advisory lock before reads |
| Signed bytes | Bounded SQLite BLOB + immutable triggers | Bounded BYTEA + immutable UPDATE/DELETE/TRUNCATE trigger |
| Conflict prevention | Unique certificate, nonce, claim, idempotency and transaction hashes | Same unique/FK/CAS relationships; SQL `ON CONFLICT DO UPDATE` cannot replace envelope |
| Rollback | SQLite transaction rollback | PostgreSQL transaction rollback and automatic advisory-lock release on commit/rollback/disconnect |
| Downgrade | Existing history unchanged | Refuses any populated application table; only empty isolated installation can downgrade |

Example: a writer holds the authority lock, advances state version1 to2, commits;
a second writer then acquires the lock and reads version2, so an expected-version1
write refuses with CONFLICT. A connection lost before commit rolls back its changes
and releases the lock. Once committed, an execution envelope remains immutable
across new connections; conflict/update/delete/truncate cannot erase its bytes.

All table names, canonical JSON payloads, money units, SHA-256/Ed25519 formats,
EVM encoding, public schemas, session/CSRF behavior, planner/verifier/executor
boundaries remain unchanged. **Public API stays v1.1.0**. Regenerate OpenAPI/TS
and require no drift; database revision `pg0460000001` is a private storage version,
not a new certificate/public contract version.

## Isolation and connection requirements

`app.db.postgres.make_postgres_engine` is additive and used only by the proposed
PG migration/tests in this PR. It uses psycopg3, a two-connection bounded pool,
READ COMMITTED, a private search path, parameter hiding and connection preflight.
Remote connections require `sslmode=verify-full` and a trusted CA. Use a direct
connection or Supabase **session** pooler on port5432; port6543 transaction pooling
is refused. Prepared statements are disabled. Never put the URL/password on Vercel,
in browser code, logs, prompts or GitHub.

Every future trusted writer and evidence-sensitive authority reader must call
`acquire_authority_lock(session)` **before** loading state/policy/approval/audit.
The shared lock ID is `0x50524f4f464649`; it is transaction-scoped, not a session lock.
The lock timeout is10s. READ COMMITTED is mandatory so reads after acquiring a
contended lock see the preceding commit. Repeatable-read is refused. No automatic
transaction retry may repeat signing or dispatch. The new helper also preserves
SQLite BEGIN IMMEDIATE for later consumer integration.

This retains the approved single-user serialized authority model. It does not
claim protection against a compromised backend/database owner that can drop
triggers or bypass the cooperative lock.

## Private database surface

The Supabase project should have Data API disabled and no frontend database keys.
Migrations create only `prooffi_private`, revoke PUBLIC access, explicitly revoke
schema/table/function access from Supabase anon/authenticated/service_role where
present, and enable RLS without policies on application tables. FastAPI connects
server-side as the schema owner; Supabase Auth is not substituted for the existing
authenticated demo session. No tables are added to an exposed public schema.

The app's current database is not moved or discarded. A fresh cloud installation
will run the unchanged idempotent $12,000 baseline seed only after reviewed runtime
integration. No silent import of private SQLite DBs, funded state, confirmed policy,
simulation probabilities, certificate history, wallet keys or signed transactions.
Existing SQLite migrations and private journal triggers are untouched.

## Verification and rollout gates

Real tests live in `services/api/postgres_tests`, separately from the ordinary
SQLite suite. `PROOFFI_TEST_POSTGRES_URL` is mandatory; missing infrastructure fails
instead of skipping. Each test creates/drops its own uniquely named database on a
dedicated loopback test server. This suite must never target Supabase or user data.

```sh
PROOFFI_TEST_POSTGRES_URL=postgresql+psycopg://prooffi_test@127.0.0.1:15446/postgres .venv/bin/python -m pytest services/api/postgres_tests -q
npm run check
```

PostgreSQL CI runs an isolated Postgres17 service. Actual SQL tests cover fresh
migrations/schema drift/all FKs, baseline hash/idempotency, API-role denial, BYTEA
bounds/hash shape, claim/journal uniqueness, immutable SQL/upsert/truncate behavior,
empty/populated downgrade, writer contention/stale-CAS, connection-crash rollback
and transaction-lock release. These are storage tests with explicit opaque fixtures;
they do not claim an integrated PostgreSQL executor, valid transaction signing or
live-chain acceptance.

Owner/lead review and current Ubuntu/Windows/PostgreSQL CI precede merge. Then
[#120](https://github.com/akiibot/proofFi/issues/120) adapts runtime consumers, tests
the complete independent execution/reconciliation lifecycle and actual crash/retry
boundaries, and prepares exact Supabase/Render configuration for review. Production
execution stays disabled until that separate reviewed gate passes. Any policy or
probability selection and any new transfer still require their exact authorization.

The single remaining migration/deployment checklist is maintained in
[#119](https://github.com/akiibot/proofFi/issues/119); this document is the proposed
contract, not a second completion checklist.

## Initial local evidence

Thirty real PostgreSQL14.19 storage tests passed on a newly initialized, dedicated
loopback cluster. A separate actual stop/start of that isolated server preserved
the exact canonical baseline snapshot/hash and inactive policy. The existing full
check passed628 SQLite backend tests, contracts, lint, types and web build; its local
browser phase refused the owner's occupied port3000, which was left untouched.
Current hosted Ubuntu/Windows and PostgreSQL17 CI remain merge gates. No Supabase
migration, runtime switch, signer setup or financial action is claimed by this local
evidence. Supabase project provisioning is independent of contract acceptance.
