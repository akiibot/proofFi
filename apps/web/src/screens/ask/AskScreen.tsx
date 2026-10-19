'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { buildCandidate, type CandidateErrors, type CandidateForm } from '@/lib/candidate';
import { formatUsd } from '@/lib/format';
import { isNotImplemented } from '@/lib/request';
import { useActivePolicy } from '@/lib/use-active-policy';
import { MODE_LABEL } from '@/components/workspace/explain';
import { Page } from '@/shell/AppFrame';
import { useApp } from '@/shell/AppContext';
import { Button, TextLink } from '@/ui/Button';
import { Field, SuggestionChip } from '@/ui/form';
import { Disclosure, Divider, EdgeCard, RunStep, Skeleton, Status } from '@/ui/kit';
import { capitalise, facts, limitSentence, reasonText } from './explain';
import { FuturesDrawer } from './FuturesDrawer';
import { useAskRun, type Step } from './useAskRun';
import styles from './ask.module.css';

const SUGGESTIONS = ['Invest without risking tuition', 'How much can I safely use this month?', 'Keep $3,000 extra in cash'];
const stepState = (s: Step<unknown>) => (s.state === 'failed' ? 'todo' : s.state);

/** Figma "05 Ask", "06 Checking" and "07 Answer": one guided run from a goal in plain words to a verified safe amount. */
export function AskScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { policy, error: loadError, reload } = useActivePolicy();
  const { refreshNeedsYou } = useApp();
  const { state, start, startManual, certify, reset } = useAskRun(policy?.state.snapshot.version ?? null);
  const [goal, setGoal] = useState('');
  const [goalError, setGoalError] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState<CandidateForm>({ amount: '1000', token: '', recipient: '' });
  const [manualErrors, setManualErrors] = useState<CandidateErrors>({});
  const [showSteps, setShowSteps] = useState(false);
  const [futuresOpen, setFuturesOpen] = useState(false);
  const goalRef = useRef<HTMLTextAreaElement>(null);
  const rules = policy?.active?.rules ?? null;

  // A link may carry an exact amount (Home after an expense, old Time Machine links); it only fills the form.
  useEffect(() => {
    const amount = params.get('amount');
    const token = params.get('token'), recipient = params.get('recipient');
    if (amount || token || recipient) {
      setManualOpen(true);
      setManual((m) => ({ amount: amount ?? m.amount, token: token ?? m.token, recipient: recipient ?? m.recipient }));
    }
  }, [params]);

  useEffect(() => {
    if (!policy) return;
    setGoal((g) => g || policy.state.snapshot.goal.text);
    if (rules) setManual((m) => ({ ...m, token: m.token || rules.allowed_tokens[0] || '', recipient: m.recipient || rules.known_recipients[0] || '' }));
  }, [policy, rules]);

  const obligation = useMemo(() => {
    const o = policy?.state.snapshot.obligations.find((x) => x.id === state.intent.data?.obligation_id) ?? policy?.state.snapshot.obligations.find((x) => x.protected);
    return o ?? null;
  }, [policy, state.intent.data]);

  function submitGoal(text = goal) {
    const t = text.trim();
    if (!t) { setGoalError('Describe what you want Vallet to do.'); goalRef.current?.focus(); return; }
    if (t.length > 2000) { setGoalError('Keep the goal under 2000 characters.'); return; }
    setGoalError(''); setShowSteps(false); void start(t);
  }

  function submitManual() {
    const built = buildCandidate(manual, 'Candidate entered by the person on the Ask screen', 'workspace');
    if (!built.ok) { setManualErrors(built.errors); return; }
    setManualErrors({}); setShowSteps(false);
    void startManual(built.action, `Check ${formatUsd(built.action.amount_minor)} exactly`);
  }

  async function continueWith() {
    const id = await certify();
    if (id) { void refreshNeedsYou(); router.push(`/approve?id=${encodeURIComponent(id)}`); }
  }

  if (loadError) return <Page width={760}><EdgeCard where="Ask" title="Your money and rules could not be loaded" description={loadError} action={<Button kind="secondary" onClick={() => void reload()}>Try again</Button>} /></Page>;
  if (!policy) return <Page width={760}><div className={styles.loadingAsk} role="status" aria-label="Loading"><Skeleton width="60%" height={48} radius={12} /><Skeleton height={106} radius={24} /></div></Page>;

  const running = state.intent.state !== 'todo' || state.manual;
  const answer = state.check.data;
  const safe = answer?.status === 'SAFE_ACTION' ? answer : null;
  const finished = state.check.state === 'done' && state.futures.state !== 'active';
  const plan = state.plan.data;

  /* ---------- 05 Ask ---------- */
  if (!running) return <Page width={760} className={styles.askPage}>
    <h1 className={`t-h4 ${styles.askTitle}`}>What should Vallet do?</h1>
    {!policy.active && <EdgeCard where="Home" title="No rules yet" description="Nothing can be checked until you set your rules." action={<Button kind="primary" href="/rules">Set my rules</Button>} tone="attention" />}
    <form className={styles.goalBox} noValidate onSubmit={(e) => { e.preventDefault(); submitGoal(); }} aria-label="Goal">
      <label htmlFor="goal" className="sr-only">What should Vallet do?</label>
      <textarea id="goal" ref={goalRef} rows={2} value={goal} maxLength={2000} className={styles.goalInput} placeholder="Describe a goal in plain words"
        onChange={(e) => { setGoal(e.target.value); setGoalError(''); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submitGoal(); } }}
        aria-invalid={goalError ? true : undefined} aria-describedby={goalError ? 'goal-error' : 'goal-help'} />
      <div className={styles.goalFooter}>
        <span id="goal-help" className="t-body-1 c-low">Plain words are fine.</span>
        <Button type="submit" kind="primary" disabled={!policy.active}>Check it</Button>
      </div>
      {goalError && <p id="goal-error" role="alert" className={styles.fieldError}>{goalError}</p>}
    </form>
    <div className={styles.suggestions}>{SUGGESTIONS.map((s) => <SuggestionChip key={s} onClick={() => { setGoal(s); setGoalError(''); goalRef.current?.focus(); }}>{s}</SuggestionChip>)}</div>
    <p className={styles.askNote}>The AI only suggests. Your rules decide what is safe, and nothing moves without you.</p>
    {!manualOpen
      ? <TextLink onClick={() => setManualOpen(true)}>Or check an exact amount yourself</TextLink>
      : <form className={styles.manual} noValidate onSubmit={(e) => { e.preventDefault(); submitManual(); }} aria-label="Exact amount">
        <Field id="manual-amount" label="Amount (USD)" inputMode="decimal" autoComplete="off" value={manual.amount} error={manualErrors.amount}
          help="Synthetic USD to allocate to the test token." onChange={(e) => { setManual((m) => ({ ...m, amount: e.target.value })); setManualErrors((x) => ({ ...x, amount: undefined })); }} />
        <Disclosure title="Where it goes" meta="Token and recipient" openMeta="Hide" defaultOpen={Boolean(manualErrors.token || manualErrors.recipient)}>
          <div className={styles.manualAddresses}>
            <Field id="manual-token" label="Token address" mono autoComplete="off" spellCheck={false} value={manual.token} error={manualErrors.token} help="Test token contract on Base Sepolia."
              onChange={(e) => { setManual((m) => ({ ...m, token: e.target.value })); setManualErrors((x) => ({ ...x, token: undefined })); }} />
            <Field id="manual-recipient" label="Recipient address" mono autoComplete="off" spellCheck={false} value={manual.recipient} error={manualErrors.recipient} help="Destination for the test allocation."
              onChange={(e) => { setManual((m) => ({ ...m, recipient: e.target.value })); setManualErrors((x) => ({ ...x, recipient: undefined })); }} />
          </div>
        </Disclosure>
        <div className={styles.manualActions}>
          <Button type="submit" kind="secondary" disabled={!policy.active}>Find the largest safe amount</Button>
          <TextLink onClick={() => setManualOpen(false)}>Cancel</TextLink>
        </div>
      </form>}
  </Page>;

  /* ---------- shared: the run steps ---------- */
  const amounts = plan?.candidates.map((c) => formatUsd(c.amount_minor)).join(' · ');
  const steps = <ol className={styles.run} aria-label="What Vallet is doing">
    {state.manual
      ? <RunStep state="done" title="Your exact amount" description={state.goal} />
      : <>
        <RunStep state={stepState(state.intent)} title={state.intent.state === 'active' ? 'Understanding your goal' : state.intent.state === 'failed' ? 'Could not read your goal' : 'Understood your goal'}
          description={state.intent.data ? (obligation ? `Protect ${formatUsd(obligation.amount_minor)} ${obligation.name.toLowerCase()} due in ${obligation.due_day} days, and use as much of the rest as is safe.` : 'Use as much as is safe within your rules.') : state.intent.problem ? 'Could not read the goal; the suggestions below still count.' : undefined} />
        <RunStep state={stepState(state.plan)} title={plan ? (plan.candidates.length === 0 ? 'Proposal generation paused' : `The AI suggested ${plan.candidates.length} amount${plan.candidates.length === 1 ? '' : 's'}`) : 'Asking the AI for suggestions'}
          description={plan ? `${amounts ? `${amounts}. ` : ''}Suggestions only; none of them is trusted.${plan.mode === 'deterministic_demo' ? ` (${MODE_LABEL[plan.mode]})` : ''}` : undefined} />
      </>}
    <RunStep state={state.check.state === 'done' && state.futures.state === 'active' ? 'active' : stepState(state.check)}
      title={`Checking against your rules and ${state.futures.data?.config.path_count.toLocaleString('en-US') ?? 'simulated'} possible futures`}
      description={finished && answer ? `Found the exact limit after ${answer.verifier_calls} independent checks.` : state.check.state === 'active' || state.futures.state === 'active' ? 'This can take a few seconds.' : undefined} />
    <RunStep state={finished ? 'done' : 'todo'} title="Your answer" />
  </ol>;

  const goalBlock = <div className={styles.goalEcho}>
    <p className="t-overline c-low">Your goal</p>
    <p className={styles.goalText}>&ldquo;{state.goal}&rdquo;</p>
  </div>;

  /* ---------- stopped runs (edge states from frame 21) ---------- */
  const problem = state.plan.problem ?? state.check.problem;
  const stopped = (() => {
    if (state.plan.state === 'failed' && state.plan.problem) {
      return <EdgeCard where="Ask" title={isNotImplemented(state.plan.problem) ? 'The AI planner is not available' : 'The AI is not responding'}
        description={<><p>You can still check an exact amount yourself.</p><p className="c-low">{state.plan.problem.message}</p></>}
        action={<Button kind="secondary" onClick={() => { reset(); setManualOpen(true); }}>Enter an amount</Button>} />;
    }
    if (plan && plan.clarification.length > 0) {
      const missingSetup = plan.clarification.includes('Configure an approved demo token and recipient before generating candidates.');
      const policyBlocked = plan.clarification.includes('The configured token or recipient is not permitted by the confirmed policy.');
      const missingPolicy = plan.clarification.includes('Confirm a Financial Constitution before generating investment candidates.');
      if (missingSetup || policyBlocked || missingPolicy) return <EdgeCard where="Setup" tone="attention"
        title={missingSetup ? 'Demo setup is incomplete' : policyBlocked ? 'Your rules block the demo configuration' : 'Confirm your rules first'}
        description={<><p>{missingSetup ? 'The local companion needs a configured demo token and recipient. Changing your question will not fix this.' : policyBlocked ? 'Review the allowed token and blocked recipient rules. A saved draft does not apply until you confirm it.' : 'Review and explicitly confirm your rules before generating proposals.'}</p><p>Nothing was checked, approved or sent.</p><ul>{plan.clarification.map((c) => <li key={c}>{c}</li>)}</ul></>}
        action={<Button kind="secondary" href={missingSetup ? '/settings' : '/rules'}>{missingSetup ? 'Check setup' : 'Review rules'}</Button>} />;
      return <EdgeCard where="Ask" tone="attention" title="The AI needs one detail" description={<ul>{plan.clarification.map((c) => <li key={c}>&ldquo;{c}&rdquo;</li>)}</ul>}
        action={<Button kind="secondary" onClick={() => { reset(); setTimeout(() => goalRef.current?.focus(), 0); }}>Answer</Button>} />;
    }
    if (plan && plan.candidates.length === 0) {
      return <EdgeCard where="Ask" title="The AI suggested nothing" description="Nothing was checked. You can check an exact amount yourself." action={<Button kind="secondary" onClick={() => { reset(); setManualOpen(true); }}>Enter an amount</Button>} />;
    }
    if (state.check.state === 'failed' && state.check.problem) {
      const p = state.check.problem;
      return <EdgeCard where="Answer" tone="danger" title={/Constitution/i.test(p.message) ? 'No rules yet' : 'The check could not finish'}
        description={<><p>{p.message}</p>{p.reasons.length > 0 && <ul>{p.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}<p>Nothing was approved or sent.</p></>}
        action={<Button kind="secondary" onClick={() => reset()}>Start again</Button>} />;
    }
    return null;
  })();

  /* ---------- 06 Checking ---------- */
  if (!finished || stopped) return <Page width={760} className={styles.runPage}>
    {goalBlock}
    {steps}
    {stopped ?? <p className="t-body-1 c-low">Nothing moves until you approve.</p>}
    {problem && !stopped && <p role="alert" className="t-body-1 c-danger">{problem.message}</p>}
  </Page>;

  /* ---------- 07 Answer ---------- */
  const run = state.futures.data ?? null;
  const pathCount = run?.config.path_count.toLocaleString('en-US') ?? 'simulated';
  return <Page width={760} className={styles.runPage}>
    {goalBlock}
    <div className={styles.checked}>
      <Status>Checked against your rules and {pathCount} futures</Status>
      <TextLink onClick={() => setShowSteps((s) => !s)}>{showSteps ? 'Hide steps' : 'Show steps'}</TextLink>
    </div>
    {showSteps && steps}

    {safe ? <section className={styles.answer} aria-label="Safe amount" data-testid="optimizer-result">
      <p className="t-overline c-med">The most you can safely invest</p>
      <p className={styles.hero} data-testid="safe-amount">{formatUsd(safe.max_amount_minor)}</p>
      <p className={styles.heroSentence}>{limitSentence(safe, rules)}</p>
      {run && <div className={styles.facts}>{facts(run, rules, capitalise(obligation?.name ?? 'Tuition')).map((f) => <Status key={f.text} state={f.ok ? 'pass' : 'fail'}>{f.text}</Status>)}</div>}
      {state.futures.state === 'failed' && <Status state="attention">The futures for this amount could not be simulated: {state.futures.problem?.message}</Status>}
      {state.verify.state === 'failed' && state.verify.problem && <EdgeCard where="Approve" tone="danger" title="The checker could not sign it" description={state.verify.problem.message} />}
      {state.verify.data && !state.verify.data.certificate_id && <EdgeCard where="Answer" tone="danger" title="The checker refused"
        description={<><p>Your rules failed, so there is no certificate and nothing to approve.</p>{state.verify.data.reasons.length > 0 && <ul>{state.verify.data.reasons.map((r) => <li key={r}>{reasonText(r, rules)}</li>)}</ul>}</>} />}
      <div className={styles.answerActions}>
        <Button kind="primary" size="xl" rightIcon="arrow-right" busy={state.verify.state === 'active'} disabled={state.verify.state === 'done'} onClick={() => void continueWith()}>
          {state.verify.state === 'active' ? 'Getting it signed…' : `Continue with ${formatUsd(safe.max_amount_minor)}`}
        </Button>
        {run && <TextLink onClick={() => setFuturesOpen(true)}>See the futures</TextLink>}
      </div>
    </section> : answer && <section className={styles.answer} aria-label="Safe amount" data-testid="optimizer-result">
      <EdgeCard where="Answer" tone="attention" role="status" title={answer.status === 'NO_SAFE_ACTION' ? 'Nothing is safe right now' : 'No single safe limit'}
        description={limitSentence(answer, rules)} action={<Button kind="secondary" href="/rules">See which rule</Button>} />
    </section>}

    <Divider />
    <div className={styles.details}>
      {!state.manual && plan && plan.candidates.length > 0 && safe && <Disclosure title={`The AI suggested ${plan.candidates.map((c) => formatUsd(c.amount_minor)).join(', ').replace(/, ([^,]*)$/, ' and $1')}`} meta="Why not?">
        <ul className={styles.why}>{plan.candidates.map((c) => <li key={c.id}><strong>{formatUsd(c.amount_minor)}</strong> {`is an untrusted proposal. The checked limit applies only to the exact action shown above.`}<span>Planner says (untrusted): &ldquo;{c.planner_reason_untrusted}&rdquo;</span></li>)}</ul>
      </Disclosure>}
      {answer && <Disclosure title="How the exact limit was found">
        <p>Vallet tested amounts one at a time against every rule and the simulated futures, {answer.verifier_calls} independent checks in total.{safe ? ` ${formatUsd(safe.max_amount_minor)} passes everything; ${formatUsd(safe.max_amount_minor + 1)} fails${safe.limiting_checks.length ? `: ${safe.limiting_checks.map((c) => reasonText(c, rules)).join('; ')}` : ''}.` : ''}</p>
      </Disclosure>}
      <Disclosure title="What &quot;safe&quot; means: simulated under stated assumptions, not a prediction" meta="Assumptions">
        <p>Safe means every rule passes and the simulated futures meet your thresholds{run ? `, using ${pathCount} seeded futures over ${run.config.horizon_days} days (seed ${run.config.seed})` : ''}. It is not a forecast or a guarantee.</p>
        {run && run.config.model_assumptions.length > 0 && <ul>{run.config.model_assumptions.map((a) => <li key={a}>{a}</li>)}</ul>}
      </Disclosure>
    </div>
    <TextLink onClick={() => { reset(); setManualOpen(false); }}>Ask something else</TextLink>
    <FuturesDrawer open={futuresOpen} onClose={() => setFuturesOpen(false)} run={run} rules={rules} amountMinor={safe?.max_amount_minor ?? null} />
  </Page>;
}
