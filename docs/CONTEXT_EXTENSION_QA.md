# Vallet contextual companion — interactive preview QA

Date: 2026-10-19. Issue #136 / draft PR #141. Review candidate, not release approval.

## Passed

- Running website at 127.0.0.1:3000: existing local demo sign-in, Home/Ask/Rules/Activity/Security navigation, readable confirmed-policy/history controls, browser audit integrity, explicit logout and sign-in restoration. No policy, expense, reset, attack or transaction was submitted in the interactive preview. Missing token/recipient configuration produced a clarification instead of a fabricated planning result; the UI explicitly labelled deterministic demo mode.
- Real running-backend research request using public synthetic test context: Wigolo returned five attributed sources with financial_authority=false. Missing consent, oversized text, private source URL and an injected approval field each returned 422. Financial state and audit snapshots were identical before and after these requests.
- Repeated installed Chromium acceptance on a separate test-only port: all 18 checkpoints passed. Real financial engines and verifier, disposable database, synthetic page and simulated RPC only. Covers no-safe baseline, funded next-cent boundary, emergency repricing, stale certificate, hard-denied borrowed-funding attack, DOM/form exclusion, SPA invalidation, unprivileged content script refusal, research-only products, non-recording bill drafts, separate approval, popup/panel lifecycle, themes and restart. Response loss + worker termination + panel closure reconciled the same request with one simulated send.
- The test runner can bind an isolated test proxy to VALLET_TEST_BACKEND_PORT. Only the disposable built test copy is rewritten; the production loopback transport stays pinned to port 8000. This leaves the user's interactive preview available during acceptance.

## Earlier copy findings — resolved in the PF-133 follow-up

1. **Home overstates financial safety.** With active rules, the unchanged baseline shows Free to work with -$200 but headlines “Your tuition is safe.” Home's predicate compares current eligible liquidity only with protected obligations/reserve and ignores upcoming living costs. That headline is not an optimizer/verifier result. Use a clear shortfall/needs-attention headline and describe current protection without promising future funding. The real optimizer's no-safe result remains enforced; this test did not change financial logic.
2. **Security copy misrepresents the fixture.** “Try to trick the AI” / “We feed the AI a scam message … It will probably fall for it” describes live model behaviour, although the attack is a controlled fixed proposal sent to real safety checks. Label the controlled malicious-proposal fixture accurately, retain its exact $4,000 borrowed-funds content and show actual verifier/executor evidence. Do not claim a successful live prompt-injection attack.

Both findings are now fixed in the shared website/extension screens. Home reports the actual shortfall without a safety promise; Security labels the controlled fixture and limits the result to returned certificate/signer/hash evidence. New browser assertions cover both. No financial rule or public contract changed. Browser title still says ProofFi while the visible brand says Vallet; branding metadata remains a separate polish item.

## Limits

A separate headed-Brave test launch was rejected by automatic approval review with “blocked by policy”; no more specific reason was returned. It was not counted as passed, and the rejected action was not retried by another route. Earlier Brave headless smoke remains separate historical test evidence. The current interactive test used the supported in-app browser and the existing running preview; complete headed-Brave and production optional-permission grant/denial/revocation acceptance remain outstanding. Automated extension fixtures pregrant only their synthetic origin and do not establish acceptance of the production permission dialog. Current Linux/Windows CI and lead contract/security review remain required.

No genuine chain transfer, mainnet action, new approved financial assumption or modification of film evidence occurred. Screenshots and raw local test results are held outside the tracked repository in the local QA artifact directory.


## Real public-site follow-up

Direct anonymous navigation and installed-extension capture were tested against actual pages, without response substitution or account login. iShares IVV was recognised as investment context, captured 5,690 selected characters and returned five attributed research sources. Spotify Premium was recognised as an expense/subscription, captured 4,286 selected characters and produced an editable, non-recording draft. A fresh Spotify capture did not carry over the previous fund's research opt-in (zero external sources requested).

| Page | Final installed-browser result |
| --- | --- |
| iShares IVV | Capture and analysis succeeded; five unverified research sources |
| Spotify Premium | Capture and analysis succeeded; subscription draft remains non-recording |
| Vanguard VOO | No readable visible text in this browser session; explicit manual public-text guidance |
| Fidelity funds | Browser HTTP/2 connection error; no invented analysis |
| Adobe plans | HTTP 403 access denial; not bypassed |
| Schwab SCHX | HTTP 403 access denial; not bypassed |
| Investor.gov fee glossary | HTTP 403 in installed browser, despite public HTTP retrieval through Wigolo; not counted as browser success |

Wigolo could retrieve public snapshots/metadata from all seven URLs, but these are different observations from installed-browser DOM capture and do not turn restricted browser cases into passes. No historical return series, suitability verdict, cohort statistics or purchase capability was invented.

The capture follow-up supports bounded visible leaf/semantic content outside standard main wrappers and open shadow roots. Forms, explicitly private content and hidden text remain excluded. Closed/unsupported embedded views are not bypassed. Recurring prices require a subscription cue for classification. Every new capture clears previous research opt-in/product name, bill fields and candidate consent. The manual command `npm run test:sites -w @prooffi/extension` produces a network-dependent coverage report in a disposable profile/database with signing disabled; partial coverage is explicitly labelled.

Validation: 676 backend tests passed; lint/types/build/contracts passed. The first port-isolated browser run failed its two tracked-file canary checks because the verification copy lacked its own Git inventory, then refused to replay its already-mutated financial fixture on restart as designed. After using the original read-only Git inventory with the disposable copy, all 112 browser tests passed, including the unchanged canary checks. The source financial assertions were not weakened. Extension build/lint, 14 unit tests and all 19 installed Chromium checkpoints passed, including unstructured/open-shadow capture, hidden/private/form exclusion and clearing research consent on a new page. The copy-only verification used ports 3300/8300 to preserve the visible preview at 3000/8000.

The visible local preview's research allowlist now includes the seven tested official source domains; signing remains disabled. Financial state/audit compared equal across its configuration restart. Restart revoked sessions normally; the existing preview password is unchanged. Current Linux/Windows CI, lead review and interactive Brave permission acceptance remain outstanding. Direct Brave launching/control was also rejected by automatic approval review with only “blocked by policy”; no claim of successful live Brave automation is made.
