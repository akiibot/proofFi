# ProofFi

**Team start page: [task checklist, owners and delivery flow](TASKS.md).**

ProofFi separates financial intelligence from financial authority. An untrusted planner proposes actions; trusted policy and simulation checks determine whether a signed certificate may be issued; the executor independently checks that certificate and human approval before any testnet signing.

**Current delivery: reviewable foundation, not a completed financial application.** The browser reads a real migrated SQLite database. Policy activation, planning, simulation, certificates, approvals, execution and the three scenarios remain tracked implementation work. Unfinished endpoints return `501 NOT_IMPLEMENTED`. There is no live-chain evidence yet.

## Start from a clean checkout

Install Git, **Python 3.11**, **Node 22.19.0** (use `.nvmrc`) and npm 10.9.3. No database server, wallet key or AI API key is needed for the foundation.

```sh
git clone https://github.com/akiibot/proofFi.git
cd proofFi
# While foundation is awaiting merge:
git switch codex/prooffi-foundation
python3.11 scripts/bootstrap.py
npm run dev
```

Open **http://127.0.0.1:3000**, then sign in using the password saved locally in ignored `.local/demo-password.txt`. API docs are at **http://127.0.0.1:8000/docs**, health at `/health`. Bootstrap installs locked dependencies, provisions owner-only local demo credentials, migrates, and idempotently seeds the database. A second run preserves existing data and `.env`. Never commit `.env`; each developer has their own database/credentials. The seed policy is a draft awaiting explicit confirmation.

```sh
# First time only for browser tests:
npx playwright install chromium
npm run check
```

This runs backend tests/Ruff, contract generation, frontend lint/typecheck/build and a real browser-to-API/database smoke. Stop `npm run dev` first: browser tests manage their own servers on ports 3000/8000. CI uses the same flow. On Linux install Playwright OS dependencies with `npx playwright install --with-deps chromium`. Windows: use WSL2 for the documented commands.

## Three developer handoff

Start with the [three-developer handoff](docs/TEAM_HANDOFF.md), then follow the exact [Farid](docs/onboarding/FARID.md) or [Wasik](docs/onboarding/WASIK.md) steps. Read [CONTRIBUTING.md](CONTRIBUTING.md), [ownership](docs/OWNERSHIP.md), [architecture](docs/ARCHITECTURE.md), [decisions](docs/DECISIONS.md) and your [GitHub issue](docs/ISSUE_BACKLOG.md). Foundation schemas require lead approval and merge before dependent branches start. Do not rebuild the database, contracts or repository scaffold in your issue.

- **Lead / akiibot:** foundation, shared contracts, trusted verification/approval/execution, integration.
- **Farid:** financial policy, stress/Monte Carlo, safe-action optimization, planner backend.
- **Wasik:** frontend UI/UX and typed API integration.

Farid is `Alfa5nm`; Wasik is `WasikZubair`. Write-access invitations have been issued. Accept the invitation before repository review or write access is available. Their issue ownership and CODEOWNERS paths are recorded.

## Working commands

| Task | Command from repository root |
|---|---|
| Start both services | `npm run dev` |
| API alone | `PYTHONPATH=services/api .venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8000` |
| Migrate | `.venv/bin/python -m alembic upgrade head` |
| Preserve and seed missing demo | `PYTHONPATH=services/api .venv/bin/python -m app.db.seed` |
| Backend tests | `.venv/bin/python -m pytest -q` |
| Generate shared contracts | `npm run contracts` |
| Detect migration/model drift | `.venv/bin/python -m alembic check` |
| All foundation checks | `npm run check` |
| Publish/reconcile issue drafts | `python3.11 scripts/publish_issues.py --repo akiibot/proofFi --publish` |

Use `npm run dev` for the web: it loads root `.env` for the private backend proxy. Starting Next directly without the configured API environment is unsupported. API-alone reads root `.env` itself. A reset of an existing demo will be implemented in PF-028; bootstrap never deletes your data.

## Honest financial and chain semantics

The seed is **$12,000 synthetic assets**, **$7,000 tuition**, **$800/month living costs**, and a **draft $2,000 emergency floor**. No expected income is specified. $12,000 - $7,000 - $2,000 - $3,200 = **-$200**, even before fees or shocks. A positive hero allocation requires a clearly displayed, explicitly approved assumption change. No safe amount or risk result is fabricated.

Proposed chain: Base Sepolia, chain ID 84532. Action: an ERC-20 **test allocation to an approved demo destination**, not a real investment or yield product. Token contract, destination, wallet, RPC and funding remain unconfigured. See [chain contract](docs/CHAIN.md). A synthetic USD unit maps to one test-token unit solely for demonstration.

## Repository map

```text
apps/web/                    Next.js UI and generated TypeScript client
services/api/app/models/     Lead-owned canonical Pydantic contracts
services/api/app/db/          ORM, sessions, seed, versioned state repository
services/api/migrations/      Alembic migrations
services/api/app/policy/      Farid's policy module
services/api/app/simulation/  Farid's risk module
services/api/app/optimizer/   Farid's safe-action search
services/api/app/planner/     Untrusted proposal adapters
services/api/app/verifier/    Lead's independent verification/certificates
services/api/app/approvals/   Lead's human authorization
services/api/app/execution/   Lead's executor, signer and chain adapter
contracts/                   Generated OpenAPI, internal schema and examples
scripts/                     Setup, development, contract and backlog tools
docs/                        Architecture, decisions, issue manifest, handoff
```

The starter binds to loopback. PF-033 adds authenticated cookie sessions, origin/CSRF checks and explicit proxy routes; see [authentication setup](docs/AUTHENTICATION.md). Public deployment requires explicit HTTPS origins and Secure cookies. A login session does not itself approve a financial action. No secrets go into `NEXT_PUBLIC_*`, browser storage or prompts. This is single-user/testnet software, not production custody.
