'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatUsd } from '@/lib/format';
import { isNotImplemented, run, writeHeaders, type Problem } from '@/lib/request';
import type { components } from '@/lib/schema';
import { AppShell } from '@/components/shell/AppShell';
import { VerdictChecks } from '@/components/certificates/CertificateDetails';
import { eventLabel, type AuditEvent } from '@/components/audit/chain';

type AttackResponse = components['schemas']['AttackResponse'];

const sessionProblem: Problem = { code: 'UNAUTHORIZED', message: 'Your session could not be checked. Sign in again and retry.', reasons: [], httpStatus: 0 };

export default function RedTeamPage() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [attack, setAttack] = useState<AttackResponse | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [newEvents, setNewEvents] = useState<AuditEvent[] | null>(null);
  const [auditError, setAuditError] = useState('');

  async function launch() {
    setProblem(null); setAttack(null); setNewEvents(null); setAuditError(''); setBusy(true);
    try {
      const before = await run(() => api.GET('/audit'));
      if (!before.ok && before.expired) { router.replace('/login'); return; }
      const lastSequence = before.ok ? Math.max(0, ...before.data.map((e) => e.sequence)) : null;
      const headers = await writeHeaders();
      const outcome = await run(() => api.POST('/demo/attack', { headers }));
      if (!outcome.ok) { if (outcome.expired) { router.replace('/login'); return; } setProblem(outcome.problem); return; }
      setAttack(outcome.data);
      // Show only the audit events this attack added, so the refusal is visibly on record.
      const after = await run(() => api.GET('/audit'));
      if (after.ok && lastSequence !== null) setNewEvents(after.data.filter((e) => e.sequence > lastSequence).sort((a, b) => a.sequence - b.sequence));
      else setAuditError(after.ok ? 'The audit log could not be compared with its earlier state.' : after.problem.message);
    } catch { setProblem(sessionProblem); }
    finally { setBusy(false); }
  }

  const blocked = attack && attack.verification.verdict.decision === 'DENY' && !attack.signer_called && attack.tx_hash == null;

  return <AppShell current="/red-team">
    <section className="page-head">
      <p className="eyebrow">ASSUME THE AI CAN BE FOOLED</p>
      <h1>Red team</h1>
      <p>A planted instruction tells the AI planner to send money to an unknown address. The planner is fooled on purpose. This screen shows what the independent verifier and executor do next, using the real backend.</p>
    </section>

    <section className="editor" aria-label="Launch the attack">
      <h2>Launch the attack</h2>
      <p>Runs the demo attack fixture. It never moves real money and never reaches the signer when the defences hold.</p>
      <label className="check">
        <input type="checkbox" checked={agreed} disabled={busy} onChange={(e) => setAgreed(e.target.checked)} />
        I understand this sends a deliberately malicious proposal through the real verification pipeline.
      </label>
      <div className="actions"><button type="button" disabled={!agreed || busy} onClick={() => void launch()}>{busy ? 'Attacking…' : 'Run the attack'}</button></div>
    </section>

    {problem && <div role="alert" className="notice">
      <p><strong>{isNotImplemented(problem) ? 'The red-team demo is not available yet.' : 'The attack demo failed.'}</strong> {problem.message}</p>
      <p>No proposal was made, so nothing was verified, signed or sent.</p>
    </div>}

    {attack && <section className="attack" aria-label="Attack result">
      <div className={`status-banner ${blocked ? 'tone-ok' : 'tone-bad'}`} role="status" data-testid="attack-verdict">
        <p className="status-title">{blocked ? 'AI fooled. Funds safe.' : 'Attack was not fully contained'}</p>
        <p>{blocked ? 'The verifier denied the proposal and the signer was never called.' : 'Review the details below; the backend did not report a clean refusal.'}</p>
      </div>

      <h2>1. What the fooled planner proposed</h2>
      <dl className="rule-list">
        <div><dt>Amount</dt><dd>{formatUsd(attack.candidate.amount_minor)}</dd></div>
        <div><dt>Recipient</dt><dd><code>{attack.candidate.recipient}</code></dd></div>
        <div><dt>Funding</dt><dd>{attack.candidate.funding_source === 'borrowed' ? 'Borrowed money' : 'Own money'}</dd></div>
        <div><dt>Planner</dt><dd>{attack.candidate.planner_mode.replace(/_/g, ' ')}</dd></div>
      </dl>
      <p className="hint">Planner reason (untrusted, shown as received): “{attack.candidate.planner_reason_untrusted}”</p>

      <h2>2. What the independent verifier decided</h2>
      <VerdictChecks verdict={attack.verification.verdict} />
      {attack.verification.reasons.length > 0 && <ul className="assumptions">{attack.verification.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
      <p>Certificate issued: <b>{attack.verification.certificate_id ? attack.verification.certificate_id : 'none'}</b></p>

      <h2>3. What the executor did</h2>
      <dl className="rule-list">
        <div><dt>Executor answer</dt><dd><code>{attack.execution_error.code}</code> {attack.execution_error.message}</dd></div>
        <div><dt>Signer called</dt><dd data-testid="signer-called">{attack.signer_called ? 'Yes' : 'No'}</dd></div>
        <div><dt>Transaction hash</dt><dd data-testid="attack-tx">{attack.tx_hash ?? 'None. No transaction exists.'}</dd></div>
      </dl>

      <h2>4. On the record</h2>
      {auditError && <p className="notice">{auditError}</p>}
      {newEvents && (newEvents.length
        ? <ul className="assumptions">{newEvents.map((e) => <li key={e.id}>#{e.sequence} {eventLabel(e.event_type)}</li>)}</ul>
        : <p>The attack added no audit events.</p>)}
      <p><a href="/audit">Open the full audit log</a></p>
    </section>}
  </AppShell>;
}
