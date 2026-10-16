# Evidence

Foundation and feature validation is recorded in docs/TEST_RESULTS.md. **Real-chain evidence: NOT YET COMPLETED.** There is no genuine transaction hash, receipt or certificate yet, because `POST /verify` (PF-029) and `POST /execute` (PF-014/PF-015) are unfinished and no wallet is funded.

## What is here

`screenshots/` holds screens captured by the browser tests on 2026-10-16 against the isolated test database (`.local/e2e.db`):

| File | Shows | Notes |
|---|---|---|
| pf-018-desktop.png, pf-018-mobile.png | Dashboard with real state and chain status | Chain status is the real CHAIN_NOT_CONFIGURED |
| pf-018-login.png | Sign-in page | No password visible |
| pf-019-review.png, pf-019-active.png | Constitution draft review and the active version | Real backend |
| pf-021-time-machine.png | Time Machine result | Uses the labelled "E2E TEST FIXTURE" simulation config that exists only in the test database. Not approved assumptions; do not present as such. |
| pf-025-audit.png | Audit log with "Hash chain intact" | Events from the test run |

## Still required (PF-026/PF-028)

A real transaction hash with explorer URL, receipt and block; the Action Certificate JSON and readable view; a complete audit export; the blocked malicious action with no signer call; the emergency stale-certificate rejection; and screenshots of all three working scenarios. Never substitute a mock hash or an isolated chain-adapter test for live evidence. Remove secrets and authentication headers before publishing logs.
