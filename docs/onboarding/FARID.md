# Farid's first implementation PR

Account: Alfa5nm. Responsibility: financial policy, stress/Monte Carlo, optimizer and assigned planner backend. Complete START_HERE.md first.

## 1. Start with PF-008

Issue: https://github.com/akiibot/proofFi/issues/8

Read its dependencies and acceptance criteria:

```sh
gh issue view 8 --repo akiibot/proofFi
```

If status:blocked remains, finish setup/review and wait for the lead to confirm merged prerequisites. Do not implement on the preview branch or build a competing financial-state schema.

## 2. Create your issue branch from current main

Once the foundation is merged and PF-008 is ready, stop any running app and ensure your checkout is clean:

```sh
git status --short
git fetch origin
git switch main
git pull --ff-only
git switch -c codex/pf-008-named-stresses
python3.11 scripts/bootstrap.py
```

If git status showed local changes, preserve/commit them to their proper issue branch before switching; never discard them to make these commands pass.

## 3. Give Codex this exact task in your cloned project

```text
Implement https://github.com/akiibot/proofFi/issues/8 only.
Read AGENTS.md, CONTRIBUTING.md, docs/ARCHITECTURE.md, docs/DECISIONS.md,
docs/ISSUE_BACKLOG.md and the issue's dependencies first.
Preserve the lead-approved architecture and canonical models. Own the named
stress module and its tests; do not edit shared schemas/migrations/routes,
verifier, approvals, signer, executor or frontend.
Use TrustedSimulationInput and StressResult from the canonical contracts.
Implement all four declared individual stresses, with visible parameters and
scheduled obligations checked on their actual simulation days. Add meaningful
boundary/failure tests in services/api/tests/test_pf_008.py.
Do not invent production income, risk probabilities or a positive safe amount.
Run the focused tests and npm run check, update docs/PROGRESS.md, and prepare
an issue-linked PR. Report missing dependencies without bypassing them.
```

## 4. Implement exactly these outcomes

Owned implementation: services/api/app/simulation/stress.py. Test path: services/api/tests/test_pf_008.py. Use the existing internal TrustedSimulationInput; do not introduce another HTTP input/state/policy model.

Required stresses: high-risk asset -30%; expected income +30-day delay; $2,000 emergency liquidity outflow; fee x3. Return typed StressResult with actual parameters and liquidity/goal outcomes. Run stresses individually, not all combined unless separately agreed. Test obligation due-day timing, no-income cases, missing/malformed inputs and boundaries. Document whether a future emergency is an additional shock after a realized emergency.

The baseline has a $200 shortfall before fees/shocks. Preserve that fact; do not edit the seed income to force a positive result. Isolated test fixtures may declare explicit assumptions, but cannot become invisible runtime assumptions.

## 5. Verify and prepare the PR

```sh
.venv/bin/python -m pytest services/api/tests/test_pf_008.py -q
npm run check
git diff --check
git status --short
git add services/api/app/simulation services/api/tests/test_pf_008.py docs/PROGRESS.md
git diff --cached --stat
git commit -m "PF-008: implement named financial stress scenarios"
git push -u origin codex/pf-008-named-stresses
```

Run tests before committing. Inspect staged files; no .env, credentials or unrelated changes. If your issue genuinely needs extra files, document their ownership and include only those files.

```sh
cat > /tmp/prooffi-pf008-pr.md <<'BODY'
Closes #8.

Implements the four declared named stress scenarios using canonical trusted inputs and typed results.

Validation:
- Focused PF-008 tests: record actual result here.
- npm run check: record actual result here.

Assumptions and integration evidence: describe the tested outcomes and any remaining limitations here.
BODY
```

Replace the evidence lines with actual results, then open the PR:

```sh
gh pr create --repo akiibot/proofFi --base main --head codex/pf-008-named-stresses --title "PF-008: named financial stress scenarios" --body-file /tmp/prooffi-pf008-pr.md --reviewer akiibot
```

## 6. Integrate frequently and take the next ready issue

After review feedback, push follow-up commits to the same branch and rerun affected checks. Incorporate main with `git fetch origin` and `git merge origin/main` when needed; resolve conflicts instead of overwriting other work. The lead merges only passing reviewed PRs and clears downstream blockers.

Next candidates: PF-017 planner can proceed once its own dependencies are ready; PF-009 Monte Carlo requires PF-008; PF-006 policy confirmation requires PF-033. Then follow PF-007, PF-010, PF-011 and the remaining assigned backend issues according to actual dependencies. Do not open a second overlapping branch while your first PR still changes the same module.
