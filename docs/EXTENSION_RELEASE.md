# Vallet contextual companion — development integration

This issue-scoped refresh reuses #111/#115 and #112/#116 companion transport and replaces obsolete page imports with current merged website screens. The popup is 380px; financial confirmations stay in the panel. Backend port is pinned to 127.0.0.1:8000 and full workspace to 127.0.0.1:3000. Never point it at the filming database.

The refreshed extension auth contract is a separate prerequisite branch/PR. Empty EXTENSION_IDS fails closed. Loading an unpacked development build does not approve authentication or signing. Configure only its actual extension ID in an isolated test backend after review.

Current screens: Home, Ask/Futures, Rules/history, certificate review, Activity/story/checker, Security, Settings/readiness/workflow preparation/guarded reset. Approve exact action and Execute exact transaction are separate controls. Existing backend verification, claim, signer and ledger remain authoritative. Uncertain operations preserve original identities and never automatically resend.

Build: npm ci; npm run build:extension; npm run test:extension; npm run lint:extension. Installed acceptance is updated in the release QA slice before claiming release readiness. No store submission, real transaction or policy activation is performed by build/testing.

This is a controlled local companion, not a browser-wide wallet guard. Later context permission/data-flow changes require separate privacy/security review.
