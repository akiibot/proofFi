# API contract v1

Canonical Python: `services/api/app/models/contracts.py`. HTTP contract: `contracts/openapi.json`. Generated browser types: `apps/web/src/lib/schema.d.ts`; typed client: `apps/web/src/lib/api.ts`. Run `npm run contracts`, never manually edit generated files. Trusted internal simulation input is exported separately and is not a public route body.

Currently implemented: `GET /health`, authenticated `GET /financial-state`, `GET /constitutions/drafts`, `GET /audit` (empty until events exist), `GET /chain/status` (honest CHAIN_NOT_CONFIGURED). Every remaining declared route returns `501 NOT_IMPLEMENTED` with the responsible PF issue. Authorization happens before feature entry. Input schema errors use `422 VALIDATION_ERROR` without echoing raw input. DB errors use `503 UNAVAILABLE`. Missing/wrong backend bearer uses `401 UNAUTHORIZED`.

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

The foundation web proxy forwards only explicit read paths and never arbitrary headers, credentials, redirects or mutations. PF-033 must define authenticated browser session routes through a contract-change PR before writes. Local service bearer alone is not human consent.
