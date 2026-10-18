# Demo walkthrough

The recorded production-browser tour is **169.64 seconds (2m50s)**, within the requested four minutes. [Play the raw recording](../evidence/prooffi-browser-walkthrough.webm); [provenance and observations](../evidence/current-walkthrough.json). It uses inspection copies of the preserved genuine A and C databases. UI/backend source is reviewed main e45b095; later acceptance-only changes do not alter product screens. It rechecks a recorded confirmed claim, never executes a new transfer or repeats an expense.

| Time | Screen and evidence | Explain |
|---|---|---|
| 0:00–0:28 | Sign in; Certificate with original confirmed A claim | The original exact human-approved 2,000-test-token transfer is confirmed on Base Sepolia. Reconcile uses the retained original identity and actual read-only RPC. The old five-minute certificate is now expired; historical execution remains confirmed. No new approval, signature or dispatch occurs. |
| 0:28–0:45 | A Audit Explorer, hash chain intact | Goal, proposal, checks, certificate, exact approval, execution and ledger effect are linked. [Original browser execution evidence](../evidence/base-sepolia-browser-execution.json) records the actual first execution. |
| 0:45–1:05 | C Dashboard, realized expense $2,000, state version 3 | This is the separately authorized expense already recorded once. The funded $17,000 alternative preserves the original $12,000 baseline and assumes no income. The two scenarios are separate databases. |
| 1:05–1:25 | C audit | The policy is unchanged. The old certificate became SIGNED_BUT_STALE immediately after the expense; its immutable signature remained valid. The historical capture proves that transition; it later expires normally. |
| 1:25–2:05 | Workspace goal, live planner and optimizer | The planner proposes $8,000; trusted checks find $799, with 23 checks and the next cent rejected. Before the recorded expense the maximum was $2,000. Hypothetical seeded assumptions and four named stresses are explicit, not forecasts. No new certificate or approval is requested here. |
| 2:05–2:35 | Controlled red-team screen | An intentionally unsafe borrowed-funding proposal is DENY: no certificate, no signer call, no transaction. This controlled fixture demonstrates the authority boundary; it does not claim a general LLM exploit. |
| 2:35–2:50 | Final Audit Explorer | Browser recomputation reports Hash chain intact. Current state and execution counts stayed unchanged; original databases stayed byte-identical. |

## Reproduce or present live

Follow README setup and the selected funded scenario; inspect chain readiness and the exact policy before proposing an action. A fresh checkout is intentionally unconfigured and policy-inactive. Do not reset either preserved genuine demo or replay expired approval. Use a new isolated stage if any execution history exists. An actual new transfer, expense or policy activation needs separate exact authorization; code-review approval does not provide it.

For a fresh authorized end-to-end run: review and confirm Constitution → Workspace goal → proposal → largest safe amount → verify → inspect certificate and exact transaction → explicit approval → execute once → reconcile the same retained identity if needed → linked Audit. Show explicit refusal instead of claiming success if dependencies or current evidence fail. Never use fixture receipts as genuine chain evidence.

For recording, use a readable 1280px-or-wider browser, hide private files/autofill/notifications, and keep the walkthrough below four minutes (and any optional extended recording below five). Review password, cookie and key exposure before sharing. Preserve raw recording and source/provenance metadata. Use the existing evidence when financial authorization has already been consumed; do not create another transfer to refresh a recording.
