# ProofFi contributor instructions

Read docs/ARCHITECTURE.md, docs/DECISIONS.md, docs/ISSUE_BACKLOG.md, CONTRIBUTING.md and the assigned issue before changes. Respect lead-approved architecture; foundation architecture is approved; dependent feature work still requires its reviewed merge. Do not independently replace schemas, migrations, routes or transaction/certificate encoding.

Work one issue on a codex/pf-###-description branch. Follow issue-owned paths and blockers. Every remaining task needs an issue; no unrelated feature work. Shared contract changes require a separate lead-reviewed contract-change PR and regenerated OpenAPI/TS. On 2026-10-17 the owner directed Codex to take over all Farid and Wasik tasks. Codex implements all workstreams with akiibot as owner/lead reviewer. Preserve the existing risk/policy/planner, product UI, and foundation/security/execution module boundaries; the takeover does not waive sensitive/shared review or financial confirmation.

No mocks as feature completion, no invented tx hashes, no silently activated policy, no invented income/risk probabilities. Only isolated tests may substitute services. Unimplemented routes return explicit NOT_IMPLEMENTED. Never import execution/approval/verifier into planner. Only executor calls signer after independent validation.

Money: integer USD cents, EVM base-unit strings, probability basis points. Trusted simulation input is never public input. Canonical signed payload excludes execution status. Preserve all three scenarios and AT-01..AT-12 gates.

Run focused tests during development and npm run check before review. Do not add skipped/always-passing tests to imply completion. Update progress and actual evidence. The owner waived teammate approval on 2026-10-16; PRs and passing current CI remain required. Sensitive/shared changes still require lead review. Never push feature code directly to main or merge failing CI. Do not expose backend keys in frontend, prompts, logs or GitHub.
