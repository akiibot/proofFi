# Context research contract (#134)

Review pending. POST /context/analyse accepts an explicit user-approved, bounded page observation. It returns page claims, source references, missing fields, research availability and financial_authority=false. Existing financial contracts are unchanged. No database write, background research, action creation, policy confirmation or signing occurs.

Input source URL is public HTTP(S), without credentials, query or fragment. Up to 12,000 characters of selected text; product name is separately confirmed before external research. Extracted fee/liquidity/billing/currency statements are literal page excerpts, not independently verified facts. No historical return series, comparable-user statistics or review score is inferred.

Wigolo runs separately on an explicitly configured 127.0.0.1 origin. Disabled by default. RESEARCH_DOMAINS must name approved public sources; search outputs outside these domains are discarded. This adapter calls only bounded /v1/search with the confirmed public product name, never cookies, account balances or complete page text. Redirects, environment proxies, provider errors and oversized responses fail closed. Raw search excerpts remain untrusted and never enter the financial engines as authority.

A separate service process is not a claim that upstream licensing or data-provider access terms have been reviewed. The owner must confirm applicable distribution/service terms before release.
