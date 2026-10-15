# ProofFi — Master Implementation Prompt for OpenAI Codex

**Project:** ProofFi — The Trust Layer for Autonomous Finance  
**Competition:** FinTechathon 2026, International Track, Topic F (Agent Wallet)  
**Primary reference:** `ProofFi_Complete_Project_Specification_FinTechathon_2026 (1).docx` (attached specification).  
**Mission:** Deliver a fully functioning, reproducible, security-conscious, visually polished single-user/testnet MVP **as one integrated system**. Run the project as a three-contributor GitHub Issues + pull-request workflow. **No calendar-dated task plan; prioritize functional exit gates. Do not expand product scope.**

---

## ROLE, EXECUTION CONTRACT, AND OPERATING INSTRUCTIONS

You are Codex acting as a principal engineer, financial-systems security architect, quantitative prototype engineer, test engineer, and full-stack implementation partner. Your task is to **write, run, test, debug, document, and deliver** a working ProofFi monorepo, not merely propose architecture. The attached ProofFi specification is the primary source of product scope and acceptance criteria. Read it completely before changing code. Preserve its thesis, terminology, three scenarios, security model, and 12 acceptance tests. When this prompt adds implementation details not explicitly settled by the specification, mark them as **engineering choices**, record them in `docs/DECISIONS.md`, and never present them as source requirements.

**Core thesis:** ProofFi separates financial intelligence from financial authority. An untrusted LLM planner may propose structured actions, but cannot approve policies, declare its own proposal compliant, issue a trusted certificate, access a private key, or submit a transaction. Only a trusted, independent backend verifier can issue a signed Action Certificate after policy checks and transparent future-risk simulations. The executor **independently** validates that certificate and all approvals before a signing service performs an exact approved EVM testnet action.

Before implementing, inspect the existing repository and report what exists, what you will preserve, the next milestone, blocking prerequisites, and a short task checklist. **The team lead owns the initial repository, database, architecture, shared contracts, and workflow setup; do not silently replace those choices or create duplicate foundations.** If the repository is blank, help the lead design and initialize it in the foundation stage. Create actionable GitHub Issues for remaining implementation as soon as the repository is available; mark issues blocked on unmerged foundation contracts, then start compatible feature work as those individual dependencies clear. Work in small vertical slices and issue-linked pull requests. Do not ask me to approve every small code choice; select conservative, documented defaults. Ask only for information you truly cannot derive or safely substitute (e.g., an actual funded testnet private key, deployment credentials, or a decision that fundamentally changes the user-visible financial meaning of an action). Never fabricate a successful live chain operation or create fake evidence. Do not claim completion unless tests or actual evidence prove it.

**After every issue or integration milestone:** (1) summarize files changed, (2) show commands run and test results, (3) identify failures/blockers, (4) demonstrate behavior through API/UI/test outputs, (5) link the GitHub Issue and PR when available, (6) update `docs/PROGRESS.md` and `docs/DECISIONS.md`, and (7) continue with the next unblocked issue unless an essential secret, review, or user decision blocks you. Prioritize running code and passing acceptance tests over visual flourishes or speculative features.

## TEAM MODEL, INITIAL OWNERSHIP, AND GITHUB OPERATING RULES

**Team size:** three human contributors, each of whom may use Codex on their own issue branch. GitHub Issues is the authoritative backlog; pull requests (PRs) are the unit of integration. The board is not a substitute for a working app. Every issue must result in source code, tests, documentation, or verifiable integration evidence.

**Roles** (replace role labels with the three actual GitHub usernames when supplied; do not invent handles):

- **LEAD / CONTRIBUTOR A (me):** owns **the initial setup** — repository scaffolding, architectural decisions, database and migrations, shared domain models, versioning rules, typed API contract, fixtures, environment templates, CI baseline, and contribution rules. Then owns the **trusted authorization/execution path**, PR integration, final security review, and end-to-end smoke tests. Codex may help implement this foundation *when asked*, but must not override my architecture without discussing a concrete incompatibility.
- **CONTRIBUTOR B — financial/risk backend:** owns Constitution rule evaluation, named stress tests, Monte Carlo Time Machine, safe-action optimizer, finance/planner-backend logic when assigned, and associated unit tests.
- **CONTRIBUTOR C — user experience/integration:** owns Next.js product screens, typed API integration, scenario controls, front-end automated tests, and evidence-oriented UI behavior. They consume stable contracts and may mock **network responses only in isolated component tests**; never treat frontend stubs as true backend verification or real on-chain execution.

**Sequence:** As soon as GitHub repository access exists, Codex drafts/publishes the implementation issues and marks dependency-blocked issues accurately. The lead establishes a *minimum stable foundation* and merges shared schemas/contracts **before** dependent feature branches begin; independent UI shell, documentation or fixture-based unit work can begin early when they do not require unfrozen contracts. As soon as specific contracts land, assign and implement the newly ready issues in parallel on non-overlapping ownership areas. Do not have contributors independently create competing schemas, ORM tables, routing conventions, certificate encodings, or blockchain transaction payload formats.

**Minimum foundation handoff (lead's responsibility):**

1. Repo layout, stack/package managers and pinned versions; single documented `dev` startup flow; `.env.example`/secret hygiene.
2. ERD, migration/bootstrap, seeded single-user FinancialState/Constitution demo fixtures; consistent monetary/asset units; state versioning/snapshot semantics.
3. Shared **canonical** Pydantic models and OpenAPI contract: `CandidateAction`, trusted simulation input/output, policy verdict, certificate, approval, execution, audit event; shared enum/error codes; frontend generated TS types/client if feasible.
4. Decide one testnet and chain ID, test asset and approved destination, transaction type, expected fee treatment, signer boundary, trusted vs synthetic balances. Record key external blockers (RPC, test tokens, funded wallet) without placing secrets in git.
5. Strict modular folder boundaries; integration and testing conventions; CI commands; GitHub labels/issues/PR template and branch protection guidance. Only LEAD reviews changes to authorization, key management, execution, schemas, and contract.
6. `GET /health`, API startup, frontend startup, DB migration/seed, and at least one simple end-to-end browser-to-API fetch working on a clean checkout. The lead records these checks in the foundation PR.

**Contract-first integration:** Each issue uses frozen request/response examples and ownership of touched paths. Changing a shared schema, migration, `ActionCertificate` encoding, route, or signing interface requires a separate `contract-change` PR approved by LEAD, synchronized updates to TS types, and tests. When a real backend endpoint is not yet implemented, return explicit `NOT_IMPLEMENTED`/`UNAVAILABLE` and test against a deliberately named fixture only; do not make the dashboard look like a completed transaction.

**GitHub rules:**

- Backlog issues must be concise enough to finish/review in one PR when possible; one issue = one outcome + acceptance evidence. Use issue IDs `PF-###` in issue titles and links in PR descriptions. Never assign two people to edit the same shared core files independently.
- Branch convention: `feature/pf-###-short-name`, `fix/pf-###-short-name`; never push directly to protected `main`. Keep commits coherent and rebase/merge main frequently. Resolve merge conflicts instead of overwriting another contributor's work.
- All feature PRs require `pytest`, frontend `lint`, `typecheck`, and `build` as applicable, integration smoke tests for touched endpoints, and review by at least one other team member. Authorization/executor/schema changes additionally require LEAD review. Do not merge failing CI, even under time pressure.
- Use labels `priority:P0|P1|P2`, `area:foundation|policy|simulation|planner|security|chain|api|web|test|docs`, `type:feature|bug|integration|security`, and `status:blocked|ready`. Create labels if permissions allow, otherwise list desired labels in `docs/ISSUE_BACKLOG.md`.
- Every issue includes **Summary, Owner Role, Dependencies, Paths Owned, API Contract, Implementation Tasks, Acceptance Criteria, Test Commands, Evidence/Notes, Definition of Done**. Label issue `blocked` until dependencies are merged. Put PR-link/commit references in the issue; close only when functionality is integrated and verified. Document external blockers rather than skipping them.
- Create `docs/ISSUE_BACKLOG.md` as a durable, versioned issue manifest; **as soon as the repository and authenticated access are available**, use `gh` or an authenticated GitHub integration to create actual repo issues and record real URL/number mapping, even if some work is still dependency-blocked. Do not claim issues were created unless the API/CLI confirms it. If auth or repo URL is missing, generate ready-to-run issue body files under `.github/issue-drafts/` and exact CLI instructions, mark `PENDING_PUBLICATION`, and ask only for the missing access.

**Parallel work is not three isolated mini-projects:** integrate at least one small vertical slice every iteration. Keep the backend bootable, frontend buildable, and latest `main` demonstrably runnable. A large number of completed issues is not a substitute for the acceptance gates or real chain evidence.

## 0. NON-NEGOTIABLE SCOPE

Build exactly one demo user, one EVM testnet wallet, one primary goal, and these three scenarios:

1. **Tuition-safe investment:** `$12,000` synthetic/testnet-denominated total assets, `$7,000` tuition due in four months, `$800/month` living costs, goal: **“Invest as much as possible without risking my tuition.”** Propose candidates, evaluate named stress tests and seeded Monte Carlo, find the largest compliant amount, issue certificate, obtain approval when required, submit a real on-chain testnet transaction, and show tx hash/explorer evidence.
2. **Prompt-injection attack:** Deliberately show an untrusted planner proposing an unauthorized `$4,000` transfer to an unknown address. The trusted verifier must reject it, and a direct executor call must also refuse it. There must be no tx hash and no signed transaction.
3. **Emergency replanning:** Apply a newly realized `$2,000` expense as a versioned state change, invalidate the previous certificate, recompute, and show the new safe amount decreasing (possibly to zero if policies demand it).

MVP essentials: versioned Financial Constitution with 6–8 rule families, transparent named stresses + Monte Carlo, safe-action search, independent verifier, tamper-evident signed Action Certificate, explicit approval when needed, certificate-gated backend executor, real EVM testnet execution evidence, persisted audit chain, clear UI, blocked-attack proof, automated tests, and competition documentation.

**Explicit non-goals:** real money, banking/brokerage integrations, production custody, mobile app, custom model training, sophisticated DeFi, large asset universe, zero knowledge, cross-border transfers, full compliance/licensing workflow, SME/multi-agent marketplace, or any more demo scenarios. Do not spend MVP time on these.

## 1. TECHNICAL STACK AND REPOSITORY

Use a boring, robust stack consistent with the specification:

- **Frontend:** Next.js App Router, TypeScript, Tailwind CSS, accessible component primitives/shadcn-ui if available, Recharts or similar for client visualizations; dark/navy + teal financial-control-center styling.
- **Backend:** Python 3.11+ with FastAPI, Pydantic v2, SQLAlchemy 2.x, SQLite for local demo (repository designed so PostgreSQL can be substituted), NumPy, `cryptography` Ed25519, `web3.py` for EVM testnet, `pytest` and `httpx`.
- **LLM:** provider-neutral server-side adapter accepting schema-validated JSON candidate proposals. Use an actual configured model when credentials exist, but include an honest **deterministic demo planner** that is explicitly labeled as a fallback/fixture, not disguised as a live LLM. No secret in the browser or prompts.
- **Contracts/chain:** one known EVM testnet (default Base Sepolia or Sepolia, decide after inspecting infrastructure) with a funded dedicated test wallet and an allowlisted test token / known demo strategy address. Keep on-chain action minimal and real. Prefer a documented, honest ERC-20 test-token allocation/transfer; only implement a swap if reliable, tested, funded infrastructure already exists. **Never label an ERC-20 transfer as a genuine asset purchase or yield-producing investment.** The UI must accurately describe an on-chain **test allocation to an approved demo destination** unless a real swap/investment contract is actually executed.
- **Tooling:** pnpm/npm as existing repo suggests; Python uv/venv, Ruff, mypy optionally, pytest, Vitest, Playwright smoke tests if time allows, lint/typecheck, GitHub Actions optional only after core gates pass.

Suggested structure, adaptable to existing files:

```text
prooffi/
  apps/web/                      # Next.js app, pages, components, API client
  services/api/app/
    api/                         # routers and validated request/response schemas
    core/                        # settings, canonical encoding, security, auth
    models/                      # SQLAlchemy/Pydantic domain schemas
    planner/                     # LLM adapter + deterministic fallback
    policy/                      # rules, compiler, versions
    simulation/                  # stress cases, NumPy Monte Carlo, metrics
    optimizer/                   # safe amount search
    verifier/                    # checks + Ed25519 Action Certificate
    approvals/                   # human approval handling
    execution/                   # independent gate + signing/chain adapter
    audit/                       # append-only domain events
    db/                          # sessions, fixtures, migrations
  services/api/tests/            # unit/security/integration/acceptance
  contracts/                     # only if needed for transparent test asset setup
  scripts/                       # seed, reset demo, chain health, evidence export
  docs/                          # DECISIONS, PROGRESS, threat model, method, submission
  .env.example
  README.md
```

Avoid broad architectural abstractions if they delay the working vertical slice. Modular boundaries matter more than microservices: a single FastAPI process may host logically isolated modules, but **no planner code path may invoke signing functions**.

## 2. DOMAIN MODEL, MONEY SEMANTICS, STATE VERSIONING

Define strongly typed data entities: `User`, `FinancialState`, `AssetBalance`, `Goal`, `Obligation`, `RecurringExpense`, `ExpectedIncome`, `ConstitutionDraft`, `ConstitutionVersion`, `CandidateAction`, `SimulationRun`, `VerificationResult`, `ActionCertificate`, `Approval`, `Execution`, `AuditEvent`, and `DemoScenario` as needed. Track stable primary IDs, UTC timestamps, explicit state version numbers, and foreign-key associations.

**Money must be deterministic:** use `Decimal` or integer minor units for USD-denominated amounts, and token integer base units for chain transactions; never authorize with floating-point price arithmetic. Normalize recipient addresses and token decimals, distinguish liquid cash from non-liquid investments, and specify which balances represent **synthetic planning state** versus actual **on-chain test tokens**. Maintain a one-to-one intended action binding between planning ledger and on-chain transaction; update the ledger only after known execution outcome and handle pending/reorg/failure states honestly. The seeded `$12,000` is a demo financial state, **not a claim** that on-chain wallet holds $12,000 of real purchasing power.

Be especially careful with internal financial consistency: the example policy may require `$7,000` tuition protection + `$2,000` floor; `$800/month` costs extend four months, so **a positive investment is not automatically feasible** without explicitly declared income or other assumptions. The specification leaves expected-income amounts and some simulation probabilities unquantified. Do not silently invent them. Create an editable, prominently displayed set of **demo assumptions** and show any configured `ExpectedIncome` as an *assumption*. Check that the actual seeded setup produces meaningful Scenario A and a smaller feasible amount in Scenario C; if not, explain the constraint faithfully rather than falsifying/verifier-bypassing results. The example `BUY_TEST_ASSET amount_usd: 2180` and 97.3% simulation metric in the specification are **illustrative only**, not hard-coded outputs. In particular, enforce the 25% concentration limit consistently.

Financial state changes must create new version/snapshot hashes; past certificates remain audit-viewable but stale and unexecutable. Record policy version, simulation model/config version, state snapshot hash, chain identity, and candidate action digest.

## 3. FINANCIAL CONSTITUTION: EIGHT POLICY FAMILIES

Implement human-readable and machine-readable policies, with a policy-draft preview, structured diff, **explicit confirm-and-activate**, immutable confirmed version, and audit record. Natural-language assistance may draft a proposed policy but **cannot activate or edit a confirmed policy without explicit user approval**. Server must reject inconsistent/missing/invalid rules. Include:

1. Tuition/protected-funds reserve (e.g., >= `$7,000` until due date).
2. Emergency liquidity floor (e.g., >= `$2,000`, counted without double-counting tuition).
3. Autonomy threshold (e.g., any transaction > `$150` requires signed-in-user approval rather than forbidden action).
4. Counterparty gate (new recipient requires explicit approval; blocked recipients/invalid addresses remain forbidden).
5. Asset/token/chain allowlist (reject unknown instruments or wrong network).
6. High-risk concentration limit (e.g., <=25% of clearly defined *disposable assets*; specify denominator and classification).
7. Monte Carlo protected-goal satisfaction (>=95% under declared assumptions).
8. Monte Carlo reserve-breach risk (<=5% under declared assumptions), plus **no borrowed funds for investment** as a hard funding-source restriction if the data model supports it without scope explosion.

Differentiate `DENY` from `REQUIRES_APPROVAL`: approval may permit an amount above the autonomy threshold, **but may never override tuition protection, invalid destination, allowlist, concentration, or risk thresholds**. Use explicit rule outcomes (`PASS`, `REQUIRES_APPROVAL`, `FAIL`) and machine-readable reason codes. Enforce on authoritative state and canonical transaction objects—not planner statements. Include boundary tests for each rule.

## 4. UNTRUSTED INTENT AND PLANNER

Add `POST /intent/parse` and `POST /plans/generate`. Convert the goal to a typed objective (`maximize_investment_subject_to_policies`), referenced tuition obligation, optional ambiguities, and proposed candidate actions. If material information is missing (recipient, approved asset, action classification), return a clarification request, not fabricated parameter values. Produce a small number of candidate amounts (e.g., near-zero, medium, aggressive) and support a restricted attacker-proposal fixture for red-team mode.

All outputs are **data**, never authority: no raw model output is executed, no model-provided verdict is trusted, no tool executor is exposed to the planner, and no private/public signing secrets enter model context. Validate schemas, numbers, supported enumerations, recipient format, allowlists, and text length; malformed proposals fail safely. Keep model prompts versioned and brief. Plan for unavailable model/provider with a disclosed deterministic fallback so the demo still exercises the real verifier and executor.

## 5. TIME MACHINE: FINANCIAL STRESSES AND MONTE CARLO

Implement a transparent, deterministic NumPy-based engine, separated from LLM execution. Its inputs include canonical state, action, obligations, income and fees, horizon (default four months / 120 days), paths (default 1,000), seed (example `18421`), fixed model-version identifiers, and explicit volatility/income-delay/emergency assumptions.

Named scenarios **must** include:

- Market shock: high-risk asset value drops 30% immediately.
- Income delay: expected income shifted 30 days.
- Emergency expense: unexpected `$2,000` liquidity outflow.
- Fee shock: transaction/operational fee multiplied by 3.

Simulate ledger state through obligation due dates; do not protect tuition only at the horizon's end if it must remain segregated throughout. Document stress evaluation semantics (individual scenarios, not all simultaneous unless explicitly chosen), income event scheduling, whether an already realized emergency is also modeled as a *second* future shock, volatility distributions, correlations/independence limits, transaction/chain fees, and how illiquid/risky positions are valued. **Do not make precise risk claims with unvalidated assumptions.** Every result must show seed, path count, model assumptions and their editable source.

Return:

```json
{
  "goal_satisfaction_probability": 0.0,
  "reserve_breach_probability": 0.0,
  "p05_terminal_liquidity_minor": 0,
  "expected_terminal_value_minor": 0,
  "stress_results": [],
  "assumptions": {},
  "seed": 18421,
  "path_count": 1000,
  "horizon_days": 120,
  "model_version": "..."
}
```

Metrics: goal satisfaction fraction when tuition is fully funded on the due date; reserve breach fraction for paths falling below liquidity floor at any point; 5th-percentile ending liquid cash; expected total ending value. Clearly distinguish deterministic failures from Monte Carlo threshold failures. Use fixed common random samples across candidate amounts so safe-action search is stable and comparable. Optimize for deterministic reproducibility and clear documentation before adding sophisticated distributions or charts.

## 6. SAFE-ACTION SEARCH AND VERIFICATION

Implement `POST /simulate` and `POST /verify` plus a high-level orchestration endpoint such as `POST /workflows/goal`. Compute a conservative upper bound from **spendable** balance, reserved obligations, token balances, concentration limit, recipient restrictions, and fees. Search discrete dollar cents (or specified token precision) for the largest policy-compliant proposed allocation. Binary search is allowed **only when feasibility is demonstrably monotonic** over the bounded candidate domain; otherwise implement bounded scan/refinement or fail with an explicit `NON_MONOTONIC_FEASIBILITY` result. Verify final amount and the immediate higher precision step; report tolerance, number of verifier calls, and which check limits the maximum. Distinguish `NO_SAFE_ACTION` from an execution error. Never relax a hard constraint just to ensure a visually positive demo.

The **independent verifier** reads the state/policy/simulation config from authoritative trusted storage, recomputes all relevant checks, and refuses to accept LLM-provided PASS/FAIL, risk metrics, scenario parameters, or certificate content. It issues a certificate only when all non-approvable rules pass and simulated thresholds meet configured values; it explicitly marks required approval. Any simulation/DB/RPC/verifier dependency failure must fail **closed** for new execution.

## 7. ACTION CERTIFICATE, APPROVAL, AND EXECUTOR (TOP SECURITY PRIORITY)

Create a canonical serialized payload (document selected canonical-JSON encoding, normalized decimals as strings/minor-unit integers) with:

- certificate ID and schema version; action ID/type and exact authorized chain transaction fields (`chain_id`, `from`, `to`, `token_address`, integer `amount_base_units`, transaction `value`, call `data` / selector as applicable, recipient, designated asset and stated intention);
- planner reason labeled untrusted;
- financial `state_snapshot_hash` + `state_version`;
- `constitution_version` + policy digest;
- every deterministic rule outcome with measured values;
- `simulation_config`, named tests, path count, seed, assumption/model digest, metrics;
- approval required/reason;
- `issued_at`, short `expires_at` (example 5 minutes), cryptographically random nonce;
- `certificate_hash` (SHA-256 of canonical unsigned payload), Ed25519 verifier signature over that hash/payload, signature/key ID.

Store execution hash/status **outside** the signed immutable payload in a separate linked execution record; the UI may join it to the certificate. Do not mutate the signed payload after signing. Expose `GET /certificates/{id}` and `POST /certificates/{id}/verify` for independently recomputing signature/hash and showing freshness/status/action equality. Implement explicit approval endpoint `POST /approvals`, binding authenticated session, certificate ID, signed action digest, state/policy version, timestamp, and one-time status; approval is not a generic yes/no flag and cannot be borrowed across certificates.

**Mandatory executor invariant:** `POST /execute` never trusts the frontend, candidate creator, or a returned `verified: true`. It loads certificate from trusted storage and independently checks authentic signature, digest, expiry, current active Constitution/version, financial state freshness, exact transaction field equality, still-allowed token/recipient/network, required approval, available gas/balance, nonce replay status, and prior-use/idempotency status. A token transfer of 850 may not become 851; a changed recipient, contract, selector, token, chain, fee constraints, or action intent must fail. `403 INVALID_CERTIFICATE` or a precise error code on a bypass, no signing. Use an **atomic state transition** (`ISSUED -> CLAIMED/PENDING -> CONFIRMED/FAILED`) to ensure only one execution claim; concurrent requests cannot double spend. Handle RPC timeouts and ambiguous broadcast via pending reconciliation, not careless resubmission. All signing keys and RPC auth secrets live in backend environment only; never log or return them.

Use an isolated signing adapter with a testnet-only allowlist; production networks must be rejected. Do not allow arbitrary call data or arbitrary smart-contract interaction. A direct call to executor without a valid certificate/approval fails even if the UI is bypassed. Add security-relevant audit events for every rejection and state transition. If the testnet wallet is unfunded or chain infrastructure is unavailable, show `CHAIN_NOT_CONFIGURED` / `PENDING` and keep the demo in clearly labeled dry-run mode; **do not print invented tx hashes**.

## 8. API AND PERSISTENCE

Implement and document the specification endpoints:

```text
POST /intent/parse
POST /plans/generate
POST /simulate
POST /verify
POST /approvals
POST /execute
GET  /certificates/{id}
POST /certificates/{id}/verify
GET  /audit
```

You may add `GET /financial-state`, `GET/POST /constitutions/drafts`, `POST /constitutions/confirm`, `GET /constitutions/history`, `POST /workflows/goal`, `POST /demo/emergency`, `POST /demo/reset`, `GET /chain/status`, and `GET /health` to support the UI. Validate API inputs with Pydantic. Ensure failed calls have structured status + reasons. Add demo authentication: if public deployment, enforce a single demo-user authenticated session for state-changing actions, HTTPS origin restrictions, restricted CORS, CSRF considerations for cookie-auth endpoints, and rate limiting where lightweight. Executor/policy confirmation/approval must not be remotely open just because this is a hackathon prototype. Confine reset/attack fixtures to clearly marked demo mode.

Persist audit entries with an append-only pattern, event IDs, timestamps, event type, actor/source, linked artifact digests, details, and optional previous-event hash for tamper-evident local sequencing. Never claim an ordinary SQLite audit log is immutable against a compromised administrator. Include export of machine-readable evidence.

## 9. FRONTEND: NINE CLEAR SCREENS/SECTIONS

Create a cohesive, responsive financial dashboard—not a crypto trading terminal. Main journey is **Goal -> Candidate Strategies -> Time Machine -> Verification -> Certificate -> Approval -> Testnet Execution -> Audit**. Implement:

1. **Financial Home:** total assets, liquid funds, tuition reserve, liquidity floor, obligations, disposable amount, goal safety, testnet/synthetic badges.
2. **Constitution Builder:** editable draft, human-readable diff, explicit Confirm & Activate, active immutable version/history, rule explanations.
3. **Agent Workspace:** natural-language goal box, progression states, candidate comparison, chosen safe maximum, violated rules/alternative.
4. **Time Machine:** four named stress cards, sampled future-path visualization, goal-satisfaction/reserve-risk metrics, p05, assumptions drawer, clear scenario-language warnings.
5. **Action Certificate:** human-readable proof artifact, canonical action, checks, seed/path count, hashes/signature, policy/state versions.
6. **Approval Gate:** exact token amount, recipient, chain, consequences, reason for required approval, approve/deny actions.
7. **Audit Explorer:** timeline of intent, candidates, simulation, policy outcomes, certificate, approval, tx hash/block explorer.
8. **Red-Team Mode:** show compromised planner output (not sanitized away), failed backend policy rules, refused executor, absent tx hash.
9. **Certificate Verifier:** select/paste ID; verify signature/integrity, freshness, current-state compatibility, approval status, usage status; explain `VALID` vs `SIGNED_BUT_STALE`, `TAMPERED`, `EXPIRED`, `ALREADY_USED`, etc.

Use good loading/error/empty states, keyboard accessibility, labeled synthetic values, sensible typography, mobile-responsive layout for viewing (but do not build a mobile app), and truthful current status indicators. Prefer deterministic UI transitions over fake simulated “executing” banners. Keep screenshots ready for the submission evidence folder.

## 10. THREE DEMONSTRABLE END-TO-END SCENARIOS

**A. Tuition safety:** seed financial state; confirm policy; parse goal; show 3+ candidates (or well-explained optimizer iterations); render real deterministic stresses and seeded Monte Carlo; find computed maximum under *all* active constraints; issue signed certificate; explicit approval if >150/new recipient; submit a real ERC-20 allocation/transfer to approved test destination; wait for receipt; display real tx hash and explorer link; audit full chain. If no valid safe amount, do not create a false positive—surface conflict and clearly document exact required assumption changes.

**B. Compromised planner:** fixture emits unauthorized `TRANSFER` `$4,000` to an unapproved/unknown recipient; show attempted violation. Independently verify failure on counterparty/hard limits/protected funds as applicable; direct `POST /execute` with absent/fake certificate returns hard failure, and assert signer wasn't called and zero new transaction hash recorded. Do not rely only on the model refusing a malicious prompt. Treat this as a controlled test attack, never as an authorized external transfer.

**C. Emergency:** persist the unexpected `$2,000` expense; increment state version; show earlier certificate unusable even if it had a valid signature; recompute safe amount with same core policy; show a reduced maximum or `NO_SAFE_ACTION` with trace. If already-executed action exists, clearly separate historical execution from trying to reuse its spent certificate; preferably start each demo scenario from a reproducible fixture or staged historical snapshot.

## 11. TEST PLAN — ALL 12 ACCEPTANCE TESTS ARE EXIT GATES

Map each test ID to a runnable automated test; include clean output in evidence:

- `AT-01` End-to-end goal -> safe amount -> certificate -> required approval -> **real testnet tx**. For CI without funded wallet, run an isolated simulated chain-adapter integration test and separately document a **manual live-chain verification**, never label a mock as live.
- `AT-02` Oversized action rejected with no certificate.
- `AT-03` Maximum safe amount found to documented precision/tolerance, with final boundary verification.
- `AT-04` Prompt-injected malicious action blocked with no signing or tx.
- `AT-05` Direct execute without valid certificate hard-fails.
- `AT-06` Altered amount/recipient/token/chain/call data invalidates authorization.
- `AT-07` Replay and two concurrent execution claims rejected.
- `AT-08` Material state change invalidates prior certificate.
- `AT-09` Emergency expense lowers maximum or returns no safe amount with valid explanation.
- `AT-10` Same state/config/seed/action yields byte-stable or numerically deterministic metrics; different seed/config changes persisted simulation identity.
- `AT-11` Policy edits never activate without explicit confirmation and version history.
- `AT-12` Private key excluded from browser bundles, planner prompts, logging, repo, docs, and response schemas.

Additional checks: all rule boundaries/malformed inputs/missing state, approval wrong/stale/missing, expiry, forged signature, modified signed payload, nonce reuse, wrong chain, unauthorized contract selector, unavailable simulator, unavailable verifier, RPC failure, untrusted prompt injection, API validation, secret scanning, and optimizer feasibility handling. Tests should be deterministic by default; run CLI `pytest`, frontend lint/typecheck/build, relevant Vitest/Playwright tests; capture actual command outputs in `docs/TEST_RESULTS.md`. Never weaken checks to get green tests.

## 12. ISSUE-DRIVEN PARALLEL IMPLEMENTATION PLAN (NO CALENDAR MILESTONES)

Use **dependency gates**, not calendar dates. Publish the issue backlog early. LEAD owns the foundation; as each shared contract becomes stable, contributors B and C begin the corresponding unblocked implementation work while A continues the security core. Deliver a true end-to-end vertical slice as soon as its dependencies land, then extend the same working flow with simulation, planner, security demonstrations, and visual polish. Prioritize every P0 issue over optional UI decoration.

### 12.1 Foundation gate — lead-owned before parallel development

These are work packages for the LEAD to perform with Codex assistance if requested. Create/reconcile GitHub issues for traceability right away, but **do not delegate foundation architecture or database ownership** to contributors B/C. If already implemented, validate and mark COMPLETE rather than recreating:

| ID | Priority | Owner | Issue title | Completion evidence |
|---|---|---|---|---|
| PF-001 | P0 | A | Repo bootstrap and reliable local startup | Fresh checkout boots API and web with one documented command per service. |
| PF-002 | P0 | A | Trust boundaries, shared domain models and API contracts | Pydantic/OpenAPI schemas + typed TS client/contracts reviewed; action fields/units/errors frozen. |
| PF-003 | P0 | A | Database schema, migrations, state versioning and seed fixture | Migrate + reset/seed reproducibly, no unversioned policy activation, no float money. |
| PF-004 | P0 | A | Chain/transaction design, environment and secret-handling boundary | Fixed chain/asset/destination model, isolated signer interface, zero secrets committed. |
| PF-005 | P0 | A | GitHub workflow, CI checks, issue templates, PR template and contributor docs | Protected-main recommendation, lint/type/build/test CI, CODEOWNERS/review guidance, backlog published or pending with a truthful status. |

**Foundation exit gate:** fresh checkout `migrate -> seed -> start API + web -> browser fetches real backend state -> tests pass`. Merged shared schemas and stable API sample responses are published to all contributors. No forked architecture proposals are merged after this without contract review.

### 12.2 Backlog issues for parallel contributors

**Codex: Convert each row below to a real GitHub Issue (PF-006 through PF-032).** Expand the row into a self-contained issue body that references exact Pydantic entities, endpoints, sample JSON, owned files, test paths and measurable done criteria. The listed dependencies are minimum blockers; adjust based on actual codebase only when necessary and explain changes. Prevent circular dependencies and avoid making a single issue too large for review. Mark all core issues P0; P1 items still required for a polished end-to-end demo, not for loosening security.

| ID | Priority | Owner | Title | Blocked by | Key deliverable / acceptance |
|---|---|---|---|---|---|
| PF-006 | P0 | B | Constitution draft, explicit confirm and immutable versions | PF-002, PF-003 | Draft/diff/activate/history; stateful tests prove draft cannot silently activate. |
| PF-007 | P0 | B | Deterministic policy engine and approval-vs-deny verdicts | PF-006 | Eight rule families, precise reason codes, state-based checks; boundary/failure tests. |
| PF-008 | P0 | B | Named stress scenarios | PF-002, PF-003 | -30% market, +30d income delay, $2,000 emergency, x3 fee; visible parameter output. |
| PF-009 | P0 | B | Seeded Monte Carlo and risk metrics | PF-008 | Seed/path/model config logged; identical inputs reproduce results; all four metrics. |
| PF-010 | P0 | B | Largest-safe-action optimizer | PF-007, PF-009 | Feasible upper bounds, stable seeded search, validated max and next-cent boundary. |
| PF-011 | P0 | B | Risk backend security and acceptance test suite | PF-007, PF-010 | Tests for policy bypass, threshold breaches, fail-closed risk unavailability. |
| PF-012 | P0 | A | Canonical certificate payload, hashing and signature primitives | PF-002, PF-003 | Stable exact-action encoding and Ed25519 signature validation; tamper/expiry tests; no policy approval claims yet. |
| PF-013 | P0 | A | Approval binding and authorization lifecycle | PF-012 | Human approval exact certificate/action binding; stale/wrong/missing denied. |
| PF-014 | P0 | A | Independent executor, replay and concurrency guards | PF-013, PF-029 | Direct bypass/altered params/replay/concurrency fail without signer call. |
| PF-015 | P0 | A | Connect authorized executor to real EVM testnet and store receipt | PF-014, PF-030 | Valid authorized action submits real tx and returns real receipt/hash; honest unavailable states. |
| PF-016 | P0 | A | Workflow orchestrator, audit trail and exact execution link | PF-010, PF-015, PF-017 | Orchestrates goal -> certificate -> approval -> execution; persists verifiable audit trace. |
| PF-017 | P1 | B | Structured goal parsing and untrusted planner adapter | PF-002 | JSON-validated candidates, ambiguity handling, explicit deterministic fixture, no signing authority. |
| PF-018 | P0 | C | Next.js UI shell, state dashboard and generated API client | PF-002, PF-003 | Real API state renders, error/loading states, no fake financial/chain status. |
| PF-019 | P1 | C | Constitution Builder UI and diff/confirmation | PF-006, PF-018 | Draft edit -> diff -> explicit confirm; active version displayed. |
| PF-020 | P0 | C | Agent Workspace and candidate/optimizer results | PF-010, PF-017, PF-018 | Goal -> candidates -> computed safe amount or honest NO_SAFE_ACTION from backend. |
| PF-021 | P1 | C | Time Machine chart and transparent assumptions UI | PF-009, PF-018 | Named stresses, paths, seed, horizon, risk metrics; no predictive overclaim. |
| PF-022 | P0 | C | Certificate details, approval panel and execution results UI | PF-013, PF-015, PF-018 | Exact transfer fields, explicit approve, valid receipt/explorer link or real error. |
| PF-023 | P0 | C | Red-team demo mode and blocked-executor evidence | PF-018, PF-031 | Malicious proposal shown; backend denies, no signing/tx, rejection audit shown. |
| PF-024 | P0 | C | Emergency expense and replanning UI | PF-018, PF-032 | $2,000 state change invalidates old cert and recomputes lower/no safe allocation. |
| PF-025 | P1 | C | Audit Explorer and public-safe certificate verifier UI | PF-016, PF-018 | Actual audit lifecycle, signed certificate status, stale/used/tampered distinctions. |
| PF-026 | P0 | A + B + C | End-to-end acceptance tests AT-01 to AT-12 and fresh-checkout run | PF-016, PF-020, PF-022, PF-023, PF-024 | CI and local E2E pass; separate documented real chain verification, security matrix green. |
| PF-027 | P1 | B | Simulation methodology, API documentation and threat notes | PF-009, PF-014 | Honest model assumptions, deterministic vs stochastic claim boundaries, residual risks. |
| PF-028 | P1 | C + A | Demo evidence, README and end-to-end presentation walkthrough | PF-026 | Repro demo reset, screenshots, true tx evidence, blocked attack log, one command setup docs. |
| PF-029 | P0 | A | Bind independent policy/simulation checks to certificate issuance | PF-007, PF-009, PF-012 | Verifier reloads trusted policy/state/config and refuses any FAIL; only trusted service issues signed certificate. |
| PF-030 | P0 | A | Isolated testnet-only signing and RPC adapter | PF-004 | Dedicated signer implementation, allowlisted transaction type/chain, pending/failed receipt handling, no private key exposure. |
| PF-031 | P0 | B | Controlled malicious planner fixture and red-team backend route | PF-007, PF-014, PF-017 | Intentionally unsafe structured candidate logged; verifier and executor reject; no signer invocation. |
| PF-032 | P0 | B | Emergency expense backend, state version bump and repricing route | PF-003, PF-010, PF-014 | Persist expense, invalidate old unspent authorization, recompute fresh compliant maximum, emit audit events. |

**Issue partitioning rules:** PF-012 crypto primitives, PF-013 approval binding, and PF-030 chain adapter can proceed in parallel with B's risk engine, while issuance PF-029 remains blocked until independent rule and simulation checks exist. PF-016 requires PF-017 for an integrated goal path, but earlier integration smoke tests may use a documented deterministic fallback. PF-031 and PF-032 are concrete B-owned backend issue deliverables for PF-023/PF-024 UI integration, with A reviewing any executor-related change. PF-026 is a coordinated shared integration issue with distinct test-file ownership, not three people simultaneously changing the same files. All real chain work waits for configuration/funded testnet credentials but the chain adapter and deterministic tests can be built without secrets.

### 12.3 Practical branch assignments and first integration slice

- **A after foundation:** start PF-012, PF-013 and PF-030 in the security/chain workstream; integrate PF-029 once B's rules/simulation are merged, then PF-014 -> PF-015 -> PF-016. Build/review the signer gate and integration. Use trusted verifier fixtures **only in isolated tests** until B's policy/simulation passes; never permit production endpoints to accept fixtures as authority.
- **B after foundation:** PF-006 + PF-008 on non-conflicting branches; then PF-007, PF-009, PF-010, PF-011, PF-017, PF-031, PF-032, PF-027. Keep pure policy/simulation functions independent of the web server when possible.
- **C after foundation:** PF-018 first; then PF-019, PF-020, PF-021, PF-022 as contracts land; then PF-023, PF-024, PF-025, PF-028. Use generated typed API interfaces, tests for loading/error states, and only separately labeled fixture mode until actual endpoints work.

**Earliest viable vertical slice:** from the real UI, read seeded state, submit a constrained goal (deterministic planner is acceptable and labeled), compute policy/stress-checked safe action, display a certificate, request explicit approval, pass **backend-independent executor validation**, make a real allowlisted **testnet** transfer, show transaction hash and audit event. Build and smoke-test this before polishing nine screens. Then integrate the attack scenario and emergency scenario with the same real verifier/executor. Never define Done as UI-only, API-only, or test-only.

### 12.4 Integration checkpoints and escalation

1. **Contract gate:** `openapi.json` checked in/regenerated, shared fields and error types match TS client, money units explicit.
2. **Backend gate:** policy + simulation + verifier tests run; incorrect candidate never receives a trusted certificate; certificate/approval boundary tests pass.
3. **Execution gate:** no-cert, tampered, stale, replay, wrong-recipient/amount tests fail closed; configured genuine testnet transfer succeeds and receipt is linked.
4. **Browser gate:** full user journey works on a fresh seeded state without manual DB edits or browser console manipulation.
5. **Scenario gate:** hero, injected malicious proposal, and emergency replanning each work from the UI and produce audit evidence.
6. **Delivery gate:** all 12 acceptance tests accounted for; one real testnet explorer link; README, threat model, simulation assumptions, setup, known limitations, demo script, and evidence verified.

Use **short integration loops**: each merged issue triggers local/CI smoke checks; keep a simple `scripts/smoke_e2e` or Playwright suite runnable against backend + frontend. When blocked by a teammate's contract, update the GitHub issue dependency and work on the next unblocked task instead of creating incompatible local alternatives. Escalate stale dependencies to LEAD promptly. Freeze optional features whenever any P0 gate is failing; do not waive security controls.

### 12.5 Instructions for creating issues programmatically

When an actual GitHub repository is available and the lead authorizes issue publication (even while the foundation is being built):

1. Discover `owner/repo` using Git remote or existing GitHub context; do not invent it. Check `gh auth status` or an authenticated GitHub integration; avoid asking for access to secrets.
2. Inspect already-existing issues and labels to prevent duplicates (`PF-###` stable identifiers). Create missing labels only where permissions allow.
3. Write one Markdown file per uncreated issue under `.github/issue-drafts/PF-###.md` including owner role, true dependencies, exact files, API examples, checklist, tests, and acceptance. Ensure the issue's body reflects the **actual existing code**, not generic boilerplate.
4. Create actual issues with `gh issue create --repo OWNER/REPO --title '[PF-###] ...' --body-file .github/issue-drafts/PF-###.md --label ...` **only after** credentials and repo identity are confirmed. Batch thoughtfully; if label or assignee is unavailable, retry without unavailable metadata and document it. Never misrepresent creation success.
5. Capture returned issue numbers and URLs in `docs/ISSUE_BACKLOG.md`; update cross-issue dependency references to actual issue numbers/links; assign only confirmed GitHub handles.
6. Create `.github/ISSUE_TEMPLATE/feature.yml` and `bug.yml`, `.github/pull_request_template.md`, `CODEOWNERS` if supported, and `CONTRIBUTING.md`, plus `.github/workflows/ci.yml` running backend/frontend checks. Suggest (but do not assume ability to configure) branch protection rules.
7. Start work on the earliest unblocked issue **within your assigned workstream**. Never autonomously open or merge other contributors' PRs without review authorization, rewrite their work, or bypass tests.

**Required issue body skeleton:**

```md
## Goal
## Owner role / intended GitHub assignee (if known)
## Priority / labels
## Dependencies (PF IDs and confirmed #numbers)
## Owned paths / shared contract impact
## API/schema/examples
## Implementation checklist
- [ ] ...
## Acceptance criteria (observable and testable)
- [ ] ...
## Test commands and expected results
## Evidence (PR link, screenshots/trace as applicable)
## Out of scope
```

**Final feature-priority fallback:** independent verifier/executor + genuine transaction first; financial risk logic and optimization second; blocked malicious proposal and stale-state proof third; polished UI and supporting visuals last. This is a priority ordering for triage, **not** permission to issue certificates before all required policy/simulation checks are enforced.

## 13. DELIVERABLES AND DOCUMENTATION

Leave the repository ready for a judge to clone and run. Required files and artifacts:

- `README.md`: problem/pitch, trust-boundary graphic, prerequisites, local setup, environment configuration, demo commands, synthetic/testnet distinction, known limitations, security warning.
- `docs/ARCHITECTURE.md`: modules, trust boundary, exact step-wise flow, state/policy/certificate lifecycle, chain mapping.
- `docs/SIMULATION_METHOD.md`: probability assumptions, distributions, named shocks, seeds, Monte Carlo paths, model limitations, result interpretation and reproducibility.
- `docs/THREAT_MODEL.md`: attacker controls compromised planner (not trusted verifier/approval/store/signer), attack surfaces, mitigations, residual risks; no production security claims.
- `docs/API.md`: endpoints and sample requests/responses/errors.
- `docs/TEST_RESULTS.md`: commands, pass/fail, AT-01..AT-12 evidence.
- `docs/DECISIONS.md`, `docs/PROGRESS.md`, `docs/KNOWN_LIMITATIONS.md`, `docs/ISSUE_BACKLOG.md`, `docs/ARCHITECTURE.md`, `docs/OWNERSHIP.md` or equivalent contributor path ownership.
- `docs/DEMO_SCRIPT.md`: four-minute storyboard from attached spec (0:00 problem; constitution; hero; certificate + chain; red team; emergency; audit; close).
- `docs/SUBMISSION_CHECKLIST.md` and `docs/PRESENTATION_OUTLINE.md` (<=10 min presentation, <=5 min demo video as conservative target).
- `evidence/`: real testnet tx hash + explorer URL + receipt/block; Action Certificate JSON + readable view; blocked malicious action log; audit export; screenshots; anonymized test logs. If evidence unavailable, explicit `NOT_YET_COMPLETED` with reproducible instructions, not placeholders masquerading as facts.
- `.env.example`, reproducible seed/reset scripts, schema migration/bootstrap, locked dependencies where practical, gitignore that excludes secrets; `.github` issue and PR templates, CI config and `CONTRIBUTING.md`.

Ensure that documentation distinguishes **deterministic policy verification**, **certificate integrity/authenticity**, and **probabilistic scenario analysis**. Never claim mathematical proof of future solvency, independent legal compliance, safe production custody, or statistically validated forecasting. Acceptable language: **“97% simulated goal satisfaction under the declared model assumptions.”**

## 14. REQUIRED CODEX RESPONSE AND CONTINUATION FORMAT

Start with:

1. **Repository inventory:** current structure, implemented functionality, files/spec actually read, running commands.
2. **Lead-owned foundation checklist:** PF-001..PF-005 with PASS / IN PROGRESS / BLOCKED and precise missing items. Help LEAD complete these **first**; do not delegate these or silently replace architectural choices.
3. **Shared contracts:** schema/ERD version, testnet/transaction semantics, API error codes, exact pending decisions and known external blockers.
4. **GitHub backlog:** proposed PF-006..PF-032 issues grouped by owner, dependencies, actionable PR scopes and acceptance tests. Clearly say `DRAFT`, `PUBLISHED`, or `BLOCKED_ON_GITHUB_ACCESS`; verify actual repo issue numbers before claiming publication.
5. **Immediate next code changes:** what is safe to implement now without racing a teammate or changing shared contracts.

Publish the issue backlog early when repository access permits; keep foundation-dependent issues marked blocked until their shared contracts are merged. Then implement the first unblocked issue relevant to the current contributor. When starting any future Codex session, read `AGENTS.md` if present, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`, `docs/ISSUE_BACKLOG.md`, the issue body, and current main branch; adhere to owner-specific paths and pull-request rules.

After each PR or integration work interval report:

```text
GITHUB ISSUE / PR (or pending authorization):
OWNER ROLE:
DEPENDENCIES CLEARED:
COMPLETED:
FILES CHANGED:
CONTRACT CHANGES (and lead approval):
COMMANDS RUN:
TEST RESULTS:
BROWSER-TO-BACKEND SMOKE STATUS:
REAL CHAIN EVIDENCE (or NOT CONFIGURED):
OPEN RISKS / BLOCKERS:
NEXT UNBLOCKED ISSUE:
```

**Definition of Done:** A team member who did not implement ProofFi can check out `main`, follow the README, seed and start the application, use the goal UI, observe a *calculated* policy-compliant allocation and reproducible simulations, review a signed certificate, explicitly approve, execute exactly one authorized transaction on a genuine EVM testnet, follow a real explorer link, demonstrate planner compromise with **no unauthorized signing**, introduce an emergency expense and see stale authorization rejected and a safe alternative recalculated, verify certificate status, read a complete audit trail, and run AT-01 through AT-12. All critical PRs are merged/reviewed with clear ownership, passing CI, and documented genuine testnet evidence. If anything is missing, label the system incomplete and identify the specific missing gate; **never claim end-to-end completeness based only on mocks**.

**Begin now:** inspect the repo, preserve the lead's architecture decisions, help establish and validate the foundation, prepare and publish GitHub Issues once authenticated repository access is confirmed, and then implement the next truly unblocked task. **Do not assign calendar dates to the plan.**
