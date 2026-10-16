# Wasik's first implementation PR

Account: WasikZubair. Responsibility: frontend UI/UX, generated API consumption and browser tests. Complete START_HERE.md first.

## 1. Start with PF-018

Issue: https://github.com/akiibot/proofFi/issues/18

```sh
gh issue view 18 --repo akiibot/proofFi
```

Foundation and PF-033 session integration are merged, and PF-018 is ready. Start from current `main` so the dashboard preserves the session/CSRF boundary and existing login/homepage integration.

## 2. Create your issue branch from current main

Once ready, stop dev servers and ensure a clean checkout:

```sh
git status --short
git fetch origin
git switch main
git pull --ff-only
git switch -c codex/pf-018-dashboard
python3.11 scripts/bootstrap.py
```

Preserve any existing local changes on their correct branch before switching; do not discard them.

## 3. Give Codex this exact task in your cloned project

```text
Implement https://github.com/akiibot/proofFi/issues/18 only.
Read AGENTS.md, CONTRIBUTING.md, docs/ARCHITECTURE.md, docs/DECISIONS.md,
docs/API.md, docs/AUTHENTICATION.md and the issue's dependencies first.
Preserve the approved architecture and existing login/logout/session boundary.
Own the product dashboard/UI and browser tests. Consume the generated types
and existing openapi-fetch client; do not recreate backend/domain models,
change endpoint shapes, edit generated schema.d.ts manually, or modify signer,
verifier, approval, authentication or database behavior.
Render real GET /financial-state and /chain/status data with loading, empty,
error and expired-session handling. Keep synthetic amounts and unfinished
features clearly labeled. Preserve responsive and accessible behavior.
Create focused PF-018 browser tests against actual backend/database behavior.
Mocks are allowed only in explicitly isolated component tests, never runtime
financial/verification/execution outcomes. Run npm run check, update
progress, and prepare an issue-linked PR with screenshots and real evidence.
```

## 4. Implement exactly this slice

Start with apps/web/app/page.tsx, product components/styles and the existing apps/web/src/lib/api.ts client. Use generated components/paths from schema.d.ts. Put new browser checks in apps/web/e2e/pf-018.spec.ts and include PF-018 in their test titles.

The dashboard should show real synthetic balances, protected tuition, living costs, goal and current policy/chain status. Handle 401 by returning to login, preserve sign-out, and show actionable error/loading states. Do not hard-code risk percentages, safe allocation, approved/certified banners or transaction hashes. A 501/unavailable backend feature remains visibly unfinished.

If a real feature requires another backend endpoint or shared type, raise it with the lead through a contract-change PR; do not invent a local backend substitute. Browser writes use the existing session/CSRF helper, not a new secret or approval flag.

## 5. Verify and prepare the PR

Stop `npm run dev` before tests manage servers:

```sh
npm run test:e2e -w apps/web -- --grep PF-018
npm run check
git diff --check
git status --short
git add apps/web docs/PROGRESS.md
git diff --cached --stat
git commit -m "PF-018: integrate the financial dashboard with real API state"
git push -u origin codex/pf-018-dashboard
```

Inspect all staged files. Never commit .env, local passwords, wallet keys or session cookies. Do not stage generated schema changes unless part of a separately reviewed contract change. Keep screenshots free of credentials/cookies and attach them as PR evidence.

```sh
cat > /tmp/prooffi-pf018-pr.md <<'BODY'
Closes #18.

Integrates the financial dashboard with real persisted API state and honest loading/error/policy/chain states.

Validation:
- Focused PF-018 browser tests: record actual result here.
- npm run check: record actual result here.

Screenshots and integration evidence: attach real desktop/mobile results here.
Known limitations: identify remaining backend/UI dependencies here.
BODY
```

Replace evidence lines with actual results, then:

```sh
gh pr create --repo akiibot/proofFi --base main --head codex/pf-018-dashboard --title "PF-018: real API financial dashboard" --body-file /tmp/prooffi-pf018-pr.md --reviewer akiibot
```

## 6. Integrate frequently and choose the next ready screen

Respond to review on the same branch, push changes and rerun checks. Incorporate main with `git fetch origin` and `git merge origin/main` when necessary. Resolve conflicts, preserving the existing session integration. Do not merge your own failing/unreviewed PR.

Next: PF-019 Constitution Builder after PF-006; PF-021 Time Machine after PF-009; PF-020 workspace after PF-010/PF-017. PF-022 approval/execution UI requires the corresponding backend dependencies. Follow GitHub issue blockers for red-team, emergency and audit screens. No backend dependency is replaced with a production mock just to finish a screen.
