'use client';
import type { CSSProperties } from 'react';
import { formatUsd, formatUtc } from '@/lib/format';
import type { components } from '@/lib/schema';
import { bpsToPercent } from '@/lib/units';
import { Icon } from '@/ui/Icon';
import { Disclosure, KeyValue, KeyValueList, Status } from '@/ui/kit';
import { Drawer } from '@/ui/overlay';
import { stressRows, type SimulationRun } from './explain';
import styles from './ask.module.css';

type Rules = components['schemas']['ConstitutionRules'];
const pct = (bps: number) => `${bpsToPercent(bps)}%`;

const W = 528, H = 240, PAD = 14;

/** Sampled futures as lines, the range they span as a band, and the emergency floor. Geometry only; values come from the run. */
function FuturesChart({ run, floorMinor }: { run: SimulationRun; floorMinor: number | null }) {
  const paths = run.sampled_liquidity_paths_minor.filter((p) => p.length > 1);
  if (!paths.length) return <p className="t-body-1 c-med">The simulation returned no sampled paths to draw.</p>;
  const days = Math.max(...paths.map((p) => p.length)) - 1;
  const values = paths.flat().concat(floorMinor ?? []);
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min -= 100; max += 100; }
  const x = (d: number) => PAD + (d / days) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2);
  const low: number[] = [], high: number[] = [];
  for (let d = 0; d <= days; d++) {
    const at = paths.map((p) => p[Math.min(d, p.length - 1)]);
    low.push(Math.min(...at)); high.push(Math.max(...at));
  }
  const band = [...high.map((v, d) => `${x(d)},${y(v)}`), ...low.map((v, d) => `${x(d)},${y(v)}`).reverse()].join(' ');
  const lowest = Math.min(...low);
  const summary = `${paths.length} sampled futures over ${days} days. Cash ranges from ${formatUsd(min)} to ${formatUsd(max)}${floorMinor !== null ? `; the floor is ${formatUsd(floorMinor)}` : ''}.`;
  return <figure className={styles.chart}>
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Futures chart. ${summary}`} preserveAspectRatio="none">
      <polygon points={band} className={styles.band} />
      {floorMinor !== null && <g><line x1={PAD} x2={W - PAD} y1={y(floorMinor)} y2={y(floorMinor)} className={styles.floor} />
        <text x={W - PAD} y={y(floorMinor) - 6} textAnchor="end" className={styles.floorLabel}>Floor {formatUsd(floorMinor)}</text></g>}
      {paths.map((p, i) => <polyline key={i} points={p.map((v, d) => `${x(d)},${y(v)}`).join(' ')} className={styles.path} pathLength={1}
        style={{ '--d': `${i * 30}ms` } as CSSProperties} data-testid="liquidity-path" />)}
    </svg>
    <figcaption className="sr-only">{summary} Lowest sampled cash {formatUsd(lowest)}.</figcaption>
  </figure>;
}

/** Figma "Threshold metric" (121:310): one simulated number against the rule that limits it. */
function Threshold({ label, value, rule, meets, testId }: { label: string; value: string; rule: string; meets: boolean | null; testId: string }) {
  return <div className={`${styles.threshold} ${meets === false ? styles.thresholdBelow : ''}`}>
    <span className={styles.thresholdLabel}>{label}</span>
    <strong className={styles.thresholdValue} data-testid={testId}>{value}</strong>
    <span className={styles.thresholdRule}>{rule}</span>
    {meets !== null && <Status state={meets ? 'pass' : 'fail'}>{meets ? 'Meets it' : 'Below it'}</Status>}
  </div>;
}

type Props = { open: boolean; onClose: () => void; run: SimulationRun | null; rules: Rules | null; amountMinor: number | null };

/** Figma "08 Futures": the Time Machine as a drawer. Simulated under stated assumptions, not a prediction. */
export function FuturesDrawer({ open, onClose, run, rules, amountMinor }: Props) {
  const m = run?.metrics;
  const floor = rules?.emergency_floor_minor ?? null;
  const lowest = run ? Math.min(...run.sampled_liquidity_paths_minor.flat()) : null;
  return <Drawer open={open} onClose={onClose} title={amountMinor !== null ? `Your ${run?.config.path_count.toLocaleString('en-US') ?? ''} futures with ${formatUsd(amountMinor)} invested` : 'Your futures'}>
    {!run || !m ? <p className="t-body-2 c-med">The simulation for this amount is not available.</p> : <section className={styles.futures} aria-label="Simulation result">
      <p className="t-body-2 c-med">Each line is one possible future of your cash over the next {run.config.horizon_days} days.{floor !== null && lowest !== null ? (lowest >= floor ? ` None of them drops below your ${formatUsd(floor)} floor.` : ` Some drop below your ${formatUsd(floor)} floor.`) : ''}</p>
      <FuturesChart run={run} floorMinor={floor} />

      <p className="t-overline c-low">Against your rules</p>
      <div className={styles.thresholds}>
        <Threshold label="Tuition paid" testId="metric-goal" value={pct(m.goal_satisfaction_probability_bps)} rule={rules ? `Rule: at least ${pct(rules.goal_satisfaction_min_bps)}` : 'No active rule'} meets={rules ? m.goal_satisfaction_probability_bps >= rules.goal_satisfaction_min_bps : null} />
        <Threshold label="Floor broken" testId="metric-breach" value={pct(m.reserve_breach_probability_bps)} rule={rules ? `Rule: at most ${pct(rules.reserve_breach_max_bps)}` : 'No active rule'} meets={rules ? m.reserve_breach_probability_bps <= rules.reserve_breach_max_bps : null} />
        <Threshold label="Worst 5% left" testId="metric-p05" value={formatUsd(m.p05_terminal_liquidity_minor)} rule={floor !== null ? `Floor: ${formatUsd(floor)}` : 'No floor set'} meets={floor !== null ? m.p05_terminal_liquidity_minor >= floor : null} />
        <Threshold label="Average left" testId="metric-expected" value={formatUsd(m.expected_terminal_value_minor)} rule="No rule; context only" meets={null} />
      </div>

      <p className="t-overline c-low">Bad-luck tests</p>
      <KeyValueList label="Named stress tests">
        {stressRows(run).map((s) => <KeyValue key={s.key} label={s.label}
          value={<span className={s.passed ? styles.stressPass : styles.stressFail}><Icon name={s.passed ? 'check' : 'cross'} size={16} />{formatUsd(s.lowest)} lowest</span>} />)}
      </KeyValueList>

      <Disclosure title={`Assumptions · seed ${run.config.seed} · same inputs, same result`}>
        <KeyValueList label="Simulation assumptions">
          <KeyValue label="Model" value={run.config.model_version} />
          <KeyValue label="Sampled futures" value={run.config.path_count.toLocaleString('en-US')} />
          <KeyValue label="Horizon" value={`${run.config.horizon_days} days`} />
          <KeyValue label="Daily volatility" value={pct(run.config.daily_volatility_bps)} />
          <KeyValue label="Chance of an extra emergency" value={`${pct(run.config.emergency_probability_bps)} · ${formatUsd(run.config.emergency_expense_minor)}`} />
          <KeyValue label="Income delay probability" value={pct(run.config.income_delay_probability_bps)} />
          <KeyValue label="Fee per action" value={formatUsd(run.config.fee_minor)} />
          <KeyValue label="Random seed" value={<span data-testid="config-seed">{run.config.seed}</span>} />
          <KeyValue label="Config fingerprint" mono value={<span title={run.config_digest}>{run.config_digest.slice(0, 12)}…</span>} />
          <KeyValue label="Run" mono value={`${run.id.slice(0, 18)}… · ${formatUtc(run.created_at)}`} />
        </KeyValueList>
        {run.config.model_assumptions.length > 0 && <ul className={styles.assumptions}>{run.config.model_assumptions.map((a) => <li key={a}>{a}</li>)}</ul>}
        <p>Seeded scenario arithmetic, not a prediction. It does not verify, approve or send anything.</p>
      </Disclosure>
    </section>}
  </Drawer>;
}
