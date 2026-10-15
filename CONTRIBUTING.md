# Contributing

Start with README setup. Each developer runs their own cloned checkout, database and `.env`. Read AGENTS.md, architecture, decisions, generated contract, issue body and current main before editing. Only begin a dependency-bound feature after its prerequisites are reviewed and merged; `status:blocked` is authoritative until updated with evidence.

```sh
git fetch origin
git switch main
git pull --ff-only
git switch -c codex/pf-008-named-stresses
# implement only issue-owned files, add focused tests
npm run check
git add <specific-files>
git commit -m "PF-008: implement named stress scenarios"
git push -u origin codex/pf-008-named-stresses
gh pr create --base main --title "PF-008: implement named stress scenarios" --body-file pr-description.md
```

PRs link `Closes #actual-number`, explain behavior, commands/results, integration evidence and blockers. Keep source and fixture tests distinguishable. Never claim a deterministic chain adapter test is a live transfer. Commit a small working vertical slice frequently; update from main before review and after dependency merges. Resolve conflicts; do not replace teammates' work. Run relevant tests during development and the full check before review.

One other developer must approve every PR. Lead must approve shared contracts, migrations, certificate formats, auth, approval, executor and signer changes. For a lead-authored sensitive PR, obtain another developer review and record lead architectural acceptance; GitHub cannot count self-approval. No direct feature pushes to main. No auto-merging or bypassing failing CI. Secrets stay out of commits, tests, logs and screenshots.

After merge, add PR/commit links to the issue, close only when acceptance evidence is integrated, clear `status:blocked` only after all actual dependencies merge, and update docs/PROGRESS.md. If blocked, take another ready issue in your ownership area; do not create another schema or bypass a missing service.

## Architecture change process

Open a separate `contract-change` PR with reason, affected consumers, migration plan, schema version and before/after examples. Regenerate `npm run contracts`; include `contracts/openapi.json` and `apps/web/src/lib/schema.d.ts`. Lead approves before consumers change. Never hand-edit generated files. No alternate money units, transaction encodings, certificate objects or route conventions.

## GitHub branch protection

Configure main rules: require a PR, one approving review, CODEOWNER review for covered files, dismiss stale reviews, require latest branch/checks, resolve conversations, no force pushes/deletion, do not bypass as admin. Required CI check name: `foundation`. Add additional checks when their suites land. If the repository plan prevents enforcement, document that limitation and follow the review rules manually. Initial main bootstrap is the sole infrastructure exception so the foundation can be reviewed as a PR.

## Open an issue in Codex

Paste the actual issue URL and say: "Implement this issue only. Read AGENTS.md and linked dependencies. Preserve the approved architecture, use owned paths, add acceptance tests, run npm run check, and open an issue-linked PR. Report blockers honestly." This repository's AGENTS.md contains the shared guardrails, so neither teammate needs to rebuild setup.
