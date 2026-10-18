# Vercel + Render free preview (PF-045 / #117)

This is a disposable preview of the reviewed application, with execution disabled.
It is not the durable testnet demo. No local database, `.env`, `.local`, wallet key,
signed transaction or browser session may be uploaded. The completed local MVP
and its genuine A/B/C evidence remain separate.

## Render

Use a **new** Python web service from reviewed main, repository root, **Free** plan,
one process, no disk and no paid database. `render.yaml` records the settings.
Build: `pip install uv==0.13.1 && uv sync --locked --no-dev`.
Start: `uv run --no-sync python scripts/render_preview.py`. Health: `/health`.
Python 3.11.14, uv 0.13.1. Disable automatic deploys so an unreviewed future main
change cannot alter this preview without validation.

Set `TRUSTED_ORIGINS` to a JSON array containing only the exact HTTPS Vercel
production origin. Set a **new preview-only** `DEMO_PASSWORD_HASH` using the
existing scrypt format. Keep its plaintext password private. Do not reuse the
local demo password. No signer, RPC, verifier, LLM or transaction configuration is
required for this initial baseline preview; leave these secrets unset.

The entry point refuses execution enabled, a transaction signing key, an original
database path, insecure/public-mode mismatch or an absent/malformed password hash.
It runs existing migrations, idempotently seeds only the original $12,000 baseline
and draft Constitution, then starts one API worker. No policy is activated, no
probabilistic assumptions selected, no expense recorded and no transfer attempted.
`DEMO_MODE=false` disables demo-only emergency/reset tooling in this preview.

Render Free sleeps after 15 minutes idle. Cold starts can take about a minute,
longer than the browser proxy deadline: wake `/health` and retry after it is ready.
SQLite data may disappear on sleep, restart or redeploy. Sessions always disappear
on restart. Free usage quotas apply; do not enable paid upgrades or add-ons.
See [Render Free limits](https://render.com/docs/free).

## Vercel

Create a separate ProofFi project; framework Next.js, root `apps/web`, Node 22.x,
npm workspace install from the repository root, build `npm run build` in the app.
Include files outside the root directory for workspace dependencies. Keep Fluid
Compute enabled with at least a 35-second function duration for the existing proxy.
Set only server-side `API_BASE_URL` to the new Render HTTPS origin. No backend
password/hash, signing key or `NEXT_PUBLIC_` secret belongs on Vercel.

Deploy a clean tracked-source export of the reviewed commit. Never deploy the
working repo directory containing private ignored files. Do not connect unrelated
Vercel projects or deploy the unmerged website/extension PRs. Record the exact
commit and both URLs after provisioning.

## Hosted validation

Check actual API health; unauthenticated protected reads return 401; wrong Origin
login is rejected; valid login through Vercel sets HttpOnly/Secure/SameSite=Strict;
session and authenticated state reads work through the proxy; a mutation without
CSRF is rejected; logout revokes the session. Do not record an expense, confirm
policy or execute a transfer as a deployment check.

The initial dashboard and Constitution draft can be inspected. Positive optimizer,
certificate issuance and live execution are not claimed: trusted assumptions,
active policy and chain authority are deliberately absent.

## Remaining deployment checklist

- [x] **Implementation:** execution-disabled startup and free service configuration prepared.
- [ ] **Integration:** review/merge deployment PR after current required checks pass; create free Render and Vercel projects and connect exact HTTPS origins.
- [ ] **Evidence:** clean startup, full local check/current CI, hosted auth/session/CSRF/proxy checks and exact deployed commit/URLs.
- [ ] **Owner decision:** lead review of the prepared public runtime configuration; owner enters the dedicated preview credential in Render when prompted.

No optional enhancements are included. The local MVP checklist remains in
[PROGRESS.md](PROGRESS.md).
