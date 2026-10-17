# Presentation outline

Ten minutes or less, built around the International Track rubric: **task completion 40%**, **security and compliance 30%**, **innovation and interaction 30%**, plus the 0-5 on-chain challenge bonus for Topic F. Every claim on a slide must be backed by a live screen, a test or evidence in `evidence/`. Mark anything not yet live as such.

| # | Minutes | Slide | Content | Evidence to show |
|---|---|---|---|---|
| 1 | 0:00-0:45 | The problem | AI agents can now move money. Most agent stacks are `User -> AI -> Tool -> money`, with at most an "are you sure?" dialog. LLMs hallucinate and can be prompt-injected. | One sentence each; no stock imagery |
| 2 | 0:45-1:45 | The idea | "ProofFi separates financial intelligence from financial authority." The system that decides what to do is not the system that decides whether it may happen. | Architecture diagram from docs/ARCHITECTURE.md |
| 3 | 1:45-2:30 | Who it protects | Tania: $12,000, $7,000 tuition due in 120 days, $800 a month. Goal: invest without risking tuition. | Dashboard screenshot |
| 4 | 2:30-5:00 | Live demo | The walkthrough in docs/DEMO_SCRIPT.md, live or the recorded video | The app |
| 5 | 5:00-6:00 | Constitution and proof | Plain-language rules, explicit confirmation bound to a SHA-256 policy fingerprint, immutable history. Action certificates bind state, policy, simulation and exact transaction bytes. | Constitution review screen; certificate fields |
| 6 | 6:00-7:00 | Time Machine | Seeded Monte Carlo and four named stresses, every assumption visible, not a forecast. The optimizer's exact limit with the next cent rejected. | Time Machine screenshot; AT-10 result |
| 7 | 7:00-8:00 | Security (30%) | Planner has no key and no authority; independent verifier; human approval bound to one certificate; executor re-checks, claims once, idempotency; CSRF and HttpOnly sessions; browser-verified audit chain; no secrets in the browser (AT-12). Known limits stated. | Red-team result; audit chain; TEST_RESULTS.md |
| 8 | 8:00-8:45 | On-chain (Topic F) | Base Sepolia ERC-20 test allocation; transaction hash and explorer receipt linked to its certificate. | Genuine receipt only; if none, say so |
| 9 | 8:45-9:30 | What is real today | Live: dashboard, Constitution, Time Machine (with an approved config), audit, certificate verifier, browser acceptance AT-10/11/12. In progress: planner, optimizer, verify, execute, attack and emergency routes. | docs/ACCEPTANCE_MATRIX.md, TEST_RESULTS.md |
| 10 | 9:30-10:00 | Close | "AI should control money only when it can prove the action respects the person who owns it." Vision: the same verification layer in front of any agent that moves money. | - |

## Likely judge questions

- **How is this different from a spending limit?** A limit checks one number. ProofFi checks the whole state, obligations, goal and uncertainty, and binds the result to one exact transaction.
- **What if your server is compromised?** The executor re-verifies every binding before signing and claims a certificate once; an on-chain guard contract is the planned second wall. State the current limits honestly.
- **Where do the simulation numbers come from?** From an explicitly approved, versioned config shown on screen with its seed; the seed alone never invents assumptions.
- **Why blockchain?** Public, verifiable receipts tie each execution to its certificate; anyone can check the transaction.
