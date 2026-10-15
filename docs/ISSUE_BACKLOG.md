# Implementation backlog

Repository: https://github.com/akiibot/proofFi

Lead: akiibot · Finance/risk: Farid (@Alfa5nm) · Frontend: Wasik (@WasikZubair).

Source: revised master implementation prompt PF-001..PF-032; PF-033 adds the explicit authenticated-session gate required by its security section.

All feature issues depend on reviewed/merged PF-001..PF-005. Additional gates: PF-006/PF-013/PF-014 require PF-033; PF-026 includes all UI/risk checks; PF-028 includes methodology. No cycles. Foundation implementation is not architecture approval.

| ID | Owner | Dependencies | Status | GitHub |
|---|---|---|---|---|
| PF-001 Repo bootstrap and reliable local startup | Lead / akiibot | None | IMPLEMENTED_PENDING_REVIEW | [#1](https://github.com/akiibot/proofFi/issues/1) |
| PF-002 Trust boundaries, shared domain models and API contracts | Lead / akiibot | None | IMPLEMENTED_PENDING_REVIEW | [#2](https://github.com/akiibot/proofFi/issues/2) |
| PF-003 Database schema, migrations, state versioning and seed fixture | Lead / akiibot | None | IMPLEMENTED_PENDING_REVIEW | [#3](https://github.com/akiibot/proofFi/issues/3) |
| PF-004 Chain/transaction design, environment and secret-handling boundary | Lead / akiibot | None | IMPLEMENTED_PENDING_REVIEW | [#4](https://github.com/akiibot/proofFi/issues/4) |
| PF-005 GitHub workflow, CI checks, issue templates, PR template and contributor docs | Lead / akiibot | None | IMPLEMENTED_PENDING_REVIEW | [#5](https://github.com/akiibot/proofFi/issues/5) |
| PF-006 Constitution draft, explicit confirm and immutable versions | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-033 | IMPLEMENTED_PENDING_REVIEW; INTEGRATION_BLOCKED_ON_DEPENDENCIES | [#6](https://github.com/akiibot/proofFi/issues/6) |
| PF-007 Deterministic policy engine and approval-vs-deny verdicts | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-006 | AWAITING_FOUNDATION_MERGE | [#7](https://github.com/akiibot/proofFi/issues/7) |
| PF-008 Named stress scenarios | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005 | AWAITING_FOUNDATION_MERGE | [#8](https://github.com/akiibot/proofFi/issues/8) |
| PF-009 Seeded Monte Carlo and risk metrics | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-008 | AWAITING_FOUNDATION_MERGE | [#9](https://github.com/akiibot/proofFi/issues/9) |
| PF-010 Largest-safe-action optimizer | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-007, PF-009 | AWAITING_FOUNDATION_MERGE | [#10](https://github.com/akiibot/proofFi/issues/10) |
| PF-011 Risk backend security and acceptance test suite | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-007, PF-010 | AWAITING_FOUNDATION_MERGE | [#11](https://github.com/akiibot/proofFi/issues/11) |
| PF-012 Canonical certificate payload, hashing and signature primitives | Lead / akiibot | PF-001, PF-002, PF-003, PF-004, PF-005 | IMPLEMENTED_PENDING_REVIEW; INTEGRATION_BLOCKED_ON_FOUNDATION | [#12](https://github.com/akiibot/proofFi/issues/12) |
| PF-013 Approval binding and authorization lifecycle | Lead / akiibot | PF-001, PF-002, PF-003, PF-004, PF-005, PF-012, PF-033 | IMPLEMENTED_PENDING_REVIEW; INTEGRATION_BLOCKED_ON_DEPENDENCIES | [#13](https://github.com/akiibot/proofFi/issues/13) |
| PF-014 Independent executor, replay and concurrency guards | Lead / akiibot | PF-001, PF-002, PF-003, PF-004, PF-005, PF-013, PF-029, PF-033 | GUARDS_IMPLEMENTED_PENDING_REVIEW; INTEGRATION_BLOCKED | [#14](https://github.com/akiibot/proofFi/issues/14) |
| PF-015 Connect authorized executor to real EVM testnet and store receipt | Lead / akiibot | PF-001, PF-002, PF-003, PF-004, PF-005, PF-014, PF-030 | AWAITING_FOUNDATION_MERGE | [#15](https://github.com/akiibot/proofFi/issues/15) |
| PF-016 Workflow orchestrator, audit trail and exact execution link | Lead / akiibot | PF-001, PF-002, PF-003, PF-004, PF-005, PF-010, PF-015, PF-017 | AWAITING_FOUNDATION_MERGE | [#16](https://github.com/akiibot/proofFi/issues/16) |
| PF-017 Structured goal parsing and untrusted planner adapter | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005 | AWAITING_FOUNDATION_MERGE | [#17](https://github.com/akiibot/proofFi/issues/17) |
| PF-018 Next.js UI shell, state dashboard and generated API client | Wasik / @WasikZubair (frontend UI/UX) | PF-001, PF-002, PF-003, PF-004, PF-005 | AWAITING_FOUNDATION_MERGE | [#18](https://github.com/akiibot/proofFi/issues/18) |
| PF-019 Constitution Builder UI and diff/confirmation | Wasik / @WasikZubair (frontend UI/UX) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-006, PF-018 | AWAITING_FOUNDATION_MERGE | [#19](https://github.com/akiibot/proofFi/issues/19) |
| PF-020 Agent Workspace and candidate/optimizer results | Wasik / @WasikZubair (frontend UI/UX) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-010, PF-017, PF-018 | AWAITING_FOUNDATION_MERGE | [#20](https://github.com/akiibot/proofFi/issues/20) |
| PF-021 Time Machine chart and transparent assumptions UI | Wasik / @WasikZubair (frontend UI/UX) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-009, PF-018 | AWAITING_FOUNDATION_MERGE | [#21](https://github.com/akiibot/proofFi/issues/21) |
| PF-022 Certificate details, approval panel and execution results UI | Wasik / @WasikZubair (frontend UI/UX) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-013, PF-015, PF-018 | AWAITING_FOUNDATION_MERGE | [#22](https://github.com/akiibot/proofFi/issues/22) |
| PF-023 Red-team demo mode and blocked-executor evidence | Wasik / @WasikZubair (frontend UI/UX) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-018, PF-031 | AWAITING_FOUNDATION_MERGE | [#23](https://github.com/akiibot/proofFi/issues/23) |
| PF-024 Emergency expense and replanning UI | Wasik / @WasikZubair (frontend UI/UX) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-018, PF-032 | AWAITING_FOUNDATION_MERGE | [#24](https://github.com/akiibot/proofFi/issues/24) |
| PF-025 Audit Explorer and public-safe certificate verifier UI | Wasik / @WasikZubair (frontend UI/UX) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-016, PF-018, PF-012 | AWAITING_FOUNDATION_MERGE | [#25](https://github.com/akiibot/proofFi/issues/25) |
| PF-026 End-to-end acceptance tests AT-01 to AT-12 and fresh-checkout run | Lead coordinates; Farid risk tests; Wasik browser tests | PF-001, PF-002, PF-003, PF-004, PF-005, PF-016, PF-020, PF-022, PF-023, PF-024, PF-011, PF-019, PF-021, PF-025, PF-033 | AWAITING_FOUNDATION_MERGE | [#26](https://github.com/akiibot/proofFi/issues/26) |
| PF-027 Simulation methodology, API documentation and threat notes | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-009, PF-014 | AWAITING_FOUNDATION_MERGE | [#27](https://github.com/akiibot/proofFi/issues/27) |
| PF-028 Demo evidence, README and end-to-end presentation walkthrough | Wasik with lead review | PF-001, PF-002, PF-003, PF-004, PF-005, PF-026, PF-027 | AWAITING_FOUNDATION_MERGE | [#28](https://github.com/akiibot/proofFi/issues/28) |
| PF-029 Bind independent policy/simulation checks to certificate issuance | Lead / akiibot | PF-001, PF-002, PF-003, PF-004, PF-005, PF-007, PF-009, PF-012 | AWAITING_FOUNDATION_MERGE | [#29](https://github.com/akiibot/proofFi/issues/29) |
| PF-030 Isolated testnet-only signing and RPC adapter | Lead / akiibot | PF-001, PF-002, PF-003, PF-004, PF-005 | IMPLEMENTED_PENDING_REVIEW; INTEGRATION_BLOCKED_ON_FOUNDATION | [#30](https://github.com/akiibot/proofFi/issues/30) |
| PF-031 Controlled malicious planner fixture and red-team backend route | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-007, PF-014, PF-017 | AWAITING_FOUNDATION_MERGE | [#31](https://github.com/akiibot/proofFi/issues/31) |
| PF-032 Emergency expense backend, state version bump and repricing route | Farid / @Alfa5nm (finance and risk) | PF-001, PF-002, PF-003, PF-004, PF-005, PF-010, PF-014 | AWAITING_FOUNDATION_MERGE | [#32](https://github.com/akiibot/proofFi/issues/32) |
| PF-033 Authenticated demo session and browser mutation boundary | Lead / akiibot | PF-001, PF-002, PF-003, PF-004, PF-005 | IMPLEMENTED_PENDING_CONTRACT_REVIEW; INTEGRATION_BLOCKED_ON_FOUNDATION | [#33](https://github.com/akiibot/proofFi/issues/33) |

## First parallel work after foundation review/merge

- Lead: PF-033 and PF-012, then PF-013; PF-030 chain adapter can progress using isolated tests while funding is arranged.
- Farid: PF-008 stresses and PF-017 planner; PF-006 activates after authentication lands, then PF-007/PF-009/PF-010.
- Wasik: PF-018 dashboard, then each UI issue as its backend dependency merges.

Do not unblock by closing issues without merged PR evidence. Add new remaining work as issues before implementing. See CONTRIBUTING.md for handoff and review rules.
