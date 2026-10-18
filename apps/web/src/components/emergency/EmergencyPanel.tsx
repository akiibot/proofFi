'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatUsd } from '@/lib/format';
import { run, writeHeaders, type Problem } from '@/lib/request';
import type { components } from '@/lib/schema';
import { explainOptimizer, type OptimizerResult } from '@/components/workspace/explain';

type EmergencyResponse = components['schemas']['EmergencyResponse'];
type CertificateStatus = components['schemas']['CertificateStatus'];
type Props = {
  stateVersion: number;
  previous: OptimizerResult | null;
  certificateId: string | null;
  disabled: boolean;
  onBusyChange: (busy: boolean) => void;
  onStateChanged: () => void;
};
const EMERGENCY_MINOR = 200000;

export function EmergencyPanel({ stateVersion, previous, certificateId, disabled, onBusyChange, onStateChanged }: Props) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [result, setResult] = useState<EmergencyResponse | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [oldCertificate, setOldCertificate] = useState<CertificateStatus | null>(null);
  const [certificateProblem, setCertificateProblem] = useState('');
  const [before, setBefore] = useState<OptimizerResult | null>(null);
  const [fromVersion, setFromVersion] = useState(stateVersion);

  async function record() {
    if (!agreed || disabled || uncertain || inFlight.current) return;
    inFlight.current = true;
    setAgreed(false); setBusy(true); onBusyChange(true);
    setProblem(null); setResult(null); setOldCertificate(null); setCertificateProblem('');
    setFromVersion(stateVersion); setBefore(previous);
    try {
      let headers: Record<string, string>;
      try { headers = await writeHeaders(); }
      catch {
        setProblem({ code: 'SESSION_CHECK', message: 'Your session could not be checked. The expense request was not sent.', reasons: [], httpStatus: 0 });
        return;
      }
      const outcome = await run(() => api.POST('/demo/emergency', { body: { expected_state_version: stateVersion, amount_minor: EMERGENCY_MINOR }, headers }));
      if (!outcome.ok) {
        if (outcome.expired) { router.replace('/login'); return; }
        setProblem(outcome.problem);
        // A proxy/transport/server failure cannot prove that the mutation did not commit.
        if (outcome.problem.httpStatus === 0 || outcome.problem.httpStatus >= 500) setUncertain(true);
        onStateChanged();
        return;
      }
      setResult(outcome.data);
      onStateChanged();
      if (certificateId) {
        const status = await run(() => api.POST('/certificates/{id}/verify', { params: { path: { id: certificateId } }, headers }));
        if (status.ok) setOldCertificate(status.data);
        else {
          setCertificateProblem('The expense was recorded, but the earlier certificate status could not be checked. ' + status.problem.message);
          if (status.expired) router.replace('/login');
        }
      }
    } finally { inFlight.current = false; setBusy(false); onBusyChange(false); }
  }

  const after = result ? explainOptimizer(result.optimization) : null;
  return <section className="editor" aria-label="Emergency expense">
    <h2>4. What if an emergency hits?</h2>
    <p>Records a {formatUsd(EMERGENCY_MINOR)} emergency expense in the demo state (version {stateVersion} becomes the next version). Your Constitution does not change; the safe amount is recomputed from the new state.</p>
    <label className="check">
      <input type="checkbox" checked={agreed} disabled={disabled || busy || uncertain} onChange={(e) => setAgreed(e.target.checked)} />
      Record a {formatUsd(EMERGENCY_MINOR)} emergency expense in the demo financial state.
    </label>
    <div className="actions"><button type="button" disabled={!agreed || disabled || busy || uncertain} onClick={() => void record()}>{busy ? 'Recording…' : `Record the ${formatUsd(EMERGENCY_MINOR)} emergency`}</button></div>
    {problem && <div role="alert" className="notice">
      <p><strong>{uncertain ? 'The expense outcome is unknown.' : 'The emergency request was refused or not sent.'}</strong> {problem.message}</p>
      {uncertain
        ? <p>The expense may already have been recorded. A state refresh was requested. Submission is disabled here to prevent a blind repeat; check the financial state and audit history before recording another expense.</p>
        : <p>This request did not record an expense. Review the current state before trying again.</p>}
      {problem.reasons.length > 0 && <ul>{problem.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
    </div>}
    {result && after && <div data-testid="emergency-result">
      <dl className="rule-list">
        <div><dt>Financial state</dt><dd>Version {fromVersion} → version {result.state.snapshot.version}</dd></div>
        <div><dt>Total realized emergency expenses</dt><dd>{formatUsd(result.state.snapshot.realized_expense_minor)}</dd></div>
        <div><dt>Safe amount before</dt><dd>{before ? explainOptimizer(before).title : 'Not calculated in this session'}</dd></div>
        <div><dt>Safe amount now</dt><dd>{after.title}</dd></div>
      </dl>
      <div className={`status-banner tone-${after.tone}`} role="status"><p className="status-title">{after.title}</p><p>{after.body}</p></div>
      {oldCertificate && <p className="notice">Earlier certificate <code>{oldCertificate.certificate_id}</code> is now: <b>{oldCertificate.status}</b>. {oldCertificate.reasons.join('; ')}</p>}
      {certificateProblem && <p role="alert" className="notice">{certificateProblem}</p>}
    </div>}
  </section>;
}
