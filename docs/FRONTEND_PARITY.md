# Frontend endpoint parity — #109

Baseline: main d448839; 24 HTTP operations. Appearance does not establish financial authority.

| Method | Endpoint | UI owner | Access | Failure behavior |
|---|---|---|---|---|
| POST | `/approvals` | Certificates exact approval / denial | Session + Origin/CSRF | Explicit error; no fabricated success or automatic mutation retry |
| GET | `/audit` | Audit / certificate authority inspection | Session | Explicit error; no fabricated success or automatic mutation retry |
| POST | `/auth/login` | Login / shared session controls | Origin checked login | Explicit error; no fabricated success or automatic mutation retry |
| POST | `/auth/logout` | Login / shared session controls | Session + Origin/CSRF | Explicit error; no fabricated success or automatic mutation retry |
| GET | `/auth/session` | Login / shared session controls | Session | Explicit error; no fabricated success or automatic mutation retry |
| GET | `/certificates/{id}` | Certificates / Certificate verifier | Session | Explicit error; no fabricated success or automatic mutation retry |
| POST | `/certificates/{id}/verify` | Certificates / Certificate verifier | Session + Origin/CSRF | Explicit error; no fabricated success or automatic mutation retry |
| GET | `/chain/status` | Dashboard / Settings | Session | Explicit error; no fabricated success or automatic mutation retry |
| POST | `/constitutions/confirm` | Constitution | Session + Origin/CSRF | Explicit error; no fabricated success or automatic mutation retry |
| GET | `/constitutions/drafts` | Constitution | Session | Explicit error; no fabricated success or automatic mutation retry |
| POST | `/constitutions/drafts` | Constitution | Session + Origin/CSRF | Explicit error; no fabricated success or automatic mutation retry |
| GET | `/constitutions/history` | Constitution | Session | Explicit error; no fabricated success or automatic mutation retry |
| POST | `/demo/attack` | Red team | Session + Origin/CSRF | Explicit error; no fabricated success or automatic mutation retry |
| POST | `/demo/emergency` | Workspace emergency | Session + Origin/CSRF | Explicit error; no fabricated success or automatic mutation retry |
| POST | `/demo/reset` | Settings demo maintenance | Session + Origin/CSRF | Explicit error; no fabricated success or automatic mutation retry |
| POST | `/execute` | Certificates exact execution / reconciliation | Session + Origin/CSRF | Explicit error; no fabricated success or automatic mutation retry |
| GET | `/financial-state` | Dashboard / shared state | Session | Explicit error; no fabricated success or automatic mutation retry |
| GET | `/health` | Settings readiness | Public migration health | Explicit error; no fabricated success or automatic mutation retry |
| POST | `/intent/parse` | Workspace interpretation | Session + Origin/CSRF | Explicit error; no fabricated success or automatic mutation retry |
| POST | `/optimize` | Workspace safe amount | Session + Origin/CSRF | Explicit error; no fabricated success or automatic mutation retry |
| POST | `/plans/generate` | Workspace candidate planning | Session + Origin/CSRF | Explicit error; no fabricated success or automatic mutation retry |
| POST | `/simulate` | Time Machine | Session + Origin/CSRF | Explicit error; no fabricated success or automatic mutation retry |
| POST | `/verify` | Workspace verification | Session + Origin/CSRF | Explicit error; no fabricated success or automatic mutation retry |
| POST | `/workflows/goal` | Workspace complete preparation | Session + Origin/CSRF | Explicit error; no fabricated success or automatic mutation retry |

Regression source: retain existing 95 browser/API/proxy tests and AT01–12, add #109 endpoint inventory/theme/settings/workflow tests. New extension authentication is separate #110.
Baseline genuine A/B/C observations and screenshots remain in evidence/; use disposable test databases for new regression images, never reset the preserved originals.

Visual references: [Quicken](https://mobbin.com/screens/36ad4ca4-943e-4857-8e9a-ab5369a39d1c) and [Rocket Money](https://mobbin.com/screens/78a2221d-d03f-4775-bad6-675d3c59f246). Reference images are not product assets.
