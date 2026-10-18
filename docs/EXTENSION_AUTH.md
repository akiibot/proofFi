# Extension authentication proposal — #110

This additive contract requires lead review before runtime activation. Existing website cookie sessions, Origin/CSRF rules and financial payloads are unchanged. No migration or signer change.

POST /auth/extension/login accepts the existing LoginRequest and returns ExtensionSessionInfo (session_token, csrf_token, expires_at), never a cookie. GET /auth/extension/session returns SessionInfo; POST /auth/extension/logout revokes only that session. Domain routes accept X-ProofFi-Extension-Session plus X-ProofFi-Extension-Id. All mutations still require matching X-CSRF-Token. Extension IDs must be explicitly configured in EXTENSION_IDS; the default empty list disables access.

The extension ID is routing context, not proof of identity. Password authentication and a cryptographically random session token provide authentication. When Origin is present it must exactly match chrome-extension://<configured ID>; unapproved supplied origins refuse. Host-permission worker requests may omit Origin, so absent Origin does not grant authority and still requires the configured ID and password/token. Cookies and extension tokens cannot be combined; tokens cannot cross transports or extension IDs. Existing 30-minute expiry, 32-session capacity, shared failed-login throttling and 120 mutations/minute remain. Restart revokes all sessions.

Credentials stay in chrome.storage.session restricted to trusted contexts; never store passwords or credentials in local/sync storage. TLS is required for remote deployment; initial companion permits only loopback and does not expose RPC/signing keys. A hostile local process or compromised extension can steal/use its credential; no stronger host-compromise protection is claimed.

Validation: 25 extension and existing PF033 authentication tests passed. Actual installed Brave/Chromium integration and full combined checks remain release gates. Public APIs add three auth operations; all canonical financial models and certificate formats stay unchanged.

Contract version: HTTP API1.2.0 (additive extension sessions); canonical financial and certificate schema versions remain unchanged.
