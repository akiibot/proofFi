'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatUsd } from '@/lib/format';
import { minorToInput, bpsToPercent } from '@/lib/units';
import { useActivePolicy } from '@/lib/use-active-policy';
import { stressRows } from '@/screens/ask/explain';
import { FuturesDrawer } from '@/screens/ask/FuturesDrawer';
import { Page } from '@/shell/AppFrame';
import { useApp } from '@/shell/AppContext';
import { Tour } from '@/tour/Tour';
import { SIMULATE_INTRO, SIMULATE_TOUR, SIMULATE_TOUR_KEY, tourSeen, tourTarget, type TourStep } from '@/tour/steps';
import { Button, TextLink } from '@/ui/Button';
import { SuggestionChip } from '@/ui/form';
import { Icon } from '@/ui/Icon';
import { EdgeCard, PageHeader, Skeleton } from '@/ui/kit';
import { cx } from '@/ui/cx';
import { SimulationStage, type StageMode } from './SimulationStage';
import { amountFrom, useSimulation, type Simulation } from './useSimulation';
import styles from './simulate.module.css';

/** Each one carries an amount, so tapping it runs a real simulation straight away. */
const SUGGESTIONS = ['Invest $1,000', 'Invest $2,000', 'Invest $5,000'];
const pct = (bps: number) => `${bpsToPercent(bps)}%`;

function useElapsed(start: number | null, end: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!start || end) return; const t = window.setInterval(() => setNow(Date.now()), 100); return () => window.clearInterval(t); }, [start, end]);
  return start ? ((end ?? now) - start) / 1000 : 0;
}

/** What the status line says while a run is in progress, by elapsed time. */
function stageText(seconds: number, amount: string | null) {
  if (seconds < 4) return `Reading ${amount ?? 'the amount'} against your rules`;
  if (seconds < 11) return 'Drawing 1,000 possible futures of your cash over 120 days';
  if (seconds < 18) return 'Running the four bad-luck tests on every future';
  return 'Checking how the futures fare against your emergency floor';
}

/** The single status line under the stage, updated as each real step starts and finishes. */
function RunLine({ state, seconds }: { state: Simulation; seconds: number }) {
  const amount = state.amountMinor !== null ? formatUsd(state.amountMinor) : null;
  const r = state.result;
  const passed = r ? stressRows(r).filter((s) => s.passed).length : 0;
  const line = {
    idle: { icon: 'dot', text: 'Ready. A simulation only shows what could happen; nothing is approved or sent.' },
    reading: { icon: 'spin', text: 'Reading your question and asking the AI for an amount to test' },
    simulating: { icon: 'spin', text: stageText(seconds, amount) },
    done: { icon: 'check', text: r ? `Done · ${r.config.path_count.toLocaleString('en-US')} futures over ${r.config.horizon_days} days · ${passed} of ${r.stress_results.length} bad-luck tests passed` : 'Done' },
    failed: { icon: 'cross', text: state.problem ?? 'The simulation could not run.' },
    clarify: { icon: 'info', text: `The AI needs one detail: ${state.clarification.join(' ')}` },
  }[state.phase];
  const active = state.phase === 'reading' || state.phase === 'simulating';
  return <div className={cx(styles.runLine, styles[`line_${state.phase}`])} role="status" aria-live="polite" data-testid="sim-status" data-tour="sim-status">
    <span className={styles.lineIcon} aria-hidden>
      {line.icon === 'spin' ? <span className={styles.spinner} /> : line.icon === 'dot' ? <span className={styles.idleDot} /> : <Icon name={line.icon as 'check' | 'cross' | 'info'} size={16} />}
    </span>
    <span className={cx(styles.lineText, active && styles.shimmer)}>{line.text}</span>
    {state.startedAt && <span className={styles.lineTime}>{seconds.toFixed(1)}s</span>}
  </div>;
}

/**
 * Simulate: play out a decision before making it. A typed amount (or one the AI suggests) is simulated across seeded
 * futures of the person's cash and compared with their rules. Nothing is verified, approved or sent from here.
 */
export function SimulateScreen() {
  const { policy, error: loadError, reload } = useActivePolicy();
  const rules = policy?.active?.rules ?? null;
  const { state, start } = useSimulation(rules);
  const [text, setText] = useState('');
  const [inputError, setInputError] = useState('');
  const [details, setDetails] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const seconds = useElapsed(state.startedAt, state.finishedAt);
  const { tourPending, clearTourPending } = useApp();

  // This page's own short tour: once on the first visit (never under browser automation), or again from the account menu.
  const [tourSteps, setTourSteps] = useState<TourStep[] | null>(null);
  const startTour = useCallback(() => { const steps = SIMULATE_TOUR.filter((t) => tourTarget(t.target)); if (steps.length) setTourSteps(steps); }, []);
  const loaded = Boolean(policy);
  useEffect(() => {
    if (!loaded || tourSeen(SIMULATE_TOUR_KEY) || navigator.webdriver) return;
    const timer = window.setTimeout(startTour, 900);
    return () => window.clearTimeout(timer);
  }, [loaded, startTour]);
  useEffect(() => {
    if (!loaded || !tourPending) return;
    const timer = window.setTimeout(() => { clearTourPending(); startTour(); }, 300);
    return () => window.clearTimeout(timer);
  }, [loaded, tourPending, clearTourPending, startTour]);

  const obligation = useMemo(() => policy?.state.snapshot.obligations.find((o) => o.protected) ?? null, [policy]);
  const typed = amountFrom(text);
  const busy = state.phase === 'reading' || state.phase === 'simulating';
  const mode: StageMode = busy ? 'running' : state.phase === 'done' ? 'result' : 'idle';
  const run = state.result;
  const floor = rules?.emergency_floor_minor ?? null;

  function submit(value = text) {
    const t = value.trim();
    if (!t) { setInputError('Describe what you want to test, for example “What if I invest $2,000?”.'); inputRef.current?.focus(); return; }
    if (t.length > 2000) { setInputError('Keep it under 2000 characters.'); return; }
    setInputError(''); void start(t);
  }

  if (loadError) return <Page width={1040}><EdgeCard where="Simulate" title="Your money and rules could not be loaded" description={loadError} action={<Button kind="secondary" onClick={() => void reload()}>Try again</Button>} /></Page>;
  if (!policy) return <Page width={1040}><div className={styles.loading} role="status" aria-label="Loading"><Skeleton width="40%" height={44} radius={12} /><Skeleton width="70%" height={20} /><Skeleton height={420} radius={24} /></div></Page>;

  const m = run?.metrics;
  const stress = run ? stressRows(run) : [];
  const stageLabel = mode === 'result' && run && state.amountMinor !== null
    ? `Simulation of ${formatUsd(state.amountMinor)}: ${run.sampled_liquidity_paths_minor.length} sampled futures of your cash over ${run.config.horizon_days} days${floor !== null ? `, against your ${formatUsd(floor)} emergency floor` : ''}.`
    : mode === 'running' ? 'Simulation running.' : 'No simulation running.';

  return <Page width={1040} className={styles.page}>
    <PageHeader eyebrow="Simulate" title="Play out a decision before you make it." size="md"
      subtitle="Describe a move, like investing $2,000. Vallet runs it through 1,000 possible futures of your money and four bad-luck tests, then shows how often your tuition and emergency floor survive. Nothing is approved or sent from here." />

    <div className={styles.stageWrap} data-tour="sim-stage">
      <SimulationStage mode={mode} run={run} floorMinor={floor} dueDay={obligation?.due_day ?? null}
        dueLabel={obligation ? `${obligation.name} due` : null} label={stageLabel}>
        <div className={styles.hudTop}>
          <span className={cx(styles.pill, styles[`pill_${mode}`])}><i aria-hidden />{mode === 'running' ? 'Simulating' : mode === 'result' ? 'Result' : 'Idle'}</span>
          {mode === 'result' && state.amountMinor !== null && <span className={styles.hudText}>
            Testing <strong>{formatUsd(state.amountMinor)}</strong> · {state.source === 'ai' ? 'suggested by the AI, untrusted' : 'from your question'}</span>}
          {mode === 'result' && run && <span className={cx(styles.hudText, styles.hudRight)}>
            {run.sampled_liquidity_paths_minor.length} of {run.config.path_count.toLocaleString('en-US')} futures drawn · seed {run.config.seed}</span>}
        </div>
        {mode === 'idle' && <div className={styles.empty}>
          <span className={styles.emptyIcon} aria-hidden><Icon name="chart" size={20} /></span>
          <p className={styles.emptyTitle}>No simulation running</p>
          <p className={styles.emptyText}>Type a decision below, or tap an example. Your possible futures will play out here, against your emergency floor and the day your {obligation?.name.toLowerCase() ?? 'obligation'} is due.</p>
        </div>}
        {mode === 'result' && <div className={styles.legend} aria-hidden>
          <span><i className={styles.keyPath} />One sampled future</span>
          <span><i className={styles.keyBand} />Range of all drawn futures</span>
          {floor !== null && <span><i className={styles.keyFloor} />Emergency floor</span>}
          <span><i className={styles.keyBroke} />Breaks the floor</span>
        </div>}
      </SimulationStage>

      {mode === 'result' && run && m && <div className={styles.results} data-testid="sim-results">
        <Metric label="Tuition paid" value={pct(m.goal_satisfaction_probability_bps)} rule={rules ? `Rule: at least ${pct(rules.goal_satisfaction_min_bps)}` : 'No rule'} ok={rules ? m.goal_satisfaction_probability_bps >= rules.goal_satisfaction_min_bps : null} />
        <Metric label="Floor broken" value={pct(m.reserve_breach_probability_bps)} rule={rules ? `Rule: at most ${pct(rules.reserve_breach_max_bps)}` : 'No rule'} ok={rules ? m.reserve_breach_probability_bps <= rules.reserve_breach_max_bps : null} />
        <Metric label="Worst 5% left" value={formatUsd(m.p05_terminal_liquidity_minor)} rule={floor !== null ? `Floor: ${formatUsd(floor)}` : 'No floor'} ok={floor !== null ? m.p05_terminal_liquidity_minor >= floor : null} />
        <Metric label="Bad-luck tests" value={`${stress.filter((s) => s.passed).length} of ${stress.length}`} rule="Each must pass" ok={stress.every((s) => s.passed)} />
        <div className={styles.resultActions}>
          <TextLink onClick={() => setDetails(true)}>All details</TextLink>
          {state.amountMinor !== null && <Button kind="secondary" size="sm" href={`/ask?amount=${minorToInput(state.amountMinor)}`} rightIcon="arrow-right">Check it on Ask</Button>}
        </div>
      </div>}
    </div>

    <RunLine state={state} seconds={seconds} />

    {!policy.active && <EdgeCard where="Simulate" title="No rules yet" description="A simulation is measured against your rules. Set them first." action={<Button kind="primary" href="/rules">Set my rules</Button>} tone="attention" />}

    <form className={styles.composer} data-tour="sim-composer" noValidate onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label="Simulate">
      <label htmlFor="simulate-input" className="sr-only">What do you want to test?</label>
      <textarea id="simulate-input" ref={inputRef} rows={1} value={text} maxLength={2000} className={styles.input}
        placeholder="What do you want to test? For example: What if I invest $2,000?"
        onChange={(e) => { setText(e.target.value); setInputError(''); }}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
        aria-invalid={inputError ? true : undefined} aria-describedby={inputError ? 'simulate-error' : 'simulate-help'} />
      <div className={styles.composerFooter}>
        <span id="simulate-help" className={styles.hint}>
          {typed !== null ? <><Icon name="check" size={14} />Testing an investment of {formatUsd(typed)}</> : 'No amount in your question? The AI suggests one, and it stays untrusted.'}
        </span>
        <Button type="submit" kind="primary" leftIcon="chart" busy={busy} disabled={!policy.active}>{busy ? 'Simulating' : 'Run simulation'}</Button>
      </div>
      {inputError && <p id="simulate-error" role="alert" className={styles.error}>{inputError}</p>}
    </form>
    <div className={styles.suggestions} data-tour="sim-suggestions">
      {SUGGESTIONS.map((s) => <SuggestionChip key={s} disabled={busy} onClick={() => { setText(s); setInputError(''); submit(s); }}>{s}</SuggestionChip>)}
    </div>

    {tourSteps && <Tour steps={tourSteps} storageKey={SIMULATE_TOUR_KEY} intro={SIMULATE_INTRO} onClose={() => setTourSteps(null)} />}
    <FuturesDrawer open={details} onClose={() => setDetails(false)} run={run} rules={rules} amountMinor={state.amountMinor} />
  </Page>;
}

function Metric({ label, value, rule, ok }: { label: string; value: string; rule: string; ok: boolean | null }) {
  return <div className={cx(styles.metric, ok === false && styles.metricBad)}>
    <span className={styles.metricLabel}>{label}</span>
    <strong className={styles.metricValue}>{value}</strong>
    <span className={styles.metricRule}>{ok !== null && <Icon name={ok ? 'check' : 'cross'} size={12} />}{rule}</span>
  </div>;
}
