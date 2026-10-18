# ProofFi local-companion extension — #111 / #112

## Installation and review gates

This is an unlisted controlled Base Sepolia demo, not a production wallet. Requires the local Python backend and website. No content scripts, browsing history, injected wallet provider, analytics, remotely loaded executable code, mainnet or key custody in the extension.

Build with locked dependencies: npm ci, npm run build:extension, npm run test:extension. Package with .venv/bin/python scripts/package_extension.py. The reproducible ZIP contains only dist runtime. Unpack it, open brave://extensions or chrome://extensions, enable Developer mode and Load unpacked. Store submission is not performed or guaranteed.

Backend auth support is a separate draft contract PR #113. Do not activate before lead review. After review, explicitly add the installed 32-character extension ID to EXTENSION_IDS in the private backend .env and restart. This is opt-in; empty defaults deny. Never paste a password/key into GitHub. Sign in to the extension with your existing local demo password. The ID is public routing context, not a credential. Browser restart or backend restart requires sign-in again.

The single approved backend is http://127.0.0.1:8000; website links use http://127.0.0.1:3000. No arbitrary backend URL is accepted. Chromium host permissions apply to the loopback host, while the bundled worker pins the exact port. The required permissions are storage and sidePanel; host access is restricted to that loopback host. No browser account/cookies are read.

## Behavior and security

Popup Home shows actual synthetic balances, not an invented available amount. Plan passes only the entered goal into the persistent panel. Full policy, planning, simulation, verification, certificate, approval, execution, attack, emergency, audit and maintenance screens reuse the website React screens and typed models. Popup never renders financial confirmation controls.

The worker alone adds the opaque extension session/CSRF credential. Session storage is restricted to trusted extension contexts. Passwords are sent once to local authentication, never saved. Persistent local storage contains request identities and operation markers only, never session credentials. Requests are allowlisted by method/path and sender identity/document; no external messages or arbitrary URLs are supported.

Approval and execution have separate exact acknowledgements. Before sending execution, the worker durably preserves the original body; reopening restores that identity. Another body/key cannot replace it. Existing sends require a matching backend audit claim before reconciliation. Requests are serialized across panel/popup. Worker termination, browser closure and server/transport errors never automatically resend a mutation. Unknown approval/expense/reset/attack operations remain blocked for operator inspection; the extension does not implement advanced recovery #99 or silently clear uncertainty.

No new financial consent accompanies installing/opening the extension. All simulation distributions, safety checks, certificate expiry and backend execution guards remain authoritative. Store reviewers should use disposable test-only setup, not preserved real demo databases.

## Privacy/data-flow statement

The extension reads planning state, policy, certificates, audit records and testnet connection observations from the local companion after sign-in. Entered goals and candidates are sent only to that companion. In live planner mode the companion sends minimum planning context to its configured AI provider; the extension does not hold provider keys. The extension collects no browsing activity, site content, telemetry or analytics. It does not sync financial data or passwords. Theme preference stays locally in extension origin storage; the session credential stays in memory-backed Chrome session storage. Request identities persist locally to prevent duplicate actions. Browser uninstall removes extension storage; backend records follow the backend's retention behavior. Local host/extension compromise is outside these protections.

## Store submission checklist

- Lead-approved auth contract and configured final extension ID; revalidate the store-assigned ID.
- Passing exact-head CI, full combined checks and installed Chromium/Brave validation.
- Preserve installed-browser evidence: lost execution response, worker termination, matching-claim reconciliation, one fixture send and browser-restart logout. Existing shared website/financial regressions remain mandatory.
- Release ZIP/hash, 16/48/128 icons, 1280x800 or 640x400 store screenshots.
- Publish this accurate privacy statement at an owner-selected public HTTPS URL; add owner support/contact details and store disclosures.
- Unlisted controlled-demo listing describes local-companion requirement, Base Sepolia only and single-user boundary.
- Owner performs store/legal/account steps and submission. Publication, legal acceptance and future financial transactions are not authorized by this package.

Any missing checklist item remains a release blocker; a compiled ZIP is not store approval or full release acceptance.
