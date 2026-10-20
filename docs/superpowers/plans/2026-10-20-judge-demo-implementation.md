# Isolated Judge Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship one-click judge access to disposable synthetic planning/verification sandboxes with server-disabled sending and an unchanged complete operator workflow.

**Architecture:** Authenticate an opaque cookie to an immutable application/database scope before dispatch. Preserve single-user financial models inside separate SQLite guest databases, and pass explicit guest verifier/provider settings instead of borrowing operator authority. Merge the backend contract before its product UI consumer; enable only after actual hosted isolation checks.

**Tech Stack:** Existing Python 3.11, FastAPI, Pydantic, SQLAlchemy/Alembic/SQLite/PostgreSQL, cryptography, Next.js/React/TypeScript and Playwright. No new dependency or paid service.

**Spec:** `docs/superpowers/specs/2026-10-20-judge-demo-design.md`, approved at a3998127c5984fbee3b3d70c2c8bc587a5b0962a; approval record in issue #159 and PR #161.

## Global Constraints

- Work one issue per branch: #160 `codex/pf-160-judge-runtime`; #162 `codex/pf-162-judge-entry`. #161 must have passing current CI and merge before runtime implementation; #160 runtime PR must be separately lead-reviewed and merged before #162 implementation.
- Keep existing routes/operation identities, SessionInfo, cookie attributes, financial models, signed payload/transaction encoding and operator A/B/C behavior unchanged. All new public models live in `services/api/app/models/contracts.py`.
- Exact profile `synthetic-funded-demo-v1`; digest `69f1faf7aed9c279e88745675bfbc807f6d3d1528284e0a79c3d8cd88739acbb`; $17,000 synthetic cash, no income, 1,000 paths/120 days, seed 18421, 2% daily volatility, 20% additional $2,000 emergency probability, $1 synthetic fee. Launch explicitly selects these inputs; policy confirmation stays separate.
- Judge access default-off; fixed non-sliding 1,800-second lifetime; at most eight scopes; three starts/minute globally; 120 requests/minute/guest and 240/minute globally; at most two expensive guest computations; three live planner calls/guest and 18/hour globally. Public logout/new scope must not reset global budgets.
- Maximum 65,536 request-body bytes enforced on streamed backend input before parsing/provisioning/work admission, independently of proxy and Content-Length. Overflow: HTTP 413 / VALIDATION_ERROR. Oversize/failed provisioning grants no authority.
- Guest DB maximum 16 MiB including side files; aggregate guest storage maximum 128 MiB. Reject at the bound and preserve transactions/leases; never delete a live engine. Do not create an operator migration or silently change schema.
- Guest permission set exactly `read,rules,plan,simulate,verify,expense`; deny `/approvals`, `/execute`, `/executions/{id}`, `/demo/attack`, `/demo/reset` with 403 before operational-policy/signer/dispatch/reconciliation access. Unknown routes remain NOT_IMPLEMENTED.
- No guest EVM key or operator verifier-key fallback. Guest certificate keys are ephemeral/distinct and absent from operator trust. Real provider/RPC errors remain unavailable; test substitutes never become feature output.
- Preserve operator recovery identities; guest cache namespace uses a non-secret server scope ID. Revalidate/gate across same-tab, other tabs, hidden/pagehide/pageshow/BFCache transitions. Notifications can invalidate only, never grant authority.
- Focused tests during work, full `npm run check` and current Ubuntu/Windows/PostgreSQL CI before merge. No direct main pushes, failed-CI bypass, invented acceptance evidence or silently enabled financial state.

## Review Focus

1. Expiry/logout racing an admitted DB/provider operation: revoke new admission immediately; hold a lease until the bounded operation completes, then close/delete only its scope (Task 2).
2. Direct Render calls with chunked or forged Content-Length: enforce streaming byte limits before provisioning/computation, not just at Vercel (Task 1).
3. Guest workflow/provider helper loading operator defaults indirectly: explicit runtime/keyring propagation and sanitized worker environment; fail closed when guest inputs are absent (Task 3).
4. Second-tab cookie replacement and Back/BFCache restore: previous financial DOM stays gated until fresh access matches; preserve operator recovery IDs (Task 5).
5. Failure/lost response while switching sessions: failed creation/login retains prior authority; successful creation never silently falls back, and retry consumes bounded capacity without resetting budgets (Tasks 2 and 5).

---

## File boundaries and merge sequence

Backend #160 owns `app/judge/` (scope registry/dispatch/limits), `app/core/auth.py` (role-bound authentication), `app/core/settings.py`, `app/main.py` (fixed scope factory), canonical models, explicit service-runtime hooks, `services/api/migrations/env.py` (connection injection only), backend tests, generated artifacts and backend docs. Keep new units small; do not mix registry lifecycle, HTTP streaming and provider budgeting into one file.

UI #162 owns the existing login/app shell, a new access gate and cache helper, capability-aware panels, the exact proxy allowlist additions, Playwright coverage and deployment evidence/docs. The UI may not substitute a browser-only execution guard for the backend contract.

**Recommended execution:** Native implementation in this chat, task by task, with focused tests at each step and independent whole-branch review before each PR merge. The tightly coupled auth/registry/runtime interfaces favor continuity; runtime and UI remain separately reviewed releases. Written-plan review and execution-method selection are required before product code.

### Task 1: Typed access contract and bounded HTTP admission (#160)

**Files:** Modify `services/api/app/models/contracts.py`, `app/core/auth.py`, `app/core/settings.py`, `app/main.py`; create `app/judge/http.py`, `app/judge/access.py`; tests `services/api/tests/test_pf_160_access.py`, `test_pf_160_http.py`; regenerate `contracts/openapi.json`, `apps/web/src/lib/schema.d.ts`.

**Interfaces:** Produce canonical `JudgeStartRequest`, `JudgeSessionInfo`, `SessionAccess`. Add `SessionManager.authenticate_scope(request, token, *, mode, scope_id=None) -> str`; existing `authenticate` always requires operator mode. Add `BoundJudgeAuth(manager, scope_id, settings)` exposing compatible `authenticate`/session/logout routes. Preserve existing caller signatures. Add `read_bounded_body(receive, maximum=65536) -> bytes` and positive guest method/path permission check. Mode/scope come only from server session records; root authentication rejects guest records even if dispatch is bypassed. Use one authoritative token namespace and shared metadata lock with separate operator/guest capacity counts.

- [ ] Write failing cases: fixed profile plus literal boolean true accepted; numeric 1/extra role/config fields rejected; missing cookie 401; guest against root auth 403; existing operator login/session/logout/cookies unchanged. New start returns explicit unavailable while disabled, never a success-shaped placeholder.
- [ ] Add `test_judge_start_disabled`, `test_judge_consent_is_literal_true`, `test_root_auth_rejects_guest_record`. Representative assertions: `assert disabled_response.status_code == 503`; `assert numeric_consent_response.status_code == 422`; `assert root_with_guest.status_code == 403`; `assert original_operator_session_fields == {"csrf_token", "expires_at"}`.
- [ ] Write raw-ASGI oversize and chunked cases asserting 413, retained bytes <=65536, and zero provision/provider/simulation admission, including incorrect/missing Content-Length.
- [ ] Run `.venv/bin/python -m pytest services/api/tests/test_pf_160_access.py services/api/tests/test_pf_160_http.py -q`; confirm the named assertions fail before code.
- [ ] Implement the canonical contracts and role-bound admission interfaces. Register new operation IDs `start_judge_session` and `session_access`; retain all existing operation IDs. Denied capability paths fail before body-model parsing/operational helpers.
- [ ] Run those tests plus `services/api/tests/test_pf_033.py`; expect zero failures. Run `npm run contracts`; inspect additive-only generated diff.
- [ ] Commit exact Task 1 paths: `PF-160: add typed judge access and bounded admission`.

### Task 2: Immutable disposable database scopes and cleanup (#160)

**Files:** Create `app/judge/scopes.py`, `app/judge/storage.py`, `app/judge/dispatch.py`, `app/judge/limits.py`; modify `app/main.py`, `app/core/auth.py`, `services/api/migrations/env.py`; tests `test_pf_160_scopes.py`, `test_pf_160_lifecycle.py`.

**Interfaces:** `JudgeRegistry.create(profile_id: str, accepted: bool, response: Response, old_token: str | None = None) -> JudgeSessionInfo`; `lease(token_digest: str) -> ContextManager[JudgeScope]`; `revoke(token_digest: str) -> None`; `cleanup_expired() -> None`. Frozen `JudgeScope` owns `scope_id`, engine, bound auth and child app (which owns its fixed runtime); mutable lease/revocation counters live only in the registry. `create_app(settings: Settings | None = None, *, scope: ApplicationScope | None = None)` preserves legacy root callers and constructs guest apps with fixed bindings and no recursive dispatcher. Define frozen `ApplicationScope` in `app/judge/access.py`: engine, bound auth, scope_id, optional verification_runtime/chain_settings/proposal_provider. Missing judge service bindings return UNAVAILABLE, never operator defaults. `provision_judge_scope(root: Path, scope_id: str, settings: Settings, auth: BoundJudgeAuth, build_app: Callable[[Engine, BoundJudgeAuth], FastAPI]) -> JudgeScope` accepts server settings/profile only. Schema setup uses an explicitly supplied Alembic connection; serialize migration-context construction and never change process environment/default engine per guest.

- [ ] Write real-SQLite tests: two judges plus operator have different state/policy/audit/certificate visibility; guessed/repeated IDs cannot cross; funded v1/v2 provisioning is exact and policy remains unconfirmed; failed creation retains prior auth and removes only its unpublished files.
- [ ] Add `test_guest_expense_does_not_change_other_scopes`: after A's actual expense, `assert b_after == b_before`; `assert operator_after == operator_before`; `assert a_after["snapshot"]["version"] == a_before["snapshot"]["version"] + 1`.
- [ ] Write race tests: concurrent starts respect eight scopes and three starts/minute; expiry/revoke blocks new leases while an active lease keeps its DB alive; file deletion occurs only after final release; startup removes only orphan files under the dedicated directory. Invalid cookies cannot fall through to operator data.
- [ ] Write disk-full test using actual SQLite growth/rollback. Use 4-KiB pages, a conservative 1,856-page main-file ceiling, DELETE journaling, no WAL and memory-only temporary tables; bound main plus rollback side-file worst case below 16 MiB. Reserve/check aggregate capacity before creation/write admission; refuse scope directories/symlinks outside the private root. Test metadata/connection counts return to baseline after failure.
- [ ] Run `.venv/bin/python -m pytest services/api/tests/test_pf_160_scopes.py services/api/tests/test_pf_160_lifecycle.py -q`; observe intended failures.
- [ ] Implement registry reservations, authoritative role dispatch, lease-held operations and safe storage lifecycle. Share a defined metadata lock/order; perform no migration, filesystem I/O, RPC or provider call while holding it. Replace/revoke old sessions only after new scope publication succeeds. Operator capacity remains 32 independently of eight guests.
- [ ] Rerun Task 1-2 tests and existing migration roundtrip; expect pass. Commit `PF-160: isolate judge databases and lifecycle`.

### Task 3: Scoped real verification, chain and planner services (#160)

**Files:** Create `app/verifier/runtime.py`, `app/judge/runtime.py`, `app/judge/planner.py`; modify `app/verifier/service.py`, `app/verifier/router.py`, `app/workflows/service.py`, `app/workflows/router.py`, `app/planner/service.py`, `app/planner/provider.py`, `app/planner/router.py`, `app/optimizer/chain.py`, `app/optimizer/router.py`, `app/demo/emergency.py`, `app/demo/router.py`; tests `test_pf_160_runtime.py`, `test_pf_160_provider_limits.py`.

**Interfaces:** Frozen `VerificationRuntime` stores `verifier_private_key: SecretStr`, `verifier_key_id: str`, `verifier_transaction_config_json: SecretStr`, `rpc_url: SecretStr`, and `public_key_items: tuple[tuple[str, bytes], ...]`, with `to_settings() -> RuntimeSettings` and `public_keys() -> dict[str,Ed25519PublicKey]`; construct all settings fields explicitly with env-file loading disabled. `verify_action(engine: Engine, body: ActionRequest, actor_id: str, *, runtime: VerificationRuntime | None = None) -> VerificationResult`; `signing_configuration(settings: RuntimeSettings, *, public_keys: Mapping[str, Ed25519PublicKey] | None = None) -> tuple[Ed25519PrivateKey, str, Mapping[str, Ed25519PublicKey]]`; `prepare_goal(engine: Engine, body: IntentRequest, actor_id: str, *, runtime: VerificationRuntime | None = None, chain_settings: ChainSettings | None = None, proposal_provider: ProposalProvider | None = None) -> WorkflowResult`. These preserve current operator defaults only when no override is supplied. Define `ProposalProvider = Callable[[str, dict, PlannerSettings], Proposal]` in `app/planner/provider.py`. `plan(engine: Engine, actor: str, goal: str, *, parse_only: bool = False, proposal_provider: ProposalProvider | None = None) -> ParsedIntent | PlanResponse` consumes this callable; the judge callable reserves its per-scope/global budgets before one real provider call. `load_chain_bounds(action: CandidateAction, *, settings: ChainSettings | None = None) -> ChainBounds` and `record_emergency(engine: Engine, body: EmergencyRequest, actor: str, *, chain_settings: ChainSettings | None = None) -> EmergencyResponse` accept explicit public chain configuration; guest routers always pass the scoped copy.

- [ ] Write genuine policy/simulation/crypto tests: guest cert uses its ephemeral key; mismatched/missing guest context returns unavailable without calling operator key loaders; guest cert fails operator trust. Workflow and certificate-status checks use the same scoped keyring. Original canonical bytes are identical for identical preexisting inputs.
- [ ] Add `test_guest_verifier_never_falls_back_to_operator`: `assert missing_context_error.code == ErrorCode.UNAVAILABLE`; `assert operator_key_loader_calls == 0`; `assert guest_certificate.key_id not in operator_public_keys`; `assert verify_integrity(guest_certificate, operator_public_keys).signature_valid is False`.
- [ ] Write provider-budget tests: calls 1-3 allowed per guest, fourth 429; 18/hour global including replaced/expired scopes; fresh guest/logout does not reset global history. Workflow/parse/generate all count the actual provider invocation once. Missing provider/RPC returns real unavailable with no fabricated certificate/hash.
- [ ] Capture the isolated worker invocation and assert its environment contains no EVM/verifier/password/database secret. Add keyword-only `worker_environment: Mapping[str, str] | None = None` to `vertex_proposal(goal, context, settings) -> Proposal`; guest allowlists OS/encoding/CA/runtime paths and the known Python module path, passes only provider settings through existing private stdin, and never copies all of `os.environ`. Operator default behavior remains unchanged.
- [ ] Run `.venv/bin/python -m pytest services/api/tests/test_pf_160_runtime.py services/api/tests/test_pf_160_provider_limits.py -q`; observe failures before adding hooks.
- [ ] Implement explicit overrides and bounded callable. Production guest settings select the existing live provider path explicitly; an operator deterministic-demo mode must not turn into a guest live-output fallback. Missing live configuration remains unavailable. No execution/approval/verifier imports enter planner. Guest allowed routes invoke real engines; controlled executor probe/reset remain denied. Do not treat deterministic demo text or test RPC as live feature completion.
- [ ] Rerun scoped tests plus existing planner/issuance/workflow/emergency tests; expect pass. Commit `PF-160: bind real guest services to scoped runtime`.

### Task 4: Backend contract integration, attack surface and review (#160)

**Files:** Create `services/api/tests/test_pf_160_isolation.py`; extend `services/api/postgres_tests/` existing operator integration tests as needed; update `docs/PROGRESS.md`, `docs/DECISIONS.md`, `docs/ISSUE_BACKLOG.md`, API inventory and a new `docs/JUDGE_DEMO.md`; regenerate canonical artifacts.

- [ ] Write end-to-end backend cases with operator execution enabled and valid request-shaped bodies: guests get 403 for every denied path, including direct HTTP/retry/guessed operator IDs; real signer/dispatch/reconcile counters stay zero and operator table snapshots stay exact. Test route aliases/unknown methods/default-deny behavior. Confirm two guests can independently confirm rules, record a synthetic expense and create genuine verified artifacts.
- [ ] Add `test_guest_execution_denial_precedes_signer`: for valid request bodies, `assert response.status_code == 403`; `assert signer_calls == dispatch_calls == reconcile_calls == 0`; `assert operator_after == operator_before`. Cover each denied path separately, not one representative route.
- [ ] Run focused isolation tests red, connect the earlier modules, then run them green. Temporarily remove a capability guard in an isolated test copy and confirm the regression fails; restore exact production source.
- [ ] Run `npm run check`, `npm run contracts`, contract/migration drift and dependency audit. Run all real PostgreSQL operator regressions against isolated fixtures. Resolve actual failures without weaker assertions or skipped tests.
- [ ] Record exact source, real/substituted boundaries, resource limits, approval record and actual results. Update spec status to approved with the owner's recorded #159 approval; do not invent code acceptance. Commit integration/docs and open a separate **contract-change** runtime PR for #160, default disabled.
- [ ] Obtain actual lead review and all three current CI jobs. Merge only that reviewed passing head. Mark #162 ready only after this prerequisite merges; never expose the public button against an older backend.

### Task 5: Launch entry and browser scope isolation (#162)

**Files:** Create `apps/web/src/lib/access.ts`, `apps/web/src/lib/scope-storage.ts`, `apps/web/src/shell/AccessGate.tsx`; modify `app/login/page.tsx`, `app/api/backend/[...path]/route.ts`, `src/shell/AppFrame.tsx`, `src/lib/session.ts`, `src/lib/request.ts`, `src/lib/safe-memory.ts`, `src/lib/execution-evidence.ts`, `src/components/approval/requests.ts`; tests `apps/web/e2e/judge-entry.spec.ts`, `judge-scope.journey.spec.ts`; test-only `apps/web/e2e/judge_runtime.py` and existing `apps/web/e2e/server.mjs` for the isolated backend fixture.

**Interfaces:** `loadAccess(): Promise<SessionAccess>` fetches no-store authenticated metadata. `invalidateAccess(): void` revokes only client display/action readiness and broadcasts a non-secret auth-change signal. `scopeStorageKey(access, originalKey): string` returns the existing operator key unchanged or `vallet.judge.<scope_id>.<originalKey>`; missing guest scope fails closed. `AccessGate` withholds all financial hooks/content until fresh metadata matches the active generation. Cache helpers receive/use the authenticated scope; no role chosen by URL/localStorage grants authority.

- [ ] Configure the isolated browser-test backend through its registry/app factory seam to substitute only the external planner provider. Keep the real routes, auth, databases, policy, simulation, verifier and test-chain adapter. The substitute lives only in the e2e helper; no public test switch, response interception or runtime fallback. Record it as isolated provider evidence, never genuine live AI.
- [ ] Write browser tests against the actual new backend: Launch sends fixed profile/strict true only after visible disclosure; Home/tour appears; failed launch retains prior authentication; operator password still works; guest replacement/expiry never restores old operator authority. No password appears in HTML/assets/URLs/storage.
- [ ] Add `judge: launch opens actual sandbox and tutorial`: `await page.getByRole('button', { name: 'Launch demo', exact: true }).click()`; `await expect(page.getByText('Judge demo', { exact: true })).toBeVisible()`; `await expect(page.getByTestId('tour')).toBeVisible()`; assert server access `mode === 'judge'` and `execution_enabled === false`.
- [ ] Seed operator goal/amount/evidence/recovery identities, switch between two guests, and assert no cross-scope display/read and exact operator recovery identity upon re-entry. Hold a stale financial/CSRF response through a scope switch and prove it cannot populate the new view.
- [ ] Add second-tab and Back/BFCache tests. Hide financial DOM on pagehide/hidden; invalidate via cross-tab signal; revalidate on pageshow/focus/visibility before rendering. Signal payloads grant nothing; unavailable access metadata and notification-unavailable concurrent switching fail closed.
- [ ] Run `npx playwright test --config apps/web/playwright.config.ts judge-entry.spec.ts judge-scope.journey.spec.ts`; observe failures, then implement the gate, helpers, exact two proxy route additions and primary Launch/secondary operator form. Successful auth switches use full navigation/remount; preserve existing cookie/CSRF behavior.
- [ ] Rerun focused tests green; run lint/types. Commit `PF-162: add judge launch and isolated client scopes`.

### Task 6: Honest capabilities and complete judge journey (#162)

**Files:** Modify `src/shell/AppContext.tsx`, `src/shell/TopNav.tsx`, `src/screens/home/HomeScreen.tsx`, `src/screens/approve/ApproveScreen.tsx`, relevant approval/execution panels, `src/screens/security/SecurityScreen.tsx`, `src/tour/` integration and auth styles; tests `apps/web/e2e/judge-demo.journey.spec.ts` and existing operator journey tests.

- [ ] Write real-backend journey assertions for persistent Judge demo / Sending disabled copy; explicit rule confirmation; real planning/simulation/verification; isolated synthetic expense; denied direct approval/send/probe/reset; no invented receipt or automatic request. A disabled button must have an accessible reason. Missing live services show actual errors.
- [ ] Add `judge: sending is disabled in UI and backend`: `await expect(page.getByText('Sending disabled', { exact: true })).toBeVisible()`; `expect(directExecute.status()).toBe(403)`; `expect(afterOperator).toEqual(beforeOperator)`. Capture genuine verification output and assert a real signature, without supplying a fake certificate response.
- [ ] Write desktop/phone/keyboard tour, loading/error/retry/expiry and operator-return cases; verify operator A/B/C and retained unknown-outcome flows remain intact. Only external services may be replaced in isolated test fixtures, never the deployed feature.
- [ ] Run focused journey red, implement capability-aware UI based on server access metadata and force the existing tour for every fresh guest, then rerun green. UI errors cannot assume operator mode.
- [ ] Run full `npm run check`, drift/audit checks and review final diff. Open #162 PR with genuine evidence; get independent review and current Ubuntu/Windows/PostgreSQL passing before merge. Commit `PF-162: complete honest judge journey and acceptance evidence`.

### Task 7: Actual rollout and operator preservation (#162)

**Files:** `docs/DEPLOYMENT.md`, `docs/JUDGE_DEMO.md`, `docs/PROGRESS.md`, sanitized `evidence/judge-demo/` artifacts; private snapshots remain ignored under `.local/`.

- [ ] Snapshot current operator financial state, drafts/history, certificates, execution/audit and public readiness; record current frontend/backend rollback revisions. Refuse unexpected changes rather than reseed/reset the live store.
- [ ] Deploy the exact reviewed merged runtime, preserving the existing Render/Supabase settings and free tier. Verify default-disabled behavior first. Enable only the approved judge flag/settings, without replacing operator keys, policy or data. Deploy/promote the exact merged Vercel source; no private workspace files in upload.
- [ ] Use two real isolated browser sessions on the live site. Verify Launch, fresh Home tutorial, distinct state/rules/expense/audit/certificates, honest provider/RPC behavior, denied approval/sending, expiry/re-entry and operator sign-in. Check bounded guest load does not make operator login/reads unusable; failure means disable judge mode and preserve evidence.
- [ ] Compare operator records exactly before/after; prove no new claim/signature/envelope/dispatch/receipt or ledger effect. Scan actual HTML/scripts/responses/cookies/storage for known private values without logging them. Repeat cross-tab/mobile access gate checks against the actual deployed build.
- [ ] Record deployment IDs/source revisions, actual tests and remaining limitations. Rollback is judge flag off plus scope revocation/cleanup and previous frontend; never DB reset. Close #162 only on genuine hosted acceptance, and #160 only after reviewed runtime integration evidence is linked.

## Plan self-review

- Spec coverage: auth/admission T1; DB/provisioning/leases/disk T2; real scoped services and provider budgets T3; backend isolation/contract review T4; entry/cache/cross-tab T5; honest capabilities/tour/operator regressions T6; actual rollout and preservation T7.
- Interfaces: canonical models generated once; root authentication is always operator-bound; dispatcher selects a fixed child scope; explicit runtime overrides reach workflow and certificate checking. No task accepts public trusted simulation inputs or client database selectors.
- Tests: each task has a red/green proof; all five Review Focus cases have owning tests. Existing full regressions remain mandatory at each releasable PR boundary.
- Scope: no new financial encoding, operator migration, paid infrastructure, fake chain output, policy auto-confirmation or unrelated extension integration.
- Gate: owner reviews this plan and selects Native or Subagent-driven before product implementation. Backend and UI retain their separate actual lead-review/current-CI gates.
