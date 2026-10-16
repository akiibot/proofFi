'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatUsd } from '@/lib/format';
import { isNotImplemented, run, writeHeaders, type Problem } from '@/lib/request';
import type { components } from '@/lib/schema';
import { explainOptimizer, type OptimizerResult } from '@/components/workspace/explain';
import { statusMeaning, type CertificateStatus } from '@/components/certificates/status';

type EmergencyResponse = components['schemas']['EmergencyResponse'];

type Props = {
  stateVersion: number;
  previous: OptimizerResult | null; // the safe amount found before the emergency, if any
  certificateId: string | null; // a certificate issued before the emergency, if any
  onStateChanged: () => void;
};

const EMERGENCY_MINOR = 200000; // fixed by the contract (EmergencyRequest.amount_minor)

/** Records the demo's $2,000 emergency, then shows how the same Constitution now allows less (or nothing). */
export function EmergencyPanel({ stateVersion, previous, certificateId, onStateChanged }: Props) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<EmergencyResponse | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [oldCertificate, setOldCertificate] = useState<CertificateStatus | null>(null);
  const [fromVersion, setFromVersion] = useState(stateVersion);

  async function record() {
    setProblem(null); setResult(null); setOldCertificate(null); setBusy(true);
    setFromVersion(stateVersion); // the parent reloads afterwards, so keep the version this request was made against
    setFromVersion(stateVersion); // the parent reloads afterwards, so keep the version this request was made against
    try {
      const headers = await writeHeaders();
      const outcome = await run(() => api.POST('/demo/emergency', { body: { expected_state_version: stateVersion, amount_minor: EMERGENCY_MINOR }, headers }));
      if (!outcome.ok) {
        if (outcome.expired) { router.replace('/login'); return; }
        setProblem(outcome.problem);
        if (outcome.problem.code === 'STALE_STATE') onStateChanged();
        return;
      }
      setResult(outcome.data);
      onStateChanged();
      if (certificateId) {
        // Ask the backend, not this screen, whether the earlier certificate still holds.
        const status = await run(() => api.POST('/certificates/{id}/verify', { params: { path: { id: certificateId } }, headers }));
        if (status.ok) setOldCertificate(status.data);
      }
    } catch { setProblem({ code: 'UNAUTHORIZED', message: 'Your session could not be checked. Sign in again and retry.', reasons: [], httpStatus: 0 }); }
    finally { setBusy(false); }
  }

  const after = result ? explainOptimizer(result.optimization) : null;
  return <section className="editor" aria-label="Emergency expense">
    <h2>4. What if an emergency hits?</h2>
    <p>Records a {formatUsd(EMERGENCY_MINOR)} emergency expense in the demo state (version {stateVersion} becomes the next version). Your Constitution does not change; reality does, so what is safe is recomputed.</p>
    <label className="check">
      <input type="checkbox" checked={agreed} disabled={busy} onChange={(e) => setAgreed(e.target.checked)} />
      Record a {formatUsd(EMERGENCY_MINOR)} emergency expense in the demo financial state.
    </label>
    <div className="actions"><button type="button" disabled={!agreed || busy} onClick={() => void record()}>{busy ? 'Recording…' : `Record the ${formatUsd(EMERGENCY_MINOR)} emergency`}</button></div>

    {problem && <div role="alert" className="notice">
      <p><strong>{isNotImplemented(problem) ? 'The emergency demo is not available yet.' : problem.code === 'STALE_STATE' ? 'Your financial state changed in the meantime.' : 'The emergency could not be recorded.'}</strong> {problem.message}</p>
      <p>{problem.code === 'STALE_STATE' ? 'The latest state has been reloaded; try again.' : 'Your financial state was not changed.'}</p>
    </div>}

    {result && after && <div data-testid="emergency-result">
      <dl className="rule-list">
        <div><dt>Financial state</dt><dd>Version {fromVersion} → version {result.state.snapshot.version}</dd></div>
        <div><dt>Realized emergency expense</dt><dd>{formatUsd(result.state.snapshot.realized_expense_minor)}</dd></div>
        <div><dt>Safe amount before</dt><dd>{previous ? explainOptimizer(previous).title.replace(/^Largest safe amount: /, '') : 'Not calculated in this session'}</dd></div>
        <div><dt>Safe amount now</dt><dd>{after.title.replace(/^Largest safe amount: /, '')}</dd></div>
      </dl>
      <div className={`status-banner tone-${after.tone}`} role="status"><p className="status-title">{after.title}</p><p>{after.body}</p></div>
      {oldCertificate && <p className="notice">Earlier certificate <code>{oldCertificate.certificate_id}</code> is now: <b>{statusMeaning(oldCertificate.status).title}</b>. {oldCertificate.reasons.join('; ')}</p>}
    </div>}
  </section>;
}
