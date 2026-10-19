# Extension endpoint-to-control coverage
#133 / #134 / #135 / #136. Generated operation inventory; controls retain their real backend guards.

| Method | Path | Operation | UI owner | Authentication and failure handling | Regression |
|---|---|---|---|---|---|
| POST | `/approvals` | `approve_action` | Review: Approve / Deny | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| GET | `/audit` | `audit` | Activity and explicit claim inspection | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| POST | `/auth/extension/login` | `extension_login` | Extension Sign in | Public health or bounded login | extension_auth + PF-033 |
| POST | `/auth/extension/logout` | `extension_logout` | Extension Settings: Sign out | Session; CSRF on POST; explicit failures | extension_auth + PF-033 |
| GET | `/auth/extension/session` | `extension_session` | Worker session guard | Session; CSRF on POST; explicit failures | extension_auth + PF-033 |
| POST | `/auth/login` | `login` | Sign in (website transport unchanged) | Public health or bounded login | existing backend/browser suites + installed financial journey |
| POST | `/auth/logout` | `logout` | Website sign out | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| GET | `/auth/session` | `session_info` | Website session guard | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| GET | `/certificates/{id}` | `get_certificate` | Review / Activity story | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| POST | `/certificates/{id}/verify` | `verify_certificate` | Review refresh / Activity certificate check | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| GET | `/chain/status` | `chain_status` | Home / Settings readiness | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| POST | `/constitutions/confirm` | `confirm_constitution` | Rules: explicit Activate | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| GET | `/constitutions/drafts` | `list_drafts` | Rules: saved draft | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| POST | `/constitutions/drafts` | `create_draft` | Rules: Review changes | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| GET | `/constitutions/history` | `constitution_history` | Rules / version history | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| POST | `/context/analyse` | `analyse_page` | This page: consented Analyse | Session; CSRF on POST; explicit failures | page_context + context installed |
| POST | `/demo/attack` | `attack` | Security: acknowledged Run test | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| POST | `/demo/emergency` | `emergency` | Home: acknowledged Record expense | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| POST | `/demo/reset` | `reset` | Settings: advanced acknowledged reset | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| POST | `/execute` | `execute_action` | Review: separate Execute / same-attempt check | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| GET | `/executions/{id}` | `get_execution` | Activity story: persisted observation | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| GET | `/financial-state` | `financial_state` | Home / planning context | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| GET | `/health` | `health` | Settings: backend readiness | Public health or bounded login | existing backend/browser suites + installed financial journey |
| POST | `/intent/parse` | `parse_intent` | Ask: Check it | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| POST | `/optimize` | `optimize_action` | Ask: Check it / exact amount | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| POST | `/plans/generate` | `generate_plans` | Ask: Check it | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| POST | `/simulate` | `simulate_action` | Ask: futures results | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| POST | `/verify` | `verify_action` | Ask: Continue with amount | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |
| POST | `/workflows/goal` | `run_goal` | Settings: Prepare evidence only | Session; CSRF on POST; explicit failures | existing backend/browser suites + installed financial journey |

Popup/panel transfers preserve proposal fields but never checked consent. Context scripts cannot call the API. No hypothetical provider/graph is counted as endpoint coverage. Installed Chromium pregrants only its disposable fixture host; actual optional-permission onboarding needs separate Brave evidence.


## Pairing contract (PF-144; separate security review)

| Operation | Control | Authentication and failures | Regression |
|---|---|---|---|
| `create_extension_pairing` | Extension login: Connect to local Vallet | Worker-only fixed backend; exact ID/origin; bounded unauthenticated creation | pairing backend + installed |
| `extension_pairing_status` | Extension login: explicit Resume checking, then 5s polling while open | Worker-only secret in session storage; expiry/restart stops | pairing backend + installed |
| `extension_pairing_details` | Local website: connection review | Website cookie only; expired session signs in and returns | pairing backend + installed |
| `approve_extension_pairing` | Local website: enter code and Allow this extension | Website cookie + CSRF; one use; no extension transport | pairing backend + installed |
| `extension_connections` | Website Settings: Connected extensions / Refresh | Website cookie only; last loaded values flagged on failure | pairing backend + installed |
| `revoke_extension_connection` | Website Settings: Revoke / Confirm revocation | Website cookie + CSRF; deny overrides configured IDs | pairing backend + installed |

Pairing uses dedicated worker messages, never the financial API message allowlist. Website-only management is intentionally refused by extension transport. A stable public manifest key fixes unpacked identity; it is not an authentication secret.
