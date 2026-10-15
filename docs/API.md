# API contract v1.1 (PF-033 review)

Canonical Python: `services/api/app/models/contracts.py`. HTTP contract: `contracts/openapi.json`. Generated browser types: `apps/web/src/lib/schema.d.ts`; typed client: `apps/web/src/lib/api.ts`. Run `npm run contracts`, never manually edit generated files. Trusted internal simulation input is exported separately and is not a public route body.

Currently implemented: `GET /health`, authenticated `GET /financial-state`, `GET /constitutions/drafts`, `GET /audit` (empty until events exist), `GET /chain/status` (honest CHAIN_NOT_CONFIGURED). Certificate reads and integrity/status checks are implemented by PF-012. Every other remaining declared route returns `501 NOT_IMPLEMENTED` with the responsible PF issue. Authorization happens before feature entry. Input schema errors use `422 VALIDATION_ERROR` without echoing raw input. DB errors use `503 UNAVAILABLE`. Missing/expired/revoked cookie sessions use `401 UNAUTHORIZED`. Origin/CSRF rejection uses `403 FORBIDDEN`; throttling uses `429 RATE_LIMITED`.

```json
{"code":"NOT_IMPLEMENTED","message":"Feature awaiting PF-014; no action performed","reasons":[]}
```

Public route shapes:

| Route | Request | Response | Owner issue |
|---|---|---|---|
| POST /intent/parse | IntentRequest | ParsedIntent | PF-017 |
| POST /plans/generate | IntentRequest | PlanResponse | PF-017 |
| POST /constitutions/drafts | DraftRequest | ConstitutionDraft | PF-006 |
| POST /constitutions/confirm | ConfirmRequest | ConstitutionVersion | PF-006 |
| GET /constitutions/history | — | ConstitutionVersion[] | PF-006 |
| POST /simulate | ActionRequest | SimulationRun | PF-009 |
| POST /optimize | ActionRequest | OptimizerResult | PF-010 |
| POST /verify | ActionRequest | VerificationResult | PF-029 |
| GET /certificates/{id} | — | ActionCertificate | PF-012 |
| POST /certificates/{id}/verify | — | CertificateStatus | PF-012 |
| POST /approvals | ApprovalRequest | Approval | PF-013 |
| POST /execute | ExecuteRequest | Execution | PF-014/015 |
| POST /workflows/goal | IntentRequest | WorkflowResult | PF-016 |
| POST /demo/attack | — | AttackResponse | PF-031 |
| POST /demo/emergency | EmergencyRequest | EmergencyResponse | PF-032 |
| POST /demo/reset | — | FinancialState | PF-028 |

Only schema-valid proposals enter services. They still require actual policy/chain authorization. `ExecuteRequest` references the stored exact transaction rather than accepting a replacement transaction. Never accept a client `verified`, risk metrics, private keys, approval actor or simulated configuration as trusted input. Unrecognized properties are rejected.

Amounts `_minor` are integer cents, bounded below JS safe-integer range. EVM base-unit integers are decimal strings; addresses canonical lowercase. Probabilities are integer basis points (10000 = 100%). Simulations must document conversion/rounding. Dates are timezone-aware ISO UTC. Shape fixtures are under contracts; no fixture address is configured for live use.

PF-033 adds POST /auth/login, GET /auth/session and POST /auth/logout. All domain routes require the session cookie; POSTs also require trusted Origin and matching X-CSRF-Token. The explicit Next proxy forwards only cookie/origin/CSRF, never a backend credential or arbitrary identity headers. See AUTHENTICATION.md for setup and deployment limits. The session establishes identity; financial consent remains explicit and separately bound.
