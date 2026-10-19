# Vallet contextual companion — interactive preview QA

Date: 2026-10-19. Issue #136 / draft PR #141. Review candidate, not release approval.

## Passed

- Running website at 127.0.0.1:3000: existing local demo sign-in, Home/Ask/Rules/Activity/Security navigation, readable confirmed-policy/history controls, browser audit integrity, explicit logout and sign-in restoration. No policy, expense, reset, attack or transaction was submitted in the interactive preview. Missing token/recipient configuration produced a clarification instead of a fabricated planning result; the UI explicitly labelled deterministic demo mode.
- Real running-backend research request using public synthetic test context: Wigolo returned five attributed sources with financial_authority=false. Missing consent, oversized text, private source URL and an injected approval field each returned 422. Financial state and audit snapshots were identical before and after these requests.
- Repeated installed Chromium acceptance on a separate test-only port: all 18 checkpoints passed. Real financial engines and verifier, disposable database, synthetic page and simulated RPC only. Covers no-safe baseline, funded next-cent boundary, emergency repricing, stale certificate, hard-denied borrowed-funding attack, DOM/form exclusion, SPA invalidation, unprivileged content script refusal, research-only products, non-recording bill drafts, separate approval, popup/panel lifecycle, themes and restart. Response loss + worker termination + panel closure reconciled the same request with one simulated send.
- The test runner can bind an isolated test proxy to VALLET_TEST_BACKEND_PORT. Only the disposable built test copy is rewritten; the production loopback transport stays pinned to port 8000. This leaves the user's interactive preview available during acceptance.

## Open findings — resolve before final acceptance

1. **Home overstates financial safety.** With active rules, the unchanged baseline shows Free to work with -$200 but headlines “Your tuition is safe.” Home's predicate compares current eligible liquidity only with protected obligations/reserve and ignores upcoming living costs. That headline is not an optimizer/verifier result. Use a clear shortfall/needs-attention headline and describe current protection without promising future funding. The real optimizer's no-safe result remains enforced; this test did not change financial logic.
2. **Security copy misrepresents the fixture.** “Try to trick the AI” / “We feed the AI a scam message … It will probably fall for it” describes live model behaviour, although the attack is a controlled fixed proposal sent to real safety checks. Label the controlled malicious-proposal fixture accurately, retain its exact $4,000 borrowed-funds content and show actual verifier/executor evidence. Do not claim a successful live prompt-injection attack.

These are reproduced website-copy findings also relevant to the shared extension screens. They are recorded for the UI/foundation review; no financial rules were altered to hide them. Browser title still says ProofFi while the visible brand says Vallet; branding metadata remains a separate polish item.

## Limits

A separate headed-Brave test launch was rejected by automatic approval review with “blocked by policy”; no more specific reason was returned. It was not counted as passed, and the rejected action was not retried by another route. Earlier Brave headless smoke remains separate historical test evidence. The current interactive test used the supported in-app browser and the existing running preview; complete headed-Brave and production optional-permission grant/denial/revocation acceptance remain outstanding. Automated extension fixtures pregrant only their synthetic origin and do not establish acceptance of the production permission dialog. Current Linux/Windows CI and lead contract/security review remain required.

No genuine chain transfer, mainnet action, new approved financial assumption or modification of film evidence occurred. Screenshots and raw local test results are held outside the tracked repository in the local QA artifact directory.
