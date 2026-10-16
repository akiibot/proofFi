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

## 4. Clone and use current main

```sh
git clone https://github.com/akiibot/proofFi.git
cd proofFi
git fetch origin
```

```sh
git switch main
git pull --ff-only
```

Foundation, certificate primitives, the signer/RPC adapter, authenticated sessions and bound approval recording are merged. Always refresh `main` before creating an issue branch. Do not develop on the onboarding documentation branch.

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

## 9. Check current issue and PR state

Read the assigned GitHub issue and check for an existing branch or PR before creating work. PF-008 already has PR #43 and must be reviewed or refreshed rather than duplicated. PF-018 is ready after PF-033 merged. The owner waived teammate approval, but required PRs, strict current CI, dependency gates and lead acceptance of sensitive/shared changes remain. Do not bypass protection, merge failing CI or close dependency issues merely to begin work.

## 10. Start feature work only from merged main and a ready issue

Farid should inspect the existing PF-008 PR #43 before changing its branch. Wasik can start PF-018 from current `main`. The lead updates ready/blocked labels based on actual merged prerequisites. You can complete all setup and reading steps while another issue is blocked.

For each feature: one issue, one branch, one reviewable PR. Commit only owned files. Update from main regularly, keep the API bootable/frontend buildable, and ask the lead for a shared contract change rather than recreating an unavailable component.
