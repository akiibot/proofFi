# Vallet contextual companion — review candidate 0.1.0

This is an unlisted local Base Sepolia demonstration companion, not a production wallet or a store submission. Authentication, page-analysis and permissions changes require lead review before operator enablement. No mainnet, external-wallet injection, arbitrary website transaction interception or new live transfer is included.

## Build and install

Use the repository Node/Python versions and bootstrap instructions. Run `npm ci`, `npm run build:extension`, `npm run lint:extension`, `npm run test:extension` and `npm run test:installed -w @prooffi/extension`. Run `python scripts/package_extension.py` for a sorted, fixed-timestamp ZIP containing only built runtime files. Repeating packaging of the same build must produce the same SHA-256. Unzip into a stable local directory; in Brave/Chrome extensions enable Developer mode, choose Load unpacked, and select that directory. Keep the directory in place; its path determines an unpacked extension's ID. Do not install test manifests from fixture/profile directories.

The worker pins the backend to http://127.0.0.1:8000 and the full workspace to http://127.0.0.1:3000. The loopback host permission cannot restrict ports; the worker enforces the exact approved origin. This candidate does not provision a backend or copy private configuration. After security review, configure the installed extension's actual ID in EXTENSION_IDS on a **separate disposable backend**, migrate/seed that disposable database, and configure its own demo password. Empty EXTENSION_IDS rejects extension login. Never point this companion at the filming database or copy cookies/keys from it. Backend restart revokes sessions.

Open Vallet, sign in, then open the persistent side panel for financial review. Home shows synthetic finances separately from chain observations. Ask/Futures, Rules/history, Activity/story/checker, Security, Settings/readiness/workflow preparation and guarded reset reuse current website capabilities. See EXTENSION_ENDPOINT_MATRIX.md for all operations.

## Context and permissions

Without broad site access, click Vallet on a public page and choose Inspect this page for active-tab capture. Optional Enable page detection explicitly requests HTTP/HTTPS site access. Recognition and the quiet badge are local; page content is not uploaded by opening a tab. Turn off revokes these optional permissions. Browser-internal pages and unsupported frames are unavailable.

Review the redacted title and excerpt, remove remaining private information, then explicitly select Analyse this page. Redaction is heuristic, not a guarantee. Form values are excluded. Source URLs lose query strings/fragments; paths may still contain private information and must be reviewed. Only this selected context goes to the local backend. Optional external research has a separate checkbox and public product-name field; only that name is sent to search providers through Wigolo. No automatic background research occurs.

Understand shows attributed page claims; Evidence distinguishes unverified search excerpts, dates and unavailable metrics. No invented historical return charts, cohort statistics, Trustpilot score or financial safety score is supplied. Unsupported products stay research-only. For me can check an independently entered supported demo allocation, with explicit acknowledgement that it is not a purchase of the researched product. Bill drafts are editable but cannot be recorded until a separate backend contract exists; arbitrary bills never invoke the fixed emergency demo.

## Wigolo operator setup

Wigolo is a separate local service, not bundled browser code. The tested runtime is wigolo@0.2.1: install in a separate runtime directory, then run `node node_modules/wigolo/dist/index.js serve --host 127.0.0.1 --port 3333`. Inspect upstream service and source-provider terms before release. On the disposable backend set WIGOLO_ENABLED=true, WIGOLO_URL=http://127.0.0.1:3333 and an explicit RESEARCH_DOMAINS JSON list of approved public source domains. Defaults disable research. Missing source access, oversized responses and provider/deadline failures return explicit unavailability. Search excerpts are evidence to inspect, never transaction authority.

## Data flow and interrupted operations

The service worker owns authenticated backend calls. Opaque credentials and CSRF exist only in trusted-context chrome.storage.session; passwords are not saved. Extension-local storage retains necessary operation identities and ambiguity markers, not authority. Page observations/previews stay in session storage. Content scripts cannot call financial APIs or access the credential transport. No browsing-history permission, remote executable code or external messaging handler is present.

Approve exact action and Execute exact transaction are separate controls. Opening the panel never carries checked consent. An uncertain financial operation keeps its original certificate/action/idempotency identity; use the explicit same-attempt control and current audit/state. Never create a replacement identity or automatically resend on reopen. Closing the popup, worker termination and browser restart cannot authorize a second send. Backend signer, independent verifier and current state/policy checks remain authoritative.

## Validation and remaining gates

Local Linux repository check passed: 675 backend tests and 112 website browser tests, plus lint/types/build/contracts. The subsequent total-deadline regression passed in a 14-test focused research run. The installed Chromium suite covers 17 checkpoints including baseline refusal, funded fixture boundary, emergency repricing, stale authority, attack rejection, content isolation, separate consent and lost-response recovery with exactly one simulated RPC send. Separate actual Brave headless smoke checked installation, page capture and light/dark presentation. Real Wigolo search returned five attributed investor.gov results. These are isolated fixture/browser observations, not genuine new chain transfers.

Current CI on both Linux and Windows, lead security/contract acceptance, interactive optional-permission grant/denial/revocation acceptance and a headed Brave operator run remain release gates. The automated test installation pregrants only its synthetic fixture origin; it does not establish acceptance of the production permission prompt. The Brave smoke does not establish the entire financial journey on Brave. Do not claim store readiness or close the issues before these gates pass. Existing historical receipts remain separate evidence.
