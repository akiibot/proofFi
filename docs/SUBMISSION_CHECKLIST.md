# Submission checklist

FinTechathon 2026 International Track. Deadline: **20 October 2026, 23:59 Beijing time (UTC+8)**, which is 15:59 UTC and 21:59 in Dhaka. Submissions can be updated until then; aim to submit by the afternoon. Tick an item only with a link to the actual artifact.

## Required deliverables

| Deliverable | Rule | Source in this repo | Status |
|---|---|---|---|
| Technical documentation | Architecture, core algorithm, security design | docs/ARCHITECTURE.md, RISK_METHODOLOGY.md, CERTIFICATES.md, EXECUTOR_GUARDS.md, AUTHENTICATION.md | [ ] Assemble into one document |
| Presentation deck | Final presentation 10 minutes or less | docs/PRESENTATION_OUTLINE.md | [ ] Deck built |
| Demo video | Optional, 5 minutes or less | docs/DEMO_SCRIPT.md | [ ] Recorded; commit SHA: ______ |
| Source code | README, GitHub link, deployment instructions, test cases | README.md, services/api/tests, apps/web/e2e | [ ] Final commit tagged |
| Security self-assessment | Permission tiers and known-risk list | docs/KNOWN_LIMITATIONS.md, APPROVALS.md, EXECUTOR_GUARDS.md | [ ] Written as one report |
| Execution evidence | Topic F: real on-chain transaction hashes | evidence/ | [ ] Genuine Base Sepolia receipt recorded |

## Evidence to collect (see evidence/README.md)

- [ ] Real transaction hash, explorer URL, block and receipt, linked to its certificate ID
- [ ] Action Certificate JSON and the readable certificate screen
- [ ] Full audit export (Audit screen, Download JSON) with "Hash chain intact"
- [ ] Blocked malicious action: verifier DENY, signer not called, no transaction hash
- [ ] Emergency: new state version, old certificate SIGNED_BUT_STALE, recomputed safe amount
- [x] Screenshots of the live screens (evidence/screenshots/)
- [ ] Final `npm run check` (or each step on Windows) and browser suite output in docs/TEST_RESULTS.md

## Before pressing submit

- [ ] Every claim in the deck and video matches a live screen, a test or an evidence file
- [ ] No `.env`, demo password, cookie, private key or RPC URL in any file, screenshot or video frame
- [ ] Repository and video links open from a signed-out browser
- [ ] Team eligibility confirmed: 2-5 full-time students at universities outside Mainland China, Hong Kong, Macao and Chinese Taipei; at least 60% non-Chinese nationals
- [ ] Submission confirmation saved
