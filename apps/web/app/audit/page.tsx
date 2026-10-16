'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatUtc } from '@/lib/format';
import { run } from '@/lib/request';
import { AppShell } from '@/components/shell/AppShell';
import { eventLabel, verifyChain, type AuditEvent, type ChainCheck } from '@/components/audit/chain';

function DetailList({ details }: { details: AuditEvent['details'] }) {
  const entries = Object.entries(details);
  if (!entries.length) return <>None</>;
  return <ul className="details">{entries.map(([k, v]) => {
    const certificate = k === 'certificate_id' && typeof v === 'string';
    return <li key={k}><span>{k.replace(/_/g, ' ')}:</span> {certificate ? <a href={`/certificates?id=${encodeURIComponent(v)}`}><code>{v}</code></a> : /\s/.test(String(v)) ? <span className="prose">{String(v)}</span> : <code>{String(v)}</code>}</li>;
  })}</ul>;
}

export default function AuditPage() {
  const router = useRouter();
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [error, setError] = useState('');
  const [check, setCheck] = useState<ChainCheck | null>(null);
  const [type, setType] = useState('all');

  const load = useCallback(async () => {
    setError(''); setCheck(null);
    const outcome = await run(() => api.GET('/audit'));
    if (!outcome.ok) { if (outcome.expired) { router.replace('/login'); return; } setError(outcome.problem.message); return; }
    setEvents(outcome.data);
    try { setCheck(await verifyChain(outcome.data)); }
    catch { setCheck({ ok: false, checked: 0, sequence: 0, reason: 'This browser could not compute hashes.' }); }
  }, [router]);
  useEffect(() => { void load(); }, [load]);

  const types = useMemo(() => [...new Set((events ?? []).map((e) => e.event_type))].sort(), [events]);
  const shown = useMemo(() => [...(events ?? [])].filter((e) => type === 'all' || e.event_type === type).sort((a, b) => b.sequence - a.sequence), [events, type]);

  function download() {
    if (!events) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `prooffi-audit-${new Date().toISOString().slice(0, 19).replace(/:/g, '')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return <AppShell current="/audit">
    <section className="page-head">
      <p className="eyebrow">EVERYTHING THAT HAPPENED</p>
      <h1>Audit</h1>
      <p>Every recorded decision, newest first. Each event carries the hash of the one before it, so a changed or missing event breaks the chain. Your browser recomputes every hash below.</p>
      <p><a href="/certificate-verifier">Check a certificate</a></p>
    </section>

    {!events && !error && <p role="status" className="skeleton">Loading the audit log…</p>}
    {error && <div role="alert" className="notice"><p><strong>Could not load the audit log.</strong> {error}</p><button type="button" className="secondary" onClick={() => void load()}>Try again</button></div>}

    {events && <section className="history" aria-label="Audit log">
      <div className="toolbar">
        <div>
          <h2>{events.length} event{events.length === 1 ? '' : 's'}</h2>
          {check === null && events.length > 0 && <p role="status">Checking the hash chain…</p>}
          {check?.ok && <p role="status" className="success" data-testid="chain-status">Hash chain intact: all {check.checked} events recomputed and linked.</p>}
          {check && !check.ok && <p role="alert" className="notice" data-testid="chain-status">Hash chain broken at event {check.sequence}: {check.reason}</p>}
        </div>
        <div className="actions">
          <label className="inline-field" htmlFor="event-type">Show
            <select id="event-type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">All events</option>
              {types.map((t) => <option key={t} value={t}>{eventLabel(t)}</option>)}
            </select>
          </label>
          <button type="button" className="secondary" onClick={download} disabled={!events.length}>Download JSON</button>
        </div>
      </div>
      {events.length === 0
        ? <p>No events have been recorded yet. Confirming a Constitution or running a simulation adds the first one.</p>
        : <div className="table-scroll"><table aria-label="Audit events">
          <thead><tr><th scope="col">#</th><th scope="col">When</th><th scope="col">Event</th><th scope="col">Actor</th><th scope="col">Details</th><th scope="col">Hash</th></tr></thead>
          <tbody>{shown.map((e) => <tr key={e.id}>
            <td>{e.sequence}</td><td className="nowrap">{formatUtc(e.created_at)}</td><th scope="row">{eventLabel(e.event_type)}</th><td>{e.actor}</td>
            <td><DetailList details={e.details} /></td>
            <td className="nowrap"><code title={e.event_hash}>{e.event_hash.slice(0, 10)}…</code></td>
          </tr>)}</tbody>
        </table></div>}
      <p className="hint">The chain detects ordinary edits. It cannot prove that someone with full database access did not rewrite every event.</p>
    </section>}
  </AppShell>;
}
