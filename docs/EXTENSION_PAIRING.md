# Secure local extension pairing (PF-144 / issue #144)

Review candidate. Requires lead review of the additive authentication, SQLite migration and public contract before deployment. Existing recording environments and financial payloads are unchanged. No signing or financial session is granted by pairing.

## Installation and use

Build the reviewed extension and run the local companion on 127.0.0.1:3000 (website) and 127.0.0.1:8000 (API). No port discovery, remote backend, tunnel or broad network permission is added. After backing up the database and stopping its API, run `alembic upgrade head` with the intended local DATABASE_URL; never migrate a film/production database implicitly. The migration is additive and does not seed or modify financial records.

Load the release's unpacked folder in Brave/Chrome. The public manifest key gives this unpacked review build stable ID `ojikjchhfkimbcfjdnbelomgkfncghal` across installation folders. It is a public identity hint, not a session credential, signature, origin authentication or trusted publisher guarantee. No private CRX key was retained or bundled. A store-assigned identity may differ and needs its own pairing.

1. Open Vallet and choose **Connect to local Vallet**. Keep the code visible.
2. The fixed local website opens. Sign in there if needed; it returns to the connection page.
3. Verify this is your own request, enter the extension's eight-character code, and choose **Allow this extension**.
4. Return to Vallet. If reopened, choose **Resume checking**. When Connected appears, sign in normally.
5. Website Account → Settings → Connected extensions lists approved/configured installations. Revoke requires a separate confirmation and invalidates access immediately. A configured ID's persisted revocation overrides EXTENSION_IDS. Only fresh website-approved pairing re-enables it.

Pairing is installation permission only. The existing 30-minute password session, CSRF, financial checks, exact approval and execution consent remain required. Ordinary same-ID updates preserve approval. Browser restart clears credentials and pending polling secrets. Backend restart clears sessions and pending pairing requests, but preserves approved/revoked installations. Reinstalling with a different identity requires pairing again. This single-user/single-process companion does not claim to distinguish browser profiles sharing the same extension ID; revocation affects that ID's sessions together.

## Data flow and limits

Only trusted popup/panel messages can create, view, poll or reopen pairing. The worker derives chrome.runtime.id, contacts the fixed API and opens the fixed website. Content scripts, websites and external messages cannot invoke it. The selected investment/expense page is never sent during pairing.

Pending requests expire after five minutes. Codes use eight random characters excluding ambiguous symbols; only SHA-256 code and 256-bit polling-secret digests are held by the API. Five incorrect codes exhaust a request. A global five-creation/minute limit and 32-pending cap bound anonymous requests; as with the current local demo, process restart clears these in-memory limits. A hostile local process can cause denial of service; loopback is not an authentication boundary.

Only the non-secret request identifier appears in the URL. Codes and polling secrets are not in logs, URL fragments, local persistent storage or the website's connection-details response. The code is visible in the trusted extension UI and entered into the authenticated website. The polling secret stays in trusted-context chrome.storage.session and is not exposed to React. Polling occurs every five seconds only while explicitly active on the pairing screen. Reopening does not create a new request or financial operation.

The SQLite registry stores only extension ID, owner ID, approval and revocation times. Approval/revocation share the authentication lock and database transaction; a revoke cancels outstanding requests for that identity and removes its active sessions. Subsequent requests also recheck the persisted registry. An already admitted operation is not retroactively undone. Header IDs remain routing context, never authentication; exact supplied Origin, password/session credentials and CSRF remain enforced. No extension session can manage approvals or connections.

Pairing is explicitly unavailable in public deployment mode and for non-SQLite companions. No PostgreSQL migration or public registration is introduced. Existing explicitly configured IDs retain their previous transport behavior there. All auth responses, including errors, are no-store.

## Failure and recovery

Expired, exhausted, missing-after-restart and revoked requests require a new explicitly started pairing. Backend outages stop UI polling and show a resume action. Unknown website approval outcomes direct the user to Settings instead of retrying automatically. No session is issued by approval. Passwords remain unsaved. Financial operation journals are untouched; pairing, restarting and signing in never resend or reconcile transactions.

## Rollout and rollback

Publish as a separate security/contract-change PR stacked on #143, with regenerated OpenAPI/TypeScript, current checks and lead review. Keep the interactive preview and recording databases unchanged during development. Validate a fresh disposable database first, then upgrade a backed-up intended local database only as an explicit deployment step.

To roll back application code, preserve the registry and first clear EXTENSION_IDS and restart the API so older code cannot resurrect revoked configured IDs. Do not roll back to code that ignores revocations while configured IDs remain enabled. Populated migration downgrade intentionally refuses; retain the database and forward-fix. Empty-table downgrade is supported. No keys, financial snapshots, receipts or execution journals are deleted.

## Evidence

`services/api/tests/test_extension_pairing.py` covers real SQLite approval, revocation, expiry, replay, capacity, wrong/missing credentials, CSRF/origin/transport checks, concurrency, restart persistence, public-mode refusal and populated-downgrade refusal. `apps/extension/test/pairing-installed.mjs` exercises the installed extension and actual local website/API against disposable data with signing disabled. It uses a test-only copy pinned to 3500/8500 so the interactive preview is untouched.

Automated Chromium results and a user-operated Brave smoke test are distinct acceptance gates. The latter must be recorded from actual user operation; installing or running headless Chromium does not satisfy it.
