# Three-developer handoff

Foundation review: https://github.com/akiibot/proofFi/pull/34

GitHub CI has passed on the foundation branch. The branch is still awaiting lead architecture acceptance and another developer's review. Do not start dependency-blocked feature branches from unfinished main. During review, everyone can clone the foundation branch and validate setup independently.

## Each developer validates setup

Install Python 3.11 and Node 22.19.0. Use separate checkouts and local environment files; do not share private keys or API tokens.

```sh
git clone https://github.com/akiibot/proofFi.git
cd proofFi
git switch codex/prooffi-foundation
python3.11 scripts/bootstrap.py
npx playwright install chromium
npm run check
npm run dev
```

Open http://127.0.0.1:3000. Confirm $12,000 synthetic assets, $7,000 tuition, $800 living costs, an inactive policy draft, and an unconfigured chain. The API is on port 8000. Stop the dev servers before running browser tests again. On Linux, use `npx playwright install --with-deps chromium` for browser dependencies. Use WSL2 on Windows.

Read AGENTS.md, CONTRIBUTING.md, docs/ARCHITECTURE.md and docs/DECISIONS.md. Record setup failures on PF-001 (#1), and workflow/setup documentation gaps on PF-005 (#5). Attach exact commands, runtime versions and sanitized errors; never post .env contents.

## Review and merge gate

1. Lead reviews the proposed decisions, especially money units, snapshots, concentration denominator, testnet transfer semantics and baseline assumptions. Record explicit acceptance in docs/DECISIONS.md.
2. Confirm Farid's and Wasik's exact GitHub usernames. Invite those accounts and assign their existing issues; do not guess identities from display names.
3. An invited developer independently runs setup, reviews PR #34 and submits a review. Sensitive/shared changes require lead acceptance as well. Check required CODEOWNER approval before merge; update CODEOWNERS with confirmed reviewer handles as appropriate. No self-approval or protection bypass.
4. Merge only when the required review and current CI checks are satisfied. No feature source is pushed directly to main.
5. Update PF-001..PF-005 evidence/status and mark only issues with all merged dependencies ready. The local manifest and GitHub labels must agree. The publisher currently creates/reconciles issues; it does not automatically infer merged dependency status.

## First assignments after merge

| Developer | Start with | Owned paths | Important dependency |
|---|---|---|---|
| Lead / akiibot | PF-012 certificate primitives, PF-033 sessions, PF-030 chain adapter | verifier, core authentication, execution | Issuance remains blocked until trusted policy/simulation exist |
| Farid | PF-008 named stresses; PF-017 planner | simulation/stress.py; planner | PF-006 confirmation requires PF-033; never activate policy from a planner output |
| Wasik | PF-018 dashboard | apps/web product UI | Consume generated contracts; mutation forwarding waits for PF-033 |

Each issue names exact files, canonical entities, acceptance criteria and a test command. Finish one reviewable outcome per PR and frequently incorporate merged main. No one recreates the scaffold, ORM or API schema for their feature.

## Branch and Codex workflow

After foundation merge:

```sh
git fetch origin
git switch main
git pull --ff-only
git switch -c codex/pf-008-named-stresses
```

Use your actual issue ID in the branch. In Codex, provide the issue URL with: "Implement this issue only. Read AGENTS.md and the linked prerequisites. Preserve approved architecture and owned paths. Add acceptance tests, run npm run check, and prepare an issue-linked PR. Report unmet dependencies explicitly."

Shared schema, routing, migration or signing-interface changes require a separate lead-reviewed contract-change PR. Update generated OpenAPI and TypeScript together. Component test fixtures may isolate a network response; the integrated app must use real backend behavior and honest unavailable states.

## Decisions that still need real input

- Baseline has a $200 shortfall before fees and shocks. Positive hero allocation requires explicitly approved and prominently displayed financial assumptions; no income is invented.
- Token contract, destination, wallet, funded native gas/test tokens and RPC are unset. PF-030 can implement/test its adapter without secrets, but actual execution evidence requires genuine infrastructure.
- Human session authentication belongs to PF-033. The local read proxy and backend service token do not establish human approval.

All twelve product acceptance gates remain unfinished. Passing foundation CI establishes a shared starting point, not completion of the end-to-end product.
