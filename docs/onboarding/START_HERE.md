# Start here for Farid and Wasik

Repository: https://github.com/akiibot/proofFi

Farid: @Alfa5nm, finance/risk backend. Wasik: @WasikZubair, frontend UI/UX. Each person uses their own computer/checkout, database, credentials and branch. Do not use the lead's GitHub account or share .env files.

## 1. Accept access using your own GitHub account

Sign in to GitHub as your confirmed account. Open the repository and accept its collaborator invitation from GitHub notifications or invitation email. If there is no invitation, ask the lead to check its status. Do not create another repository or fork as a workaround.

## 2. Check prerequisites

Use a macOS/Linux terminal, or Ubuntu under WSL2 on Windows. The documented commands assume Git, GitHub CLI, Python 3.11 and Node 22.19.0/npm 10.9.3 are installed. Install missing prerequisites before continuing; do not replace the project's Python or Node version to accommodate another local installation.

```sh
git --version
gh --version
python3.11 --version
node --version
npm --version
```

Expected runtimes: Python 3.11.x, Node v22.19.0, npm 10.9.3. If you already use nvm, `nvm install 22.19.0` and `nvm use 22.19.0` select the project Node version. Native Windows shells are not the supported command environment; use WSL2 for these steps.

## 3. Authenticate GitHub CLI

```sh
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
gh api user --jq .login
```

The final line must show your own handle: Alfa5nm for Farid, WasikZubair for Wasik. If it shows akiibot or another person, switch to your own account before pushing or reviewing.

## 4. Clone and choose the setup branch

```sh
git clone https://github.com/akiibot/proofFi.git
cd proofFi
git fetch origin
```

At this handoff, main contains only the bootstrap README; application PRs have not been merged. For setup/review now, use the published onboarding branch (includes the session implementation):

```sh
git switch --track origin/codex/pf-005-developer-instructions
```

If that branch already exists locally, use `git switch codex/pf-005-developer-instructions`. Once the lead confirms the application is merged to main, use `git switch main` and `git pull --ff-only` instead. The preview branch is for setup/review; do not add feature commits to it.

## 5. Install, migrate and seed

From the repository root:

```sh
python3.11 scripts/bootstrap.py
```

This installs locked Python/Node dependencies, migrates SQLite, creates the demo state and provisions a random local login password. It preserves existing data and credentials on subsequent runs. No separate database server, wallet key, testnet funds or LLM API key is needed for this setup.

Do not manually rebuild tables, create a second backend/frontend, or edit shared models to make setup work. Report a failure with the exact command and sanitized error in PF-001 (#1).

## 6. Read your local password and run the application

Open `.local/demo-password.txt` in your local editor. Keep its value private. Do not paste it into GitHub, screenshots, logs or chat.

```sh
npm run dev
```

Open http://127.0.0.1:3000 and sign in. Confirm the dashboard reads $12,000 synthetic assets, $7,000 tuition and $800 monthly living costs from the database. Constitution activation and chain configuration are explicitly unfinished. API documentation: http://127.0.0.1:8000/docs. A valid session does not authorize financial execution.

## 7. Run baseline checks

Stop the dev servers with Ctrl+C. Browser tests launch both services themselves.

macOS:

```sh
npx playwright install chromium
npm run check
```

Linux/WSL2:

```sh
npx playwright install --with-deps chromium
npm run check
```

Every check must pass. Test counts grow as features land; do not hard-code a particular count. Do not run two copies of the app/browser tests against ports 3000/8000. For custom manually provisioned password hashes, configure the matching PROOFFI_TEST_PASSWORD for browser tests as described in AUTHENTICATION.md.

## 8. Read the shared rules before editing

Read AGENTS.md, CONTRIBUTING.md, docs/ARCHITECTURE.md, docs/DECISIONS.md, docs/OWNERSHIP.md, docs/API.md, docs/AUTHENTICATION.md, docs/ISSUE_BACKLOG.md and your actual GitHub issue. For Farid, then follow FARID.md. For Wasik, follow WASIK.md.

Important shared conventions: money is integer USD cents; token base units are decimal strings; probabilities are basis points. Pydantic/OpenAPI are canonical and TypeScript types are generated. Do not hand-edit generated schemas, change migrations, routes, authentication, signing or certificate encodings in a feature PR. A needed shared change gets a separate lead-reviewed contract-change PR.

## 9. Help unblock the review gate

Review the foundation PR #34. Before submitting an approval, inspect its exact diff and run its checks; approve only when satisfied, otherwise request concrete changes. To test that exact PR, stop dev servers, keep your worktree clean, run `gh pr checkout 34`, rerun bootstrap and npm run check. It predates the login/session branch, so its UI does not require sign-in. Return to the onboarding preview branch afterward and rerun bootstrap.

The lead approved architecture in chat; another developer's GitHub review is still required by contribution rules. The lead integrates the stacked PRs in dependency order. Do not bypass protection, merge failing CI, or close dependency issues merely to begin work.

## 10. Start feature work only from merged main and a ready issue

Farid starts PF-008 after PF-001..PF-005 merge. Wasik starts PF-018 after those foundation issues and PF-033 merge, because the session changes touch the API client/proxy/homepage integration he will consume. The lead updates ready/blocked labels based on actual merged prerequisites. You can complete all setup, reading and review steps while an issue is blocked.

For each feature: one issue, one branch, one reviewable PR. Commit only owned files. Update from main regularly, keep the API bootable/frontend buildable, and ask the lead for a shared contract change rather than recreating an unavailable component.
