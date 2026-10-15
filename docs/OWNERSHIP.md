# Ownership and parallel development

| Owner | Paths / responsibility | First issues after foundation merge |
|---|---|---|
| Lead / akiibot | core, models, db, migrations, contracts, verifier, approvals, execution, workflows, audit, CI | PF-033, PF-012, PF-030 |
| Farid / @Alfa5nm / finance | policy, simulation, optimizer, planner, demo attack/emergency implementation, risk tests | PF-008, PF-017, then PF-006 after PF-033 |
| Wasik / @WasikZubair / UI/UX | apps/web product screens/components, browser tests | PF-018 |

Lead owns generated client shape but Wasik may consume it. Any OpenAPI route/request/response or migration change is a lead-reviewed contract-change PR. Farid owns demo/attack.py and demo/emergency.py; router wiring changes are small reviewed integration changes. Feature issue paths are authoritative and narrower than this table.

PF-026: Lead owns test_acceptance_security.py and test_acceptance_chain.py; Farid owns test_acceptance_risk.py; Wasik owns browser acceptance files. One coordinating integration PR; do not simultaneously edit the same shared fixture.

GitHub handles verified and write-access invitations issued on 2026-10-15: Farid = @Alfa5nm; Wasik = @WasikZubair. They must accept invitations before GitHub grants repository write/review access. Their issues remain blocked until prerequisites merge. CODEOWNERS routes product UI to Wasik and risk code to Farid. Lead architectural acceptance is recorded separately; another developer must review lead-authored sensitive changes.
