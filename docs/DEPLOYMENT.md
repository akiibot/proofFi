# Vercel + Render Free + Supabase Free (PF-047 / #120)

Runtime integration #122 is approved, merged at3b9fe98 and deployed on the reviewed
PF-046 storage contract (#121, merge9e95a25). The Vercel/Render preview now uses
Supabase persistence. The initial ephemeral SQLite deployment completed under
#117 was exported before switching. Original private local A/B/C databases,
wallets, credentials and genuine evidence are never uploaded.

## Exact deployment shape

- Vercel frontend: `https://prooffi-preview.vercel.app`, Next.js root `apps/web`,
  Node22.x, workspace sources outside the root enabled. Only server-side
  `API_BASE_URL=https://prooffi-preview-api.onrender.com`; no database/signer keys.
- Existing Render backend: `prooffi-preview-api`, **Free**, one API process, no
  persistent disk or paid database. Build `pip install uv==0.13.1 && uv sync --locked --no-dev`.
  Start command: `.venv/bin/python -u scripts/render_postgres.py`.
  Health: `/health`; auto-deploy stays off. `render.yaml` records the configuration.
- New Supabase Free project: `prooffi-testnet`, Ohio, project `iwbwcuttltepreiapnoa`.
  PostgreSQL17.11. Data API disabled; SSL enforcement enabled and verified after
  managed restart. Use the dashboard's **session** pooler on port5432 for IPv4;
  the transaction pooler on port6543 is refused by the reviewed adapter.
- Store application tables and the immutable signed-byte journal only in
  `prooffi_private`. Existing session/CSRF authentication stays in FastAPI;
  Supabase Auth/client libraries do not replace it.

## Private connection and startup

Only Render receives `DATABASE_URL`, using `postgresql+psycopg`,
`sslmode=verify-full` and `sslrootcert=config/supabase-prod-ca-2021.crt`.
Construct the URL with SQLAlchemy URL utilities so password characters are encoded
correctly. Never paste the value into GitHub/chat, process arguments or Vercel.
Keep the existing dedicated hosted `DEMO_PASSWORD_HASH` and exact HTTPS origin
`TRUSTED_ORIGINS=["https://prooffi-preview.vercel.app"]`, with
`DEPLOYMENT_MODE=public`, `COOKIE_SECURE=true`, Python3.11.14 and uv0.13.1.

The checked-in certificate is the public CA downloaded from the Supabase project's
Database Settings link:
`https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt`.
File SHA256: `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.
No private key is included. Default-trust TLS failed locally; the dashboard CA
made full certificate/hostname validation pass. Verification must stay enabled.

`render_postgres.py` validates public auth/TLS and explicit execution settings,
then runs the separate PG migration history and idempotent seed under the approved
transaction lock before starting one worker. It never confirms a policy, selects
probabilities, records expenses or executes a transfer. If execution is false, it
refuses a transaction signing key. Execution true requires explicit server-only
configuration and retains all existing independent verifier/approval/executor gates.

## Fresh initialization and financial boundaries

The owner delegated selection of the existing funded synthetic profile for this
new, still-empty Supabase database. The selected file is
`docs/funded-demo-config.json`; selection digest:
`d966ea53f445fdf948fc92a174d07db425aba90753d5c7683279a47f85d30314`.
It records $17,000 synthetic starting cash, no income, unchanged tuition/reserve/
living obligations,1000 paths over120 days (seed18421),2% daily volatility,20%
probability of an additional $2,000 emergency and a $1 synthetic planning fee.
These are illustrative inputs, not calibrated forecasts or actual assets.

After reviewed runtime merge, use the existing `provision_funded_demo` service in
one locked transaction on the **new empty** PG store, verifying the exact selection
digest first. It keeps baseline v1, appends funded v2, selects that exact config and
leaves the Constitution unconfirmed. Do this before first startup's baseline seed;
subsequent idempotent seeds preserve it. Refuse existing user/config/audit/history
rather than transforming an operational database. Do not import local private DBs.
Before switching Render, recheck/export its disposable preview state: stop for any
unexpected state/policy/audit change rather than silently discarding user work.

Initial hosted settings remain `DEMO_MODE=false`, `EXECUTION_ENABLED=false`, with
no signer key. Durable PG removes the temporary-storage blocker; actual hosted
execution still requires reviewed signing readiness, dedicated testnet configuration,
explicit policy activation and exact per-action approval. No policy activation,
expense, reset, token funding or transfer is authorized by the database selection.
No LLM credentials or deterministic planner mode are silently configured.

## Evidence and remaining gates

The PG suite reuses meaningful existing policy/approval/signing/dispatch/receipt/
workflow/emergency assertions against actual PG database fixtures. Chain adapters
remain isolated tests, not genuine transfers. The inherited reset fixture is
explicitly adapted for PG; its five status guards use FK-complete history instead
of bypassing constraints through SQLite's native connection. Existing SQLite
assertions remain unchanged. Both ordinary CI jobs and PG CI must pass on the PR head.

An isolated real-PG browser journey verified login/dashboard, API restart revoking
the session, reauthentication and exact same canonical state hash/balances after
restart. No financial mutation or active policy was used in that journey.

Hosted validation must check actual health, login/Secure/HttpOnly/Strict cookie,
protected reads, Origin/CSRF rejection, logout/session revocation and state/config/
policy/history hashes across a deliberate backend restart. Account for Free Render
cold starts (~1minute), sessions lost on restart and Supabase Free inactivity pause
(currently1week); data persistence does not make either free service always-on.
No keep-alive workaround or paid upgrade is part of this deployment.

Keep the single remaining migration/deployment checklist in
[#119](https://github.com/akiibot/proofFi/issues/119), with implementation/integration/
evidence/owner decisions distinguished. #120 closes only after actual hosted
integration evidence and any remaining signing decisions are recorded honestly.


## Hosted rollout evidence, 2026-10-18

Runtime #122 merged at3b9fe98 after owner approval and all three current CI jobs
passed (638 backend/95 browser on each OS;299 real PG tests). Supabase migration
and the selected synthetic profile were provisioned in the new database only.
All14 application tables have RLS; anon/authenticated/service_role cannot access
the private schema. Original local demos were preserved.

The first Render rollout dep-dbabtjlg1s2s73bhj4dg reported Live, but actual protected
reads still returned baseline v1/$12,000 and logs showed the old preview launcher.
This was rejected as hosted acceptance. The exact cause of that inconsistent
rollout is unresolved; do not claim a proven uv defect.

With the installed virtualenv Python directly launching the same reviewed script,
dep-dbac3k67bikc73e2gakg became healthy in1m27s. Actual Vercel-proxied authentication,
secure cookies, Origin/CSRF refusals, logout and protected reads passed. Genuine
browser dashboard showed funded v2/$17,000, inactive policy and snapshot hash
`d17754200d0bb9e28fc1e598b9f1010f83750e3229dc87bb4f884b5eba456877`.
No policy activation, expense, reset or transfer occurred. The deployment blueprint
uses the verified direct launcher to reproduce the working configuration.

An actual Render restart launched a new process (pwdgs -> z8hcx), revoked the old
browser session and preserved exact protected-response snapshots after a fresh
login: financial state/hash, draft, inactive policy/history, provision audit and
chain readiness. Independent HTTPS checks passed secure cookies, authenticated
reads, Origin/CSRF refusal and logout before and after restart. This proves
persistence of the current selected profile, not a new cloud transfer. Execution
and chain signing remain unconfigured/disabled pending separate owner decisions.
