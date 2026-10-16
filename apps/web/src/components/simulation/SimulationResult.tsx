import type { components } from '@/lib/schema';
import { formatUsd, formatUtc } from '@/lib/format';
import { bpsToPercent } from '@/lib/units';
import { buildChart } from './chart';

export type SimulationRun = components['schemas']['SimulationRun'];
type Rules = components['schemas']['ConstitutionRules'];

const STRESS_LABEL: Record<string, string> = {
  market_shock: 'Market shock', income_delay: 'Income delay', emergency_expense: 'Emergency expense', fee_shock: 'Fee shock',
};

const pct = (bps: number) => `${bpsToPercent(bps)}%`;

function parameterText(key: string, value: number | string): string {
  const label = key.replace(/_/g, ' ');
  if (typeof value === 'number' && key.endsWith('_minor')) return `${label.replace(/ minor$/, '')}: ${formatUsd(value)}`;
  if (typeof value === 'number' && key.endsWith('_bps')) return `${label.replace(/ bps$/, '')}: ${pct(value)}`;
  return `${label}: ${value}`;
}

export function LiquidityChart({ run }: { run: SimulationRun }) {
  const chart = buildChart(run.sampled_liquidity_paths_minor);
  if (!chart) return <p>The simulation returned no sampled paths to draw.</p>;
  const { width, height, padding } = chart;
  const summary = `${run.sampled_liquidity_paths_minor.length} sampled futures over ${chart.days} days. Liquidity ranges from ${formatUsd(chart.min)} to ${formatUsd(chart.max)}.`;
  return <figure className="chart">
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Liquidity paths chart. ${summary}`}>
      {chart.yTicks.map((t) => <g key={`y${t.value}`}>
        <line x1={padding.left} x2={width - padding.right} y1={t.y} y2={t.y} className="grid" />
        <text x={padding.left - 8} y={t.y + 4} textAnchor="end" className="tick">{formatUsd(t.value)}</text>
      </g>)}
      {chart.xTicks.map((t) => <text key={`x${t.day}`} x={t.x} y={height - 8} textAnchor="middle" className="tick">day {t.day}</text>)}
      {chart.zeroY !== null && <line x1={padding.left} x2={width - padding.right} y1={chart.zeroY} y2={chart.zeroY} className="zero" />}
      {chart.lines.map((points, i) => <polyline key={i} points={points} className="path" data-testid="liquidity-path" />)}
    </svg>
    <figcaption>{summary} Each line is one sampled future from the seeded model, not a forecast.</figcaption>
  </figure>;
}

/** Everything shown comes from the SimulationRun. Thresholds from the active Constitution are shown next to it for comparison only. */
export function SimulationResult({ run, rules }: { run: SimulationRun; rules: Rules | null }) {
  const m = run.metrics;
  const goalMeets = rules ? m.goal_satisfaction_probability_bps >= rules.goal_satisfaction_min_bps : null;
  const breachMeets = rules ? m.reserve_breach_probability_bps <= rules.reserve_breach_max_bps : null;
  const c = run.config;
  return <section className="simulation" aria-label="Simulation result">
    <h2>Simulated futures</h2>
    <p>Run <code>{run.id}</code> at {formatUtc(run.created_at)} for candidate <code>{run.action_id}</code>.</p>
    <p className="notice">This is seeded scenario arithmetic, not a prediction. It does not verify, approve or execute anything; verification is a separate step.</p>

    <div className="cards metrics">
      <article><h3>Goal satisfaction probability</h3><strong data-testid="metric-goal">{pct(m.goal_satisfaction_probability_bps)}</strong>
        <small>{rules ? `Constitution asks for at least ${pct(rules.goal_satisfaction_min_bps)} · ${goalMeets ? 'meets it' : 'below it'}` : 'No active Constitution to compare with'}</small></article>
      <article><h3>Reserve breach probability</h3><strong data-testid="metric-breach">{pct(m.reserve_breach_probability_bps)}</strong>
        <small>{rules ? `Constitution allows at most ${pct(rules.reserve_breach_max_bps)} · ${breachMeets ? 'within it' : 'above it'}` : 'No active Constitution to compare with'}</small></article>
      <article><h3>5th percentile final liquidity</h3><strong data-testid="metric-p05">{formatUsd(m.p05_terminal_liquidity_minor)}</strong>
        <small>In 95% of sampled futures, final liquidity is at least this.</small></article>
      <article><h3>Expected final value</h3><strong data-testid="metric-expected">{formatUsd(m.expected_terminal_value_minor)}</strong>
        <small>Average across all sampled futures.</small></article>
    </div>

    <LiquidityChart run={run} />

    <h3 className="section-label">Named stress tests</h3>
    <div className="table-scroll"><table aria-label="Named stress tests">
      <thead><tr><th scope="col">Stress</th><th scope="col">Result</th><th scope="col">Goal funded</th><th scope="col">Lowest liquidity</th><th scope="col">Parameters</th></tr></thead>
      <tbody>{run.stress_results.map((s) => <tr key={s.name}>
        <th scope="row">{STRESS_LABEL[s.name] ?? s.name}</th>
        <td><span className={`pill ${s.passed ? 'pill-ready' : 'pill-unavailable'}`}>{s.passed ? 'Passed' : 'Failed'}</span></td>
        <td>{s.goal_funded ? 'Yes' : 'No'}</td>
        <td>{formatUsd(s.minimum_liquidity_minor)}</td>
        <td>{Object.entries(s.parameters).map(([k, v]) => parameterText(k, v)).join(' · ') || 'None'}</td>
      </tr>)}</tbody>
    </table></div>

    <h3 className="section-label">Assumptions behind this run</h3>
    <dl className="rule-list" aria-label="Simulation assumptions">
      <div><dt>Model</dt><dd>{c.model_version}</dd></div>
      <div><dt>Sampled futures</dt><dd>{c.path_count}</dd></div>
      <div><dt>Horizon</dt><dd>{c.horizon_days} days</dd></div>
      <div><dt>Random seed</dt><dd data-testid="config-seed">{c.seed}</dd></div>
      <div><dt>Daily volatility</dt><dd>{pct(c.daily_volatility_bps)}</dd></div>
      <div><dt>Income delay probability</dt><dd>{pct(c.income_delay_probability_bps)}</dd></div>
      <div><dt>Emergency probability</dt><dd>{pct(c.emergency_probability_bps)}</dd></div>
      <div><dt>Emergency expense</dt><dd>{formatUsd(c.emergency_expense_minor)}</dd></div>
      <div><dt>Fee per action</dt><dd>{formatUsd(c.fee_minor)}</dd></div>
      <div><dt>Config</dt><dd><code title={run.config_digest}>{c.id}</code></dd></div>
    </dl>
    {c.model_assumptions.length > 0 && <ul className="assumptions">{c.model_assumptions.map((a) => <li key={a}>{a}</li>)}</ul>}
    <p className="hint">State snapshot <code>{run.state_snapshot_hash}</code> · config fingerprint <code>{run.config_digest}</code>. The same seed, state and action always give the same result.</p>
  </section>;
}
