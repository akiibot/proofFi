# Demo authentication contract

PF-033 implements a single-user, single-process demo session boundary. This is a contract-change PR proposing HTTP API v1.1.0. Money, state snapshots, certificates, chain transactions and their schema versions remain unchanged. The new contract requires lead review before integration; it does not replace the approved architecture.

## Browser and API flow

1. Bootstrap generates a random demo password into ignored `.local/demo-password.txt` with owner-only permissions. Only its salted scrypt hash is stored in ignored `.env` as DEMO_PASSWORD_HASH. Credentials are never printed by setup. Existing nonempty authentication configuration is preserved.
2. The user visits `/login` and submits the password to `POST /auth/login` through the Next.js proxy. Login requires an exact trusted Origin and validated bounded password input. No default password is accepted.
3. Backend creates a random opaque session cookie, HttpOnly, SameSite=Strict, Path=/, with a 30-minute lifetime. The token is not returned in JSON; the session store uses its SHA-256 hash as the lookup key. Login rotates/revokes an existing cookie session.
4. Response `SessionInfo` includes fixed user_id `demo-user`, csrf_token and expires_at. `GET /auth/session` retrieves these for an authenticated session, with no-store caching.
5. Every protected API read requires the cookie. Every protected POST additionally requires an exact trusted Origin and the matching `X-CSRF-Token`. The backend derives actor_id from the session; caller-supplied Authorization/X-User-Id/X-Forwarded headers confer no authority. The prototype API_TOKEN is no longer accepted for human authentication.
6. `POST /auth/logout` requires the same checks, revokes the server session, and deletes the cookie. Replaying the old cookie fails. Expiry is checked by the backend even if a caller manually retains the cookie.

Routes: POST /auth/login (LoginRequest -> SessionInfo), GET /auth/session (-> SessionInfo), POST /auth/logout (-> LogoutResult). New error codes FORBIDDEN and RATE_LIMITED use existing ApiError shape with HTTP 403/429. Missing sessions use 401; missing/invalid password-hash configuration uses 503. `/health` remains public.

The explicit proxy allowlist forwards only known domain/auth paths, the session cookie, Origin and CSRF header. It never injects a backend credential or forwards arbitrary identity/host/proxy headers. Requests are no-store, redirects refused, and server credentials never returned. The login UI and sign-out control exercise actual backend sessions. Client code obtains CSRF via the typed session helper; nothing is stored in localStorage.

## Limits and deployment

Sessions are in memory, capped at 32, protected by a process lock. A process restart revokes all sessions. Run one API worker for the single-user MVP; a multi-worker deployment would need a separately reviewed shared session store. No database migration was added.

Login attempts are globally capped at 5/minute for this single demo account; failed credentials count. Authenticated mutations are capped at 120/minute per session. Limits reset on API restart. These lightweight limits do not provide distributed abuse protection; no such claim is made.

Local development defaults to loopback origins http://127.0.0.1:3000 and http://localhost:3000, without Secure on cookies so local HTTP works. Public deployment must explicitly set DEPLOYMENT_MODE=public, COOKIE_SECURE=true and TRUSTED_ORIGINS to a JSON array of exact HTTPS frontend origins. Settings reject public HTTP origins or insecure cookies. Serve the frontend via HTTPS, keep the backend private behind the proxy, and configure a unique deployment password hash. This is a demo-user login, not identity verification or production account management.

## Developer setup

Run `python3.11 scripts/bootstrap.py` again after checking out this branch. It provisions missing local authentication without deleting the database or existing credentials. Read `.local/demo-password.txt` locally, start `npm run dev`, and enter that password on `/login`. Never post the file or .env contents in chat, issues, logs or screenshots. Custom operators who provision DEMO_PASSWORD_HASH themselves retain responsibility for the corresponding password; bootstrap does not invent or replace it.

Browser tests read the ignored local password from the Node test runner, never from browser source. If supplying a custom DEMO_PASSWORD_HASH, set PROOFFI_TEST_PASSWORD to the matching password in the test runner environment. Playwright tracing is disabled because traces can retain form inputs/session cookies; failure screenshots can still be inspected without exporting credentials.

## Independence from approval and execution

A session identifies the human demo user. It does not activate a Constitution, approve a financial action, issue a certificate or authorize signing. Those operations still require their own explicit endpoints and exact stored bindings. Authenticated calls to unfinished features continue returning NOT_IMPLEMENTED. PF-013 records human approval; PF-014 independently checks all authorization and atomically claims execution.
