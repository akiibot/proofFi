# Implementation backlog

Repository: https://github.com/akiibot/proofFi

Lead: akiibot · Finance/risk: Farid (@Alfa5nm) · Frontend: Wasik (@WasikZubair).

Source: revised master implementation prompt PF-001..PF-032; PF-033 adds the explicit authenticated-session gate required by its security section.

Foundation PF-001..PF-005 merged via #34 (`9c49ef4815023c746b3c18556fe5963918731f2b`). All feature issues depend on that foundation. Additional gates: PF-006/PF-013/PF-014/PF-018 require PF-033; PF-026 includes all UI/risk checks; PF-028 includes methodology. No cycles. Foundation architecture is approved; the owner extended the teammate-approval waiver to future PRs on 2026-10-16; all other gates remain.

| ID | Owner | Dependencies | Status | GitHub |
|---|---|---|---|---|
| PF-001 Repo bootstrap and reliable local startup | Lead / akiibot | None | MERGED_VIA_34 | [#1](https://github.com/akiibot/proofFi/issues/1) |
| PF-002 Trust boundaries, shared domain models and API contracts | Lead / akiibot | None | MERGED_VIA_34 | [#2](https://github.com/akiibot/proofFi/issues/2) |
| PF-003 Database schema, migrations, state versioning and seed fixture | Lead / akiibot | None | MERGED_VIA_34 | [#3](https://github.com/akiibot/proofFi/issues/3) |
| PF-004 Chain/transaction design, environment and secret-handling boundary | Lead / akiibot | None | MERGED_VIA_34 | [#4](https://github.com/akiibot/proofFi/issues/4) |
| PF-005 GitHub workflow, CI checks, issue templates, PR template and contributor docs | Lead / akiibot | None | MERGED_VIA_34 | [#5](https://github.com/akiibot/proofFi/issues/5) |
| PF-006 Constitution draft, explicit confirm and immutable versions | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-033 | MERGED_VIA_41 | [#6](https://github.com/akiibot/proofFi/issues/6) |
| PF-007 Deterministic policy engine and approval-vs-deny verdicts | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-006 | MERGED_VIA_46 | [#7](https://github.com/akiibot/proofFi/issues/7) |
| PF-008 Named stress scenarios | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005 | MERGED_VIA_43 | [#8](https://github.com/akiibot/proofFi/issues/8) |
| PF-009 Seeded Monte Carlo and risk metrics | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-008 | MERGED_VIA_47 | [#9](https://github.com/akiibot/proofFi/issues/9) |
| PF-010 Largest-safe-action optimizer | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-007, PF-009 | MERGED_VIA_62 | [#10](https://github.com/akiibot/proofFi/issues/10) |
| PF-011 Risk backend security and acceptance test suite | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-007, PF-010 | MERGED_VIA_70 | [#11](https://github.com/akiibot/proofFi/issues/11) |
| PF-012 Canonical certificate payload, hashing and signature primitives | Lead / akiibot | PF-001, PF-002, PF-003, PF-004, PF-005 | MERGED_VIA_35 | [#12](https://github.com/akiibot/proofFi/issues/12) |
| PF-013 Approval binding and authorization lifecycle | Lead / akiibot | PF-001, PF-002, PF-003, PF-004, PF-005, PF-012, PF-033 | MERGED_VIA_38 | [#13](https://github.com/akiibot/proofFi/issues/13) |
| PF-014 Independent executor, replay and concurrency guards | Lead / akiibot | PF-001, PF-002, PF-003, PF-004, PF-005, PF-013, PF-029, PF-033 | INTERNAL_SIGNING_MERGED_VIA_64; PUBLIC_EXECUTOR_INCOMPLETE | [#14](https://github.com/akiibot/proofFi/issues/14) |
| PF-015 Connect authorized executor to real EVM testnet and store receipt | Lead / akiibot | PF-001, PF-002, PF-003, PF-004, PF-005, PF-014, PF-030 | BLOCKED_ON_UNMERGED_DEPENDENCIES | [#15](https://github.com/akiibot/proofFi/issues/15) |
| PF-016 Workflow orchestrator, audit trail and exact execution link | Lead / akiibot | PF-001, PF-002, PF-003, PF-004, PF-005, PF-010, PF-015, PF-017 | BLOCKED_ON_UNMERGED_DEPENDENCIES | [#16](https://github.com/akiibot/proofFi/issues/16) |
| PF-017 Structured goal parsing and untrusted planner adapter | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005 | MERGED_VIA_63 | [#17](https://github.com/akiibot/proofFi/issues/17) |
| PF-018 Next.js UI shell, state dashboard and generated API client | Wasik / @WasikZubair (frontend UI/UX) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-033 | MERGED_VIA_48 | [#18](https://github.com/akiibot/proofFi/issues/18) |
| PF-019 Constitution Builder UI and diff/confirmation | Wasik / @WasikZubair (frontend UI/UX) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-006, PF-018 | MERGED_VIA_49 | [#19](https://github.com/akiibot/proofFi/issues/19) |
| PF-020 Agent Workspace and candidate/optimizer results | Wasik / @WasikZubair (frontend UI/UX) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-010, PF-017, PF-018 | BLOCKED_ON_UNMERGED_DEPENDENCIES | [#20](https://github.com/akiibot/proofFi/issues/20) |
| PF-021 Time Machine chart and transparent assumptions UI | Wasik / @WasikZubair (frontend UI/UX) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-009, PF-018 | MERGED_VIA_50 | [#21](https://github.com/akiibot/proofFi/issues/21) |
| PF-022 Certificate details, approval panel and execution results UI | Wasik / @WasikZubair (frontend UI/UX) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-013, PF-015, PF-018 | BLOCKED_ON_UNMERGED_DEPENDENCIES | [#22](https://github.com/akiibot/proofFi/issues/22) |
| PF-023 Red-team demo mode and blocked-executor evidence | Wasik / @WasikZubair (frontend UI/UX) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-018, PF-031 | BLOCKED_ON_UNMERGED_DEPENDENCIES | [#23](https://github.com/akiibot/proofFi/issues/23) |
| PF-024 Emergency expense and replanning UI | Wasik / @WasikZubair (frontend UI/UX) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-018, PF-032 | BLOCKED_ON_UNMERGED_DEPENDENCIES | [#24](https://github.com/akiibot/proofFi/issues/24) |
| PF-025 Audit Explorer and public-safe certificate verifier UI | Wasik / @WasikZubair (frontend UI/UX) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-016, PF-018, PF-012 | BLOCKED_ON_UNMERGED_DEPENDENCIES | [#25](https://github.com/akiibot/proofFi/issues/25) |
| PF-026 End-to-end acceptance tests AT-01 to AT-12 and fresh-checkout run | Lead coordinates; Farid risk tests; Wasik browser tests | PF-001, PF-002, PF-003, PF-004, PF-005, PF-016, PF-020, PF-022, PF-023, PF-024, PF-011, PF-019, PF-021, PF-025, PF-033 | BLOCKED_ON_UNMERGED_DEPENDENCIES | [#26](https://github.com/akiibot/proofFi/issues/26) |
| PF-027 Simulation methodology, API documentation and threat notes | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-009, PF-014 | BLOCKED_ON_UNMERGED_DEPENDENCIES | [#27](https://github.com/akiibot/proofFi/issues/27) |
| PF-028 Demo evidence, README and end-to-end presentation walkthrough | Wasik with lead review | PF-001, PF-002, PF-003, PF-004, PF-005, PF-026, PF-027 | BLOCKED_ON_UNMERGED_DEPENDENCIES | [#28](https://github.com/akiibot/proofFi/issues/28) |
| PF-029 Bind independent policy/simulation checks to certificate issuance | Lead / akiibot | PF-001, PF-002, PF-003, PF-004, PF-005, PF-007, PF-009, PF-012 | MERGED_VIA_61 | [#29](https://github.com/akiibot/proofFi/issues/29) |
| PF-030 Isolated testnet-only signing and RPC adapter | Lead / akiibot | PF-001, PF-002, PF-003, PF-004, PF-005 | MERGED_VIA_36 | [#30](https://github.com/akiibot/proofFi/issues/30) |
| PF-031 Controlled malicious planner fixture and red-team backend route | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-007, PF-014, PF-017 | BLOCKED_ON_UNMERGED_DEPENDENCIES | [#31](https://github.com/akiibot/proofFi/issues/31) |
| PF-032 Emergency expense backend, state version bump and repricing route | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-010, PF-014 | BLOCKED_ON_UNMERGED_DEPENDENCIES | [#32](https://github.com/akiibot/proofFi/issues/32) |
| PF-033 Authenticated demo session and browser mutation boundary | Lead / akiibot | PF-001, PF-002, PF-003, PF-004, PF-005 | MERGED_VIA_45 | [#33](https://github.com/akiibot/proofFi/issues/33) |

## Work after foundation merge

- Lead: PF-009 merged via #47, so trusted issuance PF-029 may proceed within its issue; PF-007 merged via #46. PF-014 has merged guards only and remains open; PF-015 remains blocked on the full PF-014/PF-029 path and real testnet infrastructure even though the PF-030 adapter is merged.
- Farid: PF-009 merged via #47; PF-010 and PF-017 are ready. PF-017 remains independently ready.
- Wasik: PF-018/#48 and PF-019/#49 are merged; PF-021/#50 is merged. PF-025 still needs PF-016; retain later backend dependency gates.

PF-006/#6, PF-007/#7 and PF-008/#8 are merged and closed. PF-009 is merged via #47; PF-010 is ready. PF-012/#12, PF-030/#30 and PF-033/#33 are also merged and closed. Do not unblock issues that retain other unmerged prerequisites. Add new remaining work as issues before implementing. See CONTRIBUTING.md for handoff and review rules.

## Additional tooling issue

PF-034 Windows bootstrap/check portability: [#58](https://github.com/akiibot/proofFi/issues/58), lead-owned, codex/pf-034-windows-check. Keep platform evidence separate from feature/chain acceptance.

PF-035 intermittent browser login/hydration diagnosis: [#60](https://github.com/akiibot/proofFi/issues/60), Wasik UI/browser ownership with lead review for authentication/shared test changes. Causality is unresolved; repeated passes do not establish a repair.

PF-037 private durable-envelope contract proposal: [#68](https://github.com/akiibot/proofFi/issues/68), lead-owned, separate contract-change PR on codex/pf-037-durable-execution-journal. PF-015 remains incomplete until this reviewed persistence and full broadcast/reconciliation integration land. PF-011 is READY after PF-010/#62 merged; its live GitHub issue is updated. PF-014 internal signing is merged via #64 but public execution is still disabled.

PF-036 funded synthetic scenario proposal: [#65](https://github.com/akiibot/proofFi/issues/65), not activated. Base Sepolia preparation: [#66](https://github.com/akiibot/proofFi/issues/66), Farid handles provisioning; no funded/deployed outcome yet. PF-037 private durable execution-envelope contract: [#68](https://github.com/akiibot/proofFi/issues/68), lead-owned separate contract-change prerequisite before PF-015 broadcast.

PF-038 current demo-host planner response timeout: [#72](https://github.com/akiibot/proofFi/issues/72), Farid-owned. A real diagnostic 30-second bound returned validated HTTP 200/STOP in 13.03 seconds; production remains at eight seconds pending measured/reviewed operating fixes. PF-035 pre-hydration/native-submit and harness hardening merged via #71; historical busy-login/PF-022 observations remain open under #60.


PF-037/#68 is approved and merged via #69 at dcf8a96 (owner approval recorded
2026-10-17). PF-015 may consume this private contract. Its durable handoff and
one-attempt dispatch slice is in progress; receipt/ledger reconciliation and
live-chain acceptance remain incomplete, so dependent completion gates stay blocked.
