'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatUsd } from '@/lib/format';
import { buildCandidate, type CandidateAction, type CandidateErrors, type CandidateForm } from '@/lib/candidate';
import { isNotImplemented, run, writeHeaders, type Outcome, type Problem } from '@/lib/request';
import { useActivePolicy } from '@/lib/use-active-policy';
import { AppShell } from '@/components/shell/AppShell';
import { CandidateFields } from '@/components/simulation/CandidateFields';
import { EmergencyPanel } from '@/components/emergency/EmergencyPanel';
import { explainOptimizer, MODE_LABEL, timeMachineLink, type OptimizerResult, type ParsedIntent, type PlanResponse, type VerificationResult } from '@/components/workspace/explain';

const sessionProblem: Problem = { code: 'UNAUTHORIZED', message: 'Your session could not be checked. Sign in again and retry.', reasons: [], httpStatus: 0 };

function StepProblem({ step, problem }: { step: string; problem: Problem }) {
  return <div role="alert" className="notice">
    <p><strong>{isNotImplemented(problem) ? `${step} is not available yet.` : `${step} failed.`}</strong> {problem.message}</p>
    {problem.reasons.length > 0 && <ul>{problem.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
  </div>;
}

function CandidateCard({ action, selected, onSelect }: { action: CandidateAction; selected: boolean; onSelect: () => void }) {
  return <li className={`candidate${selected ? ' selected' : ''}`}>
    <div>
      <strong>{formatUsd(action.amount_minor)}</strong> to <code>{action.recipient}</code>
      <p className="hint">Planner says (untrusted): “{action.planner_reason_untrusted}”</p>
    </div>
    <button type="button" className="secondary" aria-pressed={selected} onClick={onSelect}>{selected ? 'Selected' : 'Use this candidate'}</button>
  </li>;
}

export default function WorkspacePage() {
  const router = useRouter();
  const { policy, error: loadError, reload } = useActivePolicy();
  const [goal, setGoal] = useState('');
  const [goalError, setGoalError] = useState('');
  const [busy, setBusy] = useState<'plan' | 'optimize' | 'verify' | null>(null);
  const [intent, setIntent] = useState<ParsedIntent | null>(null);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [planProblem, setPlanProblem] = useState<Problem | null>(null);
  const [selected, setSelected] = useState<CandidateAction | null>(null);
  const [manual, setManual] = useState<CandidateForm>({ amount: '1000', token: '', recipient: '' });
  const [manualErrors, setManualErrors] = useState<CandidateErrors>({});
  const [optimized, setOptimized] = useState<OptimizerResult | null>(null);
  const [optimizeProblem, setOptimizeProblem] = useState<Problem | null>(null);
  const [verification, setVerification] = useState<VerificationResult | null>(null);
  const [verifyProblem, setVerifyProblem] = useState<Problem | null>(null);

  useEffect(() => {
    if (!policy) return;
    setGoal((g) => g || policy.state.snapshot.goal.text);
    const rules = policy.active?.rules;
    if (rules) setManual((m) => ({ ...m, token: m.token || rules.allowed_tokens[0] || '', recipient: m.recipient || rules.known_recipients[0] || '' }));
  }, [policy]);

  /** Runs one protected POST; returns null after redirecting when the session expired. */
  async function post<T>(call: (headers: Record<string, string>) => Promise<Outcome<T>>): Promise<Outcome<T> | null> {
    try {
      const outcome = await call(await writeHeaders());
      if (!outcome.ok && outcome.expired) { router.replace('/login'); return null; }
      return outcome;
    } catch { return { ok: false, expired: false, problem: sessionProblem }; }
  }

  function resetFrom(step: 'plan' | 'optimize') {
    if (step === 'plan') { setIntent(null); setPlan(null); setPlanProblem(null); setSelected(null); }
    setOptimized(null); setOptimizeProblem(null); setVerification(null); setVerifyProblem(null);
  }

  async function makePlan() {
    const text = goal.trim();
    if (!text) { setGoalError('Describe what you want ProofFi to do.'); return; }
    if (text.length > 2000) { setGoalError('Keep the goal under 2000 characters.'); return; }
    setGoalError(''); resetFrom('plan'); setBusy('plan');
    try {
      const [parsed, planned] = await Promise.all([
        post((headers) => run(() => api.POST('/intent/parse', { body: { goal: text }, headers }))),
        post((headers) => run(() => api.POST('/plans/generate', { body: { goal: text }, headers }))),
      ]);
      if (!parsed || !planned) return;
      if (parsed.ok) setIntent(parsed.data);
      if (!planned.ok) { setPlanProblem(planned.problem); return; }
      setPlan(planned.data);
      setSelected(planned.data.candidates[0] ?? null);
    } finally { setBusy(null); }
  }

  async function optimize(action: CandidateAction) {
    resetFrom('optimize'); setBusy('optimize');
    try {
      const outcome = await post((headers) => run(() => api.POST('/optimize', { body: { action }, headers })));
      if (!outcome) return;
      if (!outcome.ok) { setOptimizeProblem(outcome.problem); return; }
      setOptimized(outcome.data);
    } finally { setBusy(null); }
  }

  function optimizeManual() {
    const built = buildCandidate(manual, 'Candidate entered by the person on the Workspace screen', 'workspace');
    if (!built.ok) { setManualErrors(built.errors); return; }
    setManualErrors({}); setSelected(built.action);
    void optimize(built.action);
  }

  async function verify(action: CandidateAction) {
    setVerification(null); setVerifyProblem(null); setBusy('verify');
    try {
      const outcome = await post((headers) => run(() => api.POST('/verify', { body: { action }, headers })));
      if (!outcome) return;
      if (!outcome.ok) { setVerifyProblem(outcome.problem); return; }
      setVerification(outcome.data);
    } finally { setBusy(null); }
  }

  const explained = optimized ? explainOptimizer(optimized) : null;
  const safeAction = optimized?.status === 'SAFE_ACTION' ? optimized.action : null;

  return <AppShell current="/workspace">
    <section className="page-head">
      <p className="eyebrow">INTELLIGENCE PROPOSES</p>
      <h1>Workspace</h1>
      <p>Describe a goal. The AI planner proposes candidate actions, and an independent optimizer finds the largest amount your Constitution allows, or says honestly that none exists. Planner text is never trusted as authority.</p>
    </section>

    {!policy && !loadError && <p role="status" className="skeleton">Loading your state and rules…</p>}
    {loadError && <div role="alert" className="notice"><p><strong>Could not load your state.</strong> {loadError}</p><button type="button" className="secondary" onClick={() => void reload()}>Try again</button></div>}

    {policy && <>
      {!policy.active && <p className="notice">No Constitution is active, so nothing can be optimized or verified yet. <a href="/constitution">Set one up</a>.</p>}

      <section className="editor" aria-label="Goal">
        <h2>1. Goal</h2>
        <form noValidate onSubmit={(e) => { e.preventDefault(); void makePlan(); }}>
          <div className="field field-wide">
            <label htmlFor="goal">What should ProofFi do?</label>
            <textarea id="goal" rows={3} value={goal} maxLength={2000} onChange={(e) => { setGoal(e.target.value); setGoalError(''); }}
              aria-invalid={goalError ? true : undefined} aria-describedby={goalError ? 'goal-error' : 'goal-help'} className="prose-input" />
            <small id="goal-help">Plain language. The planner may ask a clarifying question.</small>
            {goalError && <small id="goal-error" className="field-error">{goalError}</small>}
          </div>
          <div className="actions"><button type="submit" disabled={busy !== null}>{busy === 'plan' ? 'Planning…' : 'Propose candidates'}</button></div>
        </form>
        {intent && <div className="understood" aria-label="What ProofFi understood">
          <p>Understood: maximise an allocation within your policies{intent.obligation_id ? `, protecting obligation “${intent.obligation_id}”` : ''}.</p>
          {intent.ambiguities.length > 0 && <ul>{intent.ambiguities.map((a) => <li key={a}>{a}</li>)}</ul>}
        </div>}
      </section>

      <section className="editor" aria-label="Candidates">
        <h2>2. Candidates</h2>
        {planProblem && <StepProblem step="The planner" problem={planProblem} />}
        {plan && <>
          <p>{MODE_LABEL[plan.mode]} proposed {plan.candidates.length} candidate{plan.candidates.length === 1 ? '' : 's'}.</p>
          {plan.clarification.length > 0 && <div className="notice"><p><strong>The planner needs more detail:</strong></p><ul>{plan.clarification.map((c) => <li key={c}>{c}</li>)}</ul></div>}
          {plan.candidates.length > 0 && <ul className="candidates">{plan.candidates.map((c) => <CandidateCard key={c.id} action={c} selected={selected?.id === c.id} onSelect={() => { setSelected(c); resetFrom('optimize'); }} />)}</ul>}
          {selected && plan.candidates.some((c) => c.id === selected.id) && <div className="actions">
            <button type="button" disabled={busy !== null} onClick={() => void optimize(selected)}>{busy === 'optimize' ? 'Searching…' : 'Find the largest safe amount'}</button>
          </div>}
        </>}
        {!plan && <details className="manual" open={Boolean(planProblem)}>
          <summary>Or enter a candidate yourself</summary>
          <form noValidate onSubmit={(e) => { e.preventDefault(); optimizeManual(); }}>
            <CandidateFields form={manual} errors={manualErrors} idPrefix="workspace" onChange={(key, value) => { setManual((m) => ({ ...m, [key]: value })); setManualErrors((er) => ({ ...er, [key]: undefined })); }} />
            <div className="actions"><button type="submit" disabled={busy !== null}>{busy === 'optimize' ? 'Searching…' : 'Find the largest safe amount'}</button></div>
          </form>
        </details>}
      </section>

      <section className="editor" aria-label="Safe amount">
        <h2>3. Largest safe amount</h2>
        {!optimized && !optimizeProblem && <p>Choose a candidate to search for the exact limit your Constitution allows.</p>}
        {optimizeProblem && <StepProblem step="The optimizer" problem={optimizeProblem} />}
        {explained && optimized && <div className={`status-banner tone-${explained.tone}`} role="status" data-testid="optimizer-result">
          <p className="status-title">{explained.title}</p>
          <p>{explained.body}</p>
        </div>}
        {safeAction && <div className="actions">
          <a className="button-link secondary" href={timeMachineLink(safeAction)}>See its futures in the Time Machine</a>
          <button type="button" disabled={busy !== null} onClick={() => void verify(safeAction)}>{busy === 'verify' ? 'Verifying…' : 'Verify and get a certificate'}</button>
        </div>}
        {verifyProblem && <StepProblem step="Verification" problem={verifyProblem} />}
        {verification && <div role="status" className={verification.certificate_id ? 'success' : 'notice'}>
          <p>Verifier decision: <b>{verification.verdict.decision}</b>.{verification.reasons.length > 0 && ` ${verification.reasons.join('; ')}.`}</p>
          {verification.certificate_id
            ? <p>Certificate issued: <a href={`/certificates?id=${encodeURIComponent(verification.certificate_id)}`}><code>{verification.certificate_id}</code></a></p>
            : <p>No certificate was issued, so this action cannot be executed.</p>}
        </div>}
      </section>

      <EmergencyPanel stateVersion={policy.state.snapshot.version} previous={optimized} certificateId={verification?.certificate_id ?? null} onStateChanged={() => void reload()} />
    </>}
  </AppShell>;
}
