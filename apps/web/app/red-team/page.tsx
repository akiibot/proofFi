'use client';
import { useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatUsd } from '@/lib/format';
import { run, writeHeaders, type Problem } from '@/lib/request';
import type { components } from '@/lib/schema';
import { AppShell } from '@/components/shell/AppShell';

type AttackResponse = components['schemas']['AttackResponse'];
type AuditEvent = components['schemas']['AuditEvent'];

const subscribeToHydration = () => () => undefined;
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export default function RedTeamPage() {
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const inFlight = useRef(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [attack, setAttack] = useState<AttackResponse | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [auditError, setAuditError] = useState('');

  async function launch() {
    if (!hydrated || !agreed || inFlight.current || uncertain) return;
    inFlight.current = true;
    setAgreed(false); setBusy(true); setAttack(null); setProblem(null); setEvents(null); setAuditError('');
    try {
      let headers: Record<string, string>;
      try { headers = await writeHeaders(); }
      catch {
        setProblem({ code: 'SESSION_CHECK', message: 'The session check could not finish. The attack request was not sent.', reasons: [], httpStatus: 0 });
        return;
      }
      const outcome = await run(() => api.POST('/demo/attack', { headers }));
      if (!outcome.ok) {
        if (outcome.expired) { router.replace('/login'); return; }
        setProblem(outcome.problem);
        if (outcome.problem.httpStatus === 0 || outcome.problem.httpStatus >= 500) setUncertain(true);
        return;
      }
      setAttack(outcome.data);
      const log = await run(() => api.GET('/audit'));
      if (log.ok) {
        // Match actual artifact IDs, not every event that happened in another tab.
        setEvents(log.data.filter(e => e.details.action_id === outcome.data.candidate.id || e.details.verification_id === outcome.data.verification.id).sort((a, b) => a.sequence - b.sequence));
      } else {
        setAuditError('The attack response was received, but its audit records could not be loaded. ' + log.problem.message);
        if (log.expired) router.replace('/login');
      }
    } finally { inFlight.current = false; setBusy(false); }
  }

  const blocked = attack?.verification.verdict.decision === 'DENY'
    && attack.verification.certificate_id === null
    && attack.execution_error.code === 'INVALID_CERTIFICATE'
    && attack.signer_called === false && attack.tx_hash === null;

  return <AppShell current="/red-team">
    <section className="page-head">
      <p className="eyebrow">VERIFY EVERY PROPOSAL</p>
      <h1>Red team</h1>
      <p>A controlled planner fixture proposes a $4,000 allocation using borrowed funds and text claiming approval. Inspect the real verifier and executor authorization checks.</p>
    </section>
    <section className="editor" aria-label="Launch controlled attack">
      <h2>Controlled unsafe proposal</h2>
      <p>The demo records an untrusted proposal and rejection evidence. Required Constitution and operational configuration must already exist.</p>
      <label className="check"><input type="checkbox" checked={agreed} disabled={!hydrated || busy || uncertain} onChange={e => setAgreed(e.target.checked)} />Run the controlled $4,000 borrowed-funding proposal through the trusted checks.</label>
      <div className="actions"><button type="button" disabled={!hydrated || !agreed || busy || uncertain} onClick={() => void launch()}>{busy ? 'Checking…' : 'Run controlled attack'}</button></div>
    </section>
    {problem && <div role="alert" className="notice">
      <p><strong>{uncertain ? 'The attempt outcome is unconfirmed.' : 'The request was refused or not sent.'}</strong> {problem.message}</p>
      {uncertain && <p>The request may have recorded artifacts. Another submission is disabled here to prevent a blind repeat. Review the backend audit before starting another attempt.</p>}
      <p>No successful rejection result was received.</p>
      {problem.reasons.length > 0 && <ul>{problem.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>}
    </div>}
    {attack && <section aria-label="Attack result">
      <div className={`status-banner ${blocked ? 'tone-ok' : 'tone-bad'}`} role="status" data-testid="attack-verdict">
        <p className="status-title">{blocked ? 'Controlled proposal blocked' : 'Complete rejection evidence was not reported'}</p>
        <p>{blocked ? 'The verifier denied the proposal, issued no certificate, and the executor rejected missing authority. The backend reports no signer call or transaction hash.' : 'Review the actual backend values below.'}</p>
      </div>
      <h2>1. Untrusted planner proposal</h2>
      <dl className="rule-list">
        <div><dt>Amount</dt><dd>{formatUsd(attack.candidate.amount_minor)}</dd></div>
        <div><dt>Recipient</dt><dd><code>{attack.candidate.recipient}</code></dd></div>
        <div><dt>Funding</dt><dd>{attack.candidate.funding_source}</dd></div>
        <div><dt>Planner mode</dt><dd>{attack.candidate.planner_mode}</dd></div>
      </dl>
      <p className="hint">Untrusted reasoning: {attack.candidate.planner_reason_untrusted}</p>
      <h2>2. Independent verification</h2>
      <p>Decision: <b>{attack.verification.verdict.decision}</b>. Certificate: <b>{attack.verification.certificate_id ?? 'None issued'}</b>.</p>
      <ul className="assumptions">{attack.verification.verdict.checks.map(check => <li key={check.rule}><b>{check.rule}: {check.status}</b> — {check.reason_code}</li>)}</ul>
      <h2>3. Executor response</h2>
      <dl className="rule-list">
        <div><dt>Rejection</dt><dd><code>{attack.execution_error.code}</code> {attack.execution_error.message}</dd></div>
        <div><dt>Signer called</dt><dd data-testid="signer-called">{attack.signer_called ? 'Yes' : 'No'}</dd></div>
        <div><dt>Transaction hash</dt><dd data-testid="attack-tx">{attack.tx_hash ?? 'None reported'}</dd></div>
      </dl>
      <h2>4. Linked audit records</h2>
      <p className="hint">Records are matched to this response’s action and verification IDs. This screen displays backend records; full audit-chain verification belongs to the Audit Explorer.</p>
      {auditError && <p role="alert" className="notice">{auditError}</p>}
      {events && (events.length > 0 ? <ul className="assumptions">{events.map(event => <li key={event.id}>#{event.sequence} {event.event_type}<br /><code>{event.artifact_digest}</code></li>)}</ul> : <p>No matching audit records were returned.</p>)}
    </section>}
  </AppShell>;
}
