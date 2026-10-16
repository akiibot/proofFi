import { formatUsd, formatUtc } from '@/lib/format';
import type { FinancialState } from './use-dashboard-data';

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

/** Everything here is read from the persisted snapshot. Nothing is estimated, scored or approved in the browser. */
export function Overview({ state }: { state: FinancialState }) {
  const { snapshot } = state;
  const assets = sum(snapshot.assets.map((a) => a.amount_minor));
  const liquid = sum(snapshot.assets.filter((a) => a.liquid).map((a) => a.amount_minor));
  const highRisk = sum(snapshot.assets.filter((a) => a.high_risk).map((a) => a.amount_minor));
  const protectedObligations = snapshot.obligations.filter((o) => o.protected);
  const expenses = snapshot.recurring_expenses;

  return <>
    <section className="cards" aria-label="Financial state">
      <article>
        <h3>Total synthetic assets</h3>
        <strong>{formatUsd(assets)}</strong>
        <small>{snapshot.assets.length ? `Liquid ${formatUsd(liquid)} · High risk ${formatUsd(highRisk)}` : 'No balances in this snapshot.'}</small>
      </article>
      <article>
        <h3>Protected obligations</h3>
        <strong>{formatUsd(sum(protectedObligations.map((o) => o.amount_minor)))}</strong>
        <small>{protectedObligations.length ? protectedObligations.map((o) => `${o.name} · due on simulation day ${o.due_day}`).join(' · ') : 'No protected obligations in this snapshot.'}</small>
      </article>
      <article>
        <h3>Recurring expenses</h3>
        <strong>{formatUsd(sum(expenses.map((e) => e.amount_minor)))}</strong>
        <small>{expenses.length ? expenses.map((e) => `${e.name} · ${e.due_days.length} scheduled payments`).join(' · ') : 'No recurring expenses in this snapshot.'}</small>
      </article>
    </section>

    <section className="panels">
      <article>
        <p className="eyebrow">PRIMARY GOAL</p>
        <h2>{snapshot.goal.text}</h2>
        {state.active_constitution_version
          ? <p>Active Constitution: <b>{state.active_constitution_version}</b> · <a href="/constitution">Review rules</a></p>
          : <p className="notice">No Constitution is active yet. A draft must be confirmed before any action can be verified. <a href="/constitution">Set up your Constitution</a></p>}
      </article>
      <article>
        <p className="eyebrow">VISIBLE ASSUMPTIONS</p>
        <h2>Start with the full picture</h2>
        {snapshot.assumptions.length
          ? <ul>{snapshot.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
          : <p>This snapshot lists no assumptions.</p>}
      </article>
    </section>

    <section className="integrity" aria-label="State integrity">
      <h2>State integrity</h2>
      <p>Read from the persisted backend database. Version {snapshot.version}, as of {formatUtc(snapshot.as_of)}.</p>
      <code>{state.snapshot_hash}</code>
    </section>
  </>;
}
