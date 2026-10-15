# Foundation validation

Local validation on 2026-10-15 (user timezone Asia/Dhaka). This report concerns the foundation only; **AT-01..AT-12 are not passed**. See ACCEPTANCE_MATRIX.md.

| Command | Actual outcome |
|---|---|
| `python3.11 scripts/bootstrap.py` | PASS; locked install, migration, idempotent seed; existing state preserved |
| `.venv/bin/ruff check .` | PASS |
| `.venv/bin/pytest -q` | 20 passed; one upstream Starlette httpx deprecation warning |
| `npm run contracts` | PASS; generated OpenAPI and TypeScript |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; optimized Next.js production build |
| `npm run test:e2e` | 2 passed; actual browser -> Next read proxy -> FastAPI -> seeded SQLite |
| `.venv/bin/alembic check` | PASS; no new upgrade operations detected |
| `npm audit --audit-level=high` | PASS; zero vulnerabilities |
| `gh issue list ...` | 33 open issues; 28 blocked; 14 assigned to akiibot |

Backend coverage: migrations upgrade/downgrade/re-upgrade and drift, foreign keys/unique versions, idempotent seed, policy not autoactivated, immutable historical snapshot retention, stale version rejection, digest corruption detection, strict money inputs, rejection of authority-bearing extra properties, exact ERC-20 encoding and network, deterministic canonical hashing, conflicting counterparty lists, authentication, honest unfinished responses, no planner authority imports, acyclic complete backlog, environment chain parsing/mainnet rejection.

Browser coverage: real persisted amount and snapshot hash, inactive policy and unconfigured chain displayed, refresh available, mobile width without horizontal overflow, read proxy refuses arbitrary routes and mutations. Tests do not replace the backend or database with network fixtures.

Observed and repaired: initial bootstrap rejected string CHAIN_ID from .env; added exact testnet parsing and regression test. Initial schema-count assertion was off by one; corrected. npm lint dependency chain carried an advisory; replaced tooling dependency and confirmed clean audit. No checks were bypassed.

Fresh checkout validation: cloned committed foundation into a new temporary directory, ran bootstrap and the entire npm run check successfully (20 backend tests, 2 browser tests, lint/typecheck/build/contracts). Hosted CI status is available on PR #34; do not infer its outcome from local results. No transaction broadcast or live-chain verification was attempted.

Approval/ownership follow-up: `npm run check` rerun passed (20 backend tests, 2 browser tests, lint/typecheck/build/contracts). GitHub user lookup verified WasikZubair and Alfa5nm; write invitations remain pending. Actual assignee API responses omitted those handles, so assignment is explicitly pending.

## PF-012 certificate primitives

`npm run check`: PASS, 45 backend tests (25 new certificate tests), 2 real browser/API smoke tests, Ruff, frontend lint/typecheck, production build and contract generation. OpenAPI and generated TypeScript are unchanged. Red run: missing primitives and unfinished certificate verification caused expected failures before implementation. Green run covers explicit-key Ed25519 signing, documented signature wire format, unknown/wrong/relabelled keys, tamper/recomputed-hash forgery, exact expiry/future issue, nested mutation, action/config digest mismatch, invalid lifetime, authenticated stored reads, stale state/policy, prior claim, matching/wrong approval, corrupt trusted policy, malformed/missing keyring and no enabled issuance endpoint. One existing upstream Starlette/httpx deprecation warning remains.

No runtime signing key or product certificate was provisioned. Certificate/policy/approval records inserted in tests are explicitly isolated fixtures. No real chain operation and no full product acceptance gate is claimed.

## PF-030 isolated testnet signer and RPC adapter

`npm run check`: PASS, 72 backend tests (27 new adapter tests), 2 browser/API smoke tests, Ruff, frontend lint/typecheck/build and contract generation. OpenAPI/types unchanged. Initial red run: all 22 original adapter tests failed because signer/transport implementations did not exist; implementation made them pass, followed by additional transport/secret/receipt cases. Two upstream deprecation warnings (Starlette/httpx and web3's websockets legacy import) remain.

Signer tests use actual eth-account signing/recovery and decoded EIP-1559 bytes, including chain/sender/token/recipient/calldata/gas/fee/value/decimals rejection. Isolated RPC fixtures test wrong network, malformed bytes, independent destination validation, acknowledgement hash mismatch, ambiguous timeout with no retry, pending/reverted/confirmed/reorged receipts, wrong receipt hash and unavailable receipt handling. Real HTTPProvider construction is tested for bounded timeout and disabled retries. These fixture outcomes are not live chain evidence.

Separate read-only network probe: public https://sepolia.base.org returned HTTP 200 and eth_chainId=84532 on 2026-10-15. No private key, configured demo wallet, test token or approved destination was used; no transaction was broadcast. Live execution remains pending PF-014/PF-015 and real infrastructure.

## PF-033 authenticated sessions and browser boundary

`npm run check`: PASS, 89 backend tests (17 new session/security tests), 4 real browser/API tests, Ruff, frontend lint/typecheck/build and generated contracts. `alembic check`: no new operations (no migration change). Browser-bundle scan of 11 JavaScript assets found none of the actual local demo password, password hash or legacy API token. Actual values were not printed.

New tests cover HttpOnly/SameSite cookies, cookie-token omission from JSON, rejecting bearer/spoofed identity, missing/untrusted Origin, wrong passwords and login throttling, mandatory CSRF/Origin for mutations, logout/replay rejection, server-clock expiry, session-specific CSRF, missing configuration, non-ASCII CSRF rejection, public HTTPS/Secure-cookie settings, mutation rate limit and salted password verification. Four browser checks exercise the actual login/proxy/backend/database/logout flow without replacing backend responses.

A non-ASCII CSRF header initially caused TypeError in constant-time string comparison. The failing regression test demonstrated the exact root cause; comparing encoded bytes fixed it and the test now passes. Existing upstream Starlette/httpx and websockets deprecation warnings remain. Browser traces are disabled to avoid retaining entered credentials/session cookies.

HTTP API v1.1 adds auth routes/types and errors and replaces prototype bearer identity with sessions. Generated OpenAPI and TypeScript changed together; signed financial/state/transaction/certificate schema versions remain unchanged. The new contract is for lead review in a separate contract-change PR. No product certificate issuance, policy activation, human financial approval, on-chain execution or full acceptance-gate completion is claimed.

PF-033 fresh-checkout verification: cloned committed branch into a new temporary directory, bootstrapped locked dependencies/new owner-only credentials/migration/seed, ran the complete npm run check (89 backend tests and 4 browser tests), and confirmed regenerated OpenAPI/TS had no drift. All passed.

## PF-013 bound human decisions

`npm run check`: PASS, 113 backend tests (24 new approval tests), 4 real browser/API tests, Ruff, frontend lint/typecheck/build and contract generation. OpenAPI and generated TypeScript unchanged. Initial tests reproduced the unfinished approvals route; a later failing session-fingerprint assertion was resolved by trusted middleware provenance in the same-transaction audit event. A missing test import was corrected before rerunning the full checks. Two existing upstream deprecation warnings remain.

Tests exercise real session-protected API, migrated SQLite and Ed25519 fixtures: exact certificate/action/state/policy/actor binding, deny permanence, duplicate/concurrent decisions, missing/tampered/expired/stale/spent certificates, unavailable verifier keys, actor/state injection, missing session/CSRF, current hard asset/recipient/funding restrictions, unneeded approval refusal, immutable signed payload, no execution/consumption, atomic decision/audit rollback, sequential audit hashes and session fingerprint without raw-cookie exposure. Concurrent HTTP requests create exactly one decision.

Fixtures do not establish real policy/risk compliance or chain evidence. No trusted issuance, signer or broadcast is enabled; consumption remains the independent executor's responsibility. Full workflow audit coverage and full-chain verification remain PF-016. No product acceptance gate is newly claimed passed.
