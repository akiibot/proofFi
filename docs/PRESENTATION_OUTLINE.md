# Presentation outline

Ten minutes maximum. Show the current three-scenario evidence and state the limits of each claim. The supplied walkthrough is a raw browser recording; this outline is sufficient to present without creating a separate deck.

| Time | Topic | Evidence |
|---|---|---|
| 0:00–0:45 | Problem: a plausible AI proposal must not become financial authority | Goal and untrusted proposal |
| 0:45–1:30 | Architecture: planner → independent policy/simulation/verifier → exact certificate → explicit approval → independent executor | docs/ARCHITECTURE.md; no planner-to-signer dependency |
| 1:30–2:00 | Persona and assumptions: original $12k has a $200 shortfall; explicitly selected synthetic $17k alternative has no income | Baseline/funded dashboards; docs/funded-demo-config.json |
| 2:00–4:50 | Play the 2m50s browser tour | evidence/prooffi-browser-walkthrough.webm, with scope from docs/DEMO_SCRIPT.md |
| 4:50–5:45 | Explain original A: goal → safe $2k → certificate → exact approval → one real confirmed testnet transfer | base-sepolia-browser-execution.json, certificate JSON, actual receipt/explorer |
| 5:45–6:30 | Explain C: one acknowledged $2k expense → state version change → signed but stale certificate → $799 maximum | emergency-browser.json, current-walkthrough.json |
| 6:30–7:15 | Controlled unsafe planner proposal: DENY and no signing | red-team-browser.json, current controlled-refusal screenshot |
| 7:15–8:15 | Security and reproducibility: integer units, exact bytes, independent revalidation, one claim/ledger effect, CSRF, secret isolation, twelve acceptance gates | ACCEPTANCE_MATRIX.md, TEST_RESULTS.md, public canary fixture versus genuine chain proof |
| 8:15–9:00 | Reset and recovery boundaries: append-only funded restaging before any execution; after any execution use a new stage; unsupported recovery refuses and retains evidence | Reset tests and #99; never demonstrate on preserved genuine data |
| 9:00–9:40 | Limits: illustrative Monte Carlo, controlled attack, trusted local backend/signer, audit not administrator-proof; historical developer hydration observation #60 | RISK_METHODOLOGY.md, KNOWN_LIMITATIONS.md |
| 9:40–10:00 | Close: the person owns authority; the agent only proposes | Repository and evidence index |

Questions: the simulation is a reproducible hypothetical scenario, not a calibrated probability forecast. A certificate records exact checked evidence at a moment in time; it cannot make compromised backend software trustworthy. Hash-linked audit detects ordinary tampering but not a privileged administrator rewriting the database. The ERC-20 test allocation is not an investment or production custody service. One current passing CI run is not proof that every historical development-environment issue was repaired.
