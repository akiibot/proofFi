# Vallet contextual briefing and research chat — PF-149

Separate contract/security review candidate stacked on #150 (readiness) and #146 (pairing). Existing financial models and transaction authority are unchanged. The context feature explains public products; it does not purchase the product, generate an affordable amount, approve, execute or sign.

## Experience and data flow

This page opens a product briefing and a chat composer. “Allow on this site” grants one exact public origin through browser optional host access and a separate local preference. No context API call occurs beforehand. Later openings can analyse that public page while the view is open. There is no background research/watchlist or upload while closed. Private account/payment/login/portfolio paths and unknown pages are excluded; this is a conservative heuristic, not proof that all public DOM text is nonsensitive. Forms/hidden/private content remain excluded and common identifiers redacted. Users can inspect the bounded selected text in Sources & privacy.

The worker checks exact source identity and live browser permission as well as the saved preference on every brief/chat request. Revocation clears the current briefing, conversation and saved session transcript for the origin; removal through the browser also invalidates capture/permission. Content scripts cannot access credentials or invoke the API. Query-only SPA changes require a fresh capture. Responses from a previous navigation are discarded.

A provider homepage is a directory, not a product. It asks the user to name/open a particular fund. A recurring investment contribution is not inferred to be a bill. The fee parser accepts only an explicitly labelled expense ratio, including the actual iShares prospectus hint/multiline layout. A homepage percentage never becomes the selected product’s fee. Missing facts remain missing.

The fee visualisation uses user-entered example USD cents and the quoted annual expense ratio; rounded cents at constant balance. Its labelled bars show annual fee at100/500/1000USD. It is not performance, yield, a brokerage quotation or an investment recommendation; trading/FX costs are excluded. Historical returns, drawdowns, reviews and comparable-investor outcomes remain unavailable without an appropriate authorised dataset. Search snippets cannot populate them.

“My commitments” loads the existing actual backend budget and rules separately. Its financial actions retain existing explicit acknowledgement and backend checks. Advanced expense/candidate controls remain reachable through `/context/advanced`; an arbitrary subscription is never sent through the fixed emergency endpoint. Unsupported product purchase remains research-only.

## API and provider boundary

Adds canonical `POST /context/brief` and `POST /context/chat` and generated OpenAPI/TypeScript. Both use existing session authentication/CSRF. Requests carry bounded public page context, exact source, explicit consent and (chat only) the user question plus at most12 bounded prior messages. No financial state is attached. Briefing returns literal source-linked observations and a typed fee observation. Chat returns status, bounded explanation, validated source IDs, suggested questions, sources, provider mode and financial_authority=false.

The user’s opt-in explains that selected public page text and their submitted messages reach the backend AI provider; a public product name can reach approved search providers through Wigolo. User questions are data too; users should not paste credentials. Relevant public snippets are contextual evidence, not independently verified facts. Answer citations must refer to supplied source IDs; this prevents invented citation identifiers but is not a guarantee against all model hallucination. Full source links remain visible for checking. Returned text is escaped React content, never executable HTML.

CONTEXT_CHAT_ENABLED defaults false. The local operator must explicitly enable it with existing server-side PLANNER_PROVIDER=vertex_express, VERTEX_MODEL and LLM_API_KEY. The current adapter deliberately supports that already-working provider; missing credentials, unsupported provider, timeout, malformed JSON or unknown citations produce explicit unavailable mode, never demo output under a live label. Provider lookup/request/parse runs in a disposable bounded30s subprocess with fixed HTTPS host, schema validation and bounded response; combined search/chat worker deadline50s. No tool execution, signer, approval or verifier capability is given to the model. The public-context test does not send the user's actual budget.

Site grants persist locally; ordinary auth and the bounded plain-text transcript remain session-only. Reopening can restore up to24 plain text turns keyed to the exact page identity; it never restores a safe verdict, evidence authority, checked financial consent or automatically sends a question. Browser restart clears transcripts/auth. Backend restart clears sessions. Financial attempt journals are unchanged and never replayed by opening chat.

## Verification and limits

Focused tests cover expense-ratio parsing, yield exclusion, homepage ambiguity, account-path refusal, malformed/oversized history, unavailable/live labels, unchanged finances and citations. Installed Chromium exercises real API/SQLite with isolated RPC only for the existing financial tests, and no provider credential for its honest chat-failure test. The separately invoked insight-live harness uses a real public iShares page and the configured live provider against a disposable DB/profile, with no wallet/RPC/signing. It pregrants only its test-copy origin; it does not count as real Brave permission-dialog acceptance.

Run `npm run test:insight-live -w @prooffi/extension` only with an explicit private existing backend configuration path in VALLET_LIVE_PROVIDER_ENV. That path/key is not logged or bundled. Normal CI never depends on a paid/external live call. No model training/cost/privacy guarantees beyond the configured provider are invented.

The local runtime is an owner-requested preview; lead review and current Linux/Windows/PostgreSQL CI remain gates. No new live transaction or changed baseline is part of this work. See PROGRESS.md for actual results and remaining gates.
