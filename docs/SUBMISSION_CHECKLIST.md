# MVP delivery evidence

For a concise reviewer path, start with the [submission guide](SUBMISSION.md), [test guide](TESTING.md), [deployment runbook](DEPLOYMENT.md) and [documentation index](README.md).

The remaining implementation/integration/evidence/owner decisions are tracked only in [PROGRESS.md](PROGRESS.md). This page indexes the delivery artifacts; it is not a second work checklist. Competition eligibility, upload permissions and final external submission remain owner responsibilities, outside the requested local MVP work.

| Deliverable | Actual artifact |
|---|---|
| Reproducible setup | README.md; evidence/acceptance-fresh-checkout.json; locked bootstrap, Ubuntu and native Windows full CI |
| Twelve acceptance gates | docs/ACCEPTANCE_MATRIX.md; docs/TEST_RESULTS.md; genuine A/B/C evidence separated from hermetic CI |
| Concise browser walkthrough | evidence/prooffi-browser-walkthrough.webm, 169.64s; evidence/current-walkthrough.json identifies reviewed source e45b095, original identity and unchanged originals |
| Presentation | docs/PRESENTATION_OUTLINE.md, <=10 minutes; docs/DEMO_SCRIPT.md, <4-minute walkthrough and <5-minute recording guidance |
| Genuine A certificate and receipt | evidence/base-sepolia-browser-certificate.json; evidence/base-sepolia-browser-execution.json; actual tx 0xd13c41c1141b22ab3604978582ee5643a06a9b83af360f8de8d76b7e46ad378d, Base Sepolia block 48253237 |
| Controlled B refusal | evidence/red-team-browser.json; evidence/current-controlled-rejection.png; no certificate, signer call or transaction |
| Genuine C state change | evidence/emergency-browser.json, emergency-certificate-stale.png; one expense, unchanged policy, stale old cert and reduced safe amount |
| Current screens and audit exports | evidence/current-*.png, current-hero-audit.json, current-emergency-audit.json; both chains independently recomputed |
| Safe reproducible reset | Existing authenticated demo route and guarded CLI; tests on temporary migrated databases only; any execution history refuses, no preserved runtime reset performed |
| Technical/security explanation | ARCHITECTURE.md, DECISIONS.md, RISK_METHODOLOGY.md, CERTIFICATES.md, EXECUTOR_GUARDS.md, AUTHENTICATION.md, KNOWN_LIMITATIONS.md |

The raw tour reconciles an already-confirmed original A claim on an inspection copy using actual read-only RPC, then performs nonfinancial replanning and controlled refusal on a C copy. It does not replay the original financial effects. Original browser execution/expense captures remain the evidence of those earlier exact-authorized actions. All delivered public metadata excludes private configuration, cookie/session tokens, private keys, raw signed transactions and credential-bearing RPC URLs. The video and public artifacts are separate from the ignored private databases and logs.
