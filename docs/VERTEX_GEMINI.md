# Vertex Gemini configuration (PF-167)

The Next.js browser calls the existing server-side Vercel proxy; the Python
backend on Render calls Vertex AI. Supabase remains private storage. No Gemini
credential belongs in Vercel, Supabase, browser storage, prompts or GitHub.
The existing UI, routes, public schemas, database and financial authority are
unchanged. Summary, translation and query generation are private Python helpers,
not new public endpoints or UI features.

## Render

In the existing `prooffi-preview-api` service's Environment panel, keep:

```dotenv
PLANNER_PROVIDER=vertex_express
PLANNER_MODE=live_llm
LLM_API_KEY=<your Vertex AI Express API key; enter privately>
GEMINI_REASONING_MODEL=gemini-3.8-flash
GEMINI_REASONING_FALLBACK_MODEL=gemini-3.5-flash
GEMINI_SUMMARY_MODEL=gemini-3.5-flash
GEMINI_TRANSLATION_MODEL=gemini-3.5-flash
GEMINI_QUERY_MODEL=gemini-3.5-flash
```

`GEMINI_API_KEY` is also accepted, using the same Vertex Express endpoint.
Use either `LLM_API_KEY` or `GEMINI_API_KEY`. If both are present, they must be
identical; different values are refused without attempting authentication.
This alias does not turn an AI Studio-only key into a Vertex credential or
switch to the Gemini Developer API. Never enter the literal placeholder above.

The reasoning role uses `GEMINI_REASONING_MODEL` when supplied; otherwise it
retains the existing `VERTEX_MODEL`. Thus existing deployments work without new
variables. Task helper models must be explicitly configured. Model IDs are
validated and sent only to the fixed Google host; they cannot select a custom
host or path. Preserve all existing database, trusted-origin, session, chain and
signing settings. Do not enable `DEMO_MODE` as part of AI setup.

The owner allowed supported replacement models after live testing. The above
replacement IDs both accepted genuine Vertex Express requests, and the new
worker passed each role with synthetic inputs on 2026-10-20. The key used was
the ignored **local** key, not a copy from Render; hosted key equality was not
verified. See [safe evidence](../evidence/pf-167-vertex-tasks.json).
Google's [lifecycle table](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/model-versions)
lists the requested Gemini 2.5 Pro/Flash retirement date as October 20, 2026.
Do not silently replace a model when access/lifecycle changes: select and test
operator configuration explicitly. Availability and output are not guaranteed.

Save environment changes and deploy the **reviewed merged** backend revision
after required CI/lead acceptance. Saving new names while the previous source
is deployed does not activate this integration. Updating source, environment or
models never authorizes an expense, policy confirmation, approval or transfer.

## Vercel and Supabase

Vercel's existing Production/Preview server environment keeps:

```dotenv
API_BASE_URL=https://prooffi-preview-api.onrender.com
```

No `GEMINI_*`, `LLM_API_KEY`, Google service-account secret, database URL or signer
secret is needed there. Never prefix secrets with `NEXT_PUBLIC_`.
Supabase needs **no additional variables or migrations** for Gemini. Calls do
not run in Supabase Edge Functions and generated queries do not execute SQL.

## Existing OAuth option

For an operator who already maintains an authenticated Google Cloud CLI, the
previous explicit `vertex_oauth` method still uses `GOOGLE_CLOUD_PROJECT`,
`GOOGLE_CLOUD_LOCATION`, `VERTEX_ACCOUNT`, optional `VERTEX_GCLOUD_CONFIG` and the
same model variables. It gets a bounded access token from that configured
account. It does not silently switch from a rejected key to OAuth. Render's
current image/Express deployment does not require gcloud, a new service account,
service-account JSON, or a project ID in the Express URL. A future ADC/workload
identity authentication change needs its own security review; do not paste a
service-account JSON document into an API-key variable.

## Private helpers and operating behavior

```python
from app.planner.provider import PlannerSettings, vertex_proposal
from app.planner.tasks import summarize, translate, generate_queries

settings = PlannerSettings()  # backend environment / ignored local .env
# Existing planner uses vertex_proposal(goal, trusted_minimal_context, settings).
summary = summarize("Explicitly supplied non-sensitive source text", settings)
translation = translate("Hello", "Bengali", settings)
queries = generate_queries("Official tuition budgeting guidance", settings)
```

Helpers send only explicitly supplied text/language; they never read database
rows, credentials or browser context. Summaries/translations return validated
`TextResult.text`; query generation returns one to five bounded natural-language
search suggestions in `QueryResult.queries`. No search, SQL, tool or action is
executed. These outputs remain untrusted and must not grant financial authority.
Each result has private `_provider_model` metadata; it is not part of public
models or signed payloads. The planner candidate ID binds the actual model used.

All tasks retain one 30-second subprocess deadline, 64 KiB private transport caps,
fixed Google endpoint, strict response validation and no credential-bearing
command-line arguments or logs. Thinking is controlled by model family:
Gemini 2.5 Flash budget 0, 2.5 Pro budget 128, Gemini 3/4 LOW thinking level,
with a 4,096-token output cap. See Google's
[thinking controls](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/thinking).
Unknown model families retain provider defaults and still require STOP/valid
JSON within the deadline; availability must be tested before operator selection.

Only an explicitly configured, **different** reasoning fallback is tried on
model-unavailable, quota, transient service, timeout or truncated-output errors,
using the remaining total budget. Identical primary/fallback names cause one
attempt. A timeout that exhausts the budget cannot start a fallback. No fallback
occurs on configuration/authentication, safety blocking or invalid schema output;
no deterministic planner or simulated success is substituted. Fixed public error
messages distinguish these failures without revealing raw provider bodies.

## Verification limits

Focused isolated tests verify key handling, model selection/provenance, task
validation, fallback/deadline and refusal behavior. The separate genuine calls
prove real provider responses at the recorded time; they do not prove translated
text quality, forecast accuracy, broad model reliability or new financial
acceptance. Hosted completion requires the reviewed PR, passing current CI,
actual rollout, authenticated Ask/reads, preservation of state/audit and the
selected runtime models. No hosted rollout or credential rotation is implied by
local tests. The disabled demo-route and manual allowlist UI issues remain #164.
