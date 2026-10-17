# API contract and operating behavior

Pydantic in `services/api/app/models/contracts.py` is canonical. The HTTP inventory
below corresponds to `contracts/openapi.json` version 1.1.0. Browser types in
`apps/web/src/lib/schema.d.ts` are generated with `npm run contracts`; never edit
generated files manually or create competing client schemas. This document does
not change request/response shapes or activate a declared route.

## Endpoint inventory

“Implemented” means a handler exists, not that every runtime prerequisite is
configured or every product acceptance gate has passed. This inventory starts
from reviewed main 9e6d75b; pending integrations are labeled explicitly.

| Method | Path | Operation ID | Behavior / gate |
|---|---|---|---|
| POST | `/approvals` | `approve_action` | Implemented; authenticated domain operation |
| GET | `/audit` | `audit` | Implemented; authenticated domain operation |
| POST | `/auth/login` | `login` | Public login; trusted Origin and credentials required |
| POST | `/auth/logout` | `logout` | Authenticated logout; Origin/CSRF required |
| GET | `/auth/session` | `session_info` | Authenticated session/CSRF metadata |
| GET | `/certificates/{id}` | `get_certificate` | Implemented; authenticated domain operation |
| POST | `/certificates/{id}/verify` | `verify_certificate` | Implemented; authenticated domain operation |
| GET | `/chain/status` | `chain_status` | Implemented read-only chain/token/wallet checks; READY does not authorize execution |
| POST | `/constitutions/confirm` | `confirm_constitution` | Implemented; authenticated domain operation |
| GET | `/constitutions/drafts` | `list_drafts` | Implemented; authenticated domain operation |
| POST | `/constitutions/drafts` | `create_draft` | Implemented; authenticated domain operation |
| GET | `/constitutions/history` | `constitution_history` | Implemented; authenticated domain operation |
| POST | `/demo/attack` | `attack` | Implemented controlled demo proposal/verifier/executor-claim rejection; demo/auth/configuration required |
| POST | `/demo/emergency` | `emergency` | Implemented; demo-only, exact current state and confirmed chain/token policy; new-recipient proposals retain exact approval requirement |
| POST | `/demo/reset` | `reset` | 501 NOT_IMPLEMENTED (PF-028) |
| POST | `/execute` | `execute_action` | Implemented; default-off operator enablement plus independent exact authorization required |
| GET | `/financial-state` | `financial_state` | Implemented; authenticated domain operation |
| GET | `/health` | `health` | Implemented; database migration check |
| POST | `/intent/parse` | `parse_intent` | Implemented; authenticated domain operation |
| POST | `/optimize` | `optimize_action` | Implemented; authenticated domain operation |
| POST | `/plans/generate` | `generate_plans` | Implemented; authenticated domain operation |
| POST | `/simulate` | `simulate_action` | Implemented; authenticated domain operation |
| POST | `/verify` | `verify_action` | Implemented; authenticated domain operation |
| POST | `/workflows/goal` | `run_goal` | 501 NOT_IMPLEMENTED (PF-016) |

Complete field constraints, error models and examples belong to the generated
contract and `contracts/` fixtures. Fixtures describe shape; their addresses,
metrics and hashes are not active configuration or live acceptance evidence.
`TrustedSimulationInput` is internal-only and is not a public mutation body.

## Authentication and transport

`/health` and `/auth/login` are public; domain operations require the backend
session cookie. POST domain mutations and logout also require an exact trusted
Origin and matching `X-CSRF-Token`. Obtain CSRF metadata from login/session; never
print, publish or persist session credentials as public evidence. The Next proxy
forwards only its explicit allowlisted methods/paths and cookie/origin/CSRF, never
a frontend backend key or arbitrary claimed user identity. See
[AUTHENTICATION.md](AUTHENTICATION.md). Session identity does not confirm a policy,
approve a certificate or authorize a replacement transaction.

The local API is configured through private server settings. Run the normal
repository bootstrap/dev flow or the recorded isolated demo launcher; do not load
backend signer/provider secrets into the Next/browser environment. Public-mode
hosting requires HTTPS origins and Secure cookies. Backend sessions and throttles
are process-local; restart revokes sessions and resets limits.

## Financial action sequence

1. Parse a goal or request candidate proposals. Planner reasoning is explicitly
   untrusted; malformed provider output and ambiguous goals do not fabricate plans.
2. `/simulate` and `/optimize` accept only a candidate. The backend reloads current
   snapshot, confirmed Constitution and exactly one explicit trusted configuration.
   An optimizer proposal is neither a certificate nor a reserved nonce.
3. `/verify` independently recomputes policy/simulation. DENY creates no certificate;
   a passing/requires-approval result may issue a short-lived exact transaction
   certificate after trusted live-chain checks.
4. `/approvals` records one final authenticated decision for that certificate/action.
   It cannot override a hard policy failure. A new decision requires a fresh
   certificate; no blanket future-recipient or future-action consent is inferred.
5. `/execute` accepts certificate ID, action digest and a stable idempotency key,
   not replacement transaction fields. Operator enablement defaults off. Execution
   independently validates and claims authority, signs once, stores exact bytes
   before dispatch, and reconciles its known hash. Retry only the existing identity;
   never construct a new key to work around pending/stranded attempts.
6. A confirmed receipt applies the synthetic ledger effect once. PENDING is not
   proof of successful broadcast, and CONFIRMED is not irreversible finality.
   Preserve visible failure/reorg/recovery errors and use the recorded recovery
   procedures rather than modifying claims or balances directly.

`/certificates/{id}/verify` is an authenticated status check of the stored artifact;
its public-facing UI/verifier work is tracked separately. Historical payload
signature, current validity, approval requirement and execution outcome are
separate facts. `/audit` exposes linked domain events, not an administrator-proof
log or private signed transaction export.

## Units and explicit errors

Money `_minor` is integer USD cents; EVM integers are decimal base-unit strings;
probabilities are integer basis points; addresses are canonical lowercase and
timestamps timezone-aware UTC. Public model properties are restricted by the
canonical schemas. Callers cannot supply trusted risk metrics, policy versions,
private keys, approved actors or execution flags as authority.

Errors use `ApiError` (`code`, `message`, `reasons`). Schema mismatch returns 422
VALIDATION_ERROR without echoing raw input. Missing/expired/revoked sessions return
401; Origin/CSRF failure 403; throttling 429; conflicts/stale artifacts commonly
409; unimplemented features 501 NOT_IMPLEMENTED; unavailable configuration or
services commonly 503. Policy denial and execution failures are explicit domain
errors, never a fabricated PASS, receipt or hash. Consult each operation's actual
response and authoritative refreshed state before retrying an ambiguous mutation.

A successful HTTP response is not necessarily a safe or executed action: inspect
optimizer status, policy decision, certificate status and execution status. Test
fixtures, hypothetical seeded calculations and real chain receipts have distinct
evidence scopes. See [SIMULATION_METHOD.md](SIMULATION_METHOD.md),
[THREAT_MODEL.md](THREAT_MODEL.md) and
[LIVE_EXECUTION_ACCEPTANCE.md](LIVE_EXECUTION_ACCEPTANCE.md).
