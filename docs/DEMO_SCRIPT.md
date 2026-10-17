# Demo script

A walkthrough of the three scenarios in **4 minutes or less**, and guidance for the **5-minute or less** demo recording. Persona: Tania, an international student with $12,000 synthetic USD, $7,000 tuition due on day 120 and $800 a month in living costs.

**Status column.** "Live" runs against the real backend on `main` today. "Blocked" names the backend issue whose route still returns `501`; the screen states this honestly and the step becomes live when that issue merges. Do not record a blocked step as if it worked.

## Before you start

1. Stop any running servers. Reset the demo state (append-only; history is kept):
   `.venv/bin/python scripts/reset_demo.py` (Windows: `.venv\Scripts\python.exe scripts\reset_demo.py`)
2. `npm run dev`, open http://127.0.0.1:3000, sign in with the password in `.local/demo-password.txt`. Never show this file or `.env` on screen.
3. Use a 1440 px wide browser window at 100% zoom. Close other tabs and notifications.

## Walkthrough (4:00)

| Time | Screen | Do | Say | Status |
|---|---|---|---|---|
| 0:00-0:20 | Dashboard `/` | Show balances, tuition, living costs, chain status | "AI can now move money. ProofFi assumes the AI can be wrong or fooled." | Live |
| 0:20-0:50 | Constitution `/constitution` | Change autonomy limit, Save draft, show the before/after table, tick the box, Confirm | "Saving is not authority. Only an explicit confirmation of these exact rules, bound to this fingerprint, activates them." | Live |
| 0:50-1:30 | Workspace `/workspace` | Enter the goal "Invest as much as possible without risking my tuition", Propose candidates, Find the largest safe amount | "The planner proposes; an independent optimizer finds the exact limit; one more cent is rejected." | Blocked: PF-017 planner, PF-010 optimizer |
| 1:30-2:00 | Time Machine `/time-machine` | Open from the Workspace link or enter the amount; Run simulation | "Many seeded futures, four named stress tests and every assumption, shown. Not a prediction." | Live once a simulation config is approved (see below) |
| 2:00-2:30 | Workspace step 3, then Certificates `/certificates` | Verify and get a certificate; review the exact transaction fields; Approve; Execute on testnet | "The executor signs only these exact bytes, once, after a fresh check. Here is the transaction on the explorer." | Blocked: PF-029 verify, PF-014/015 execute, funded wallet |
| 2:30-3:10 | Red team `/red-team` | Tick the box, Run the attack | "The planner was fooled on purpose. The verifier denied it, the signer was never called, there is no transaction, and the refusal is on record." | Blocked: PF-031 |
| 3:10-3:40 | Workspace step 4 | Record the $2,000 emergency | "The Constitution did not change; reality did. The old certificate is now stale and the safe amount is recomputed." | Blocked: PF-032 |
| 3:40-4:00 | Audit `/audit` | Show "Hash chain intact", filter, Download JSON | "Every decision is linked by hash; the browser recomputes the whole chain." | Live |

**Simulation config.** The seed deliberately selects no simulation assumptions (docs/DECISIONS.md D12), so `/simulate` refuses on a normal database. The browser tests use an "E2E TEST FIXTURE" config only in their throwaway database. For the recorded demo, the lead must approve and store a real, labelled config first; never show the test fixture as if it were approved.

## If something fails during a live demo

Say what the screen says. Every failure state in ProofFi is designed to be shown, not hidden: a 501 names the unfinished issue, a refusal names the rule. Then move to the next scenario. Reset afterwards.

## Recording guidance (5:00 or less)

- Record at 1440x900 or 1920x1080, 30 fps, system audio off, a single microphone track.
- Follow the walkthrough order. Keep each scenario under a minute; cut dead time while pages load rather than speeding the video up.
- Show the transaction hash on the Base Sepolia explorer only when it is a genuine receipt from this run. Never use a hash from a mocked adapter.
- Before publishing, scrub frames for `.env`, `.local/demo-password.txt`, cookies, terminal history and browser autofill.
- Name the file `prooffi-demo-YYYYMMDD.mp4` and record the commit SHA it was made from in `docs/SUBMISSION_CHECKLIST.md`.
