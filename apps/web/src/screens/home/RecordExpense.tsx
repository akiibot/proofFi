'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatUsd } from '@/lib/format';
import { run, writeHeaders, type Problem } from '@/lib/request';
import type { components } from '@/lib/schema';
import { Button } from '@/ui/Button';
import { Checkbox } from '@/ui/form';
import { EdgeCard } from '@/ui/kit';
import { Dialog } from '@/ui/overlay';
import styles from './home.module.css';

export type EmergencyResponse = components['schemas']['EmergencyResponse'];
export const EMERGENCY_MINOR = 200000;

type Props = {
  open: boolean;
  onClose: () => void;
  stateVersion: number;
  /** A transport or server failure cannot prove the expense was not recorded, so further attempts stay locked. */
  uncertain: boolean;
  onUncertain: () => void;
  onRecorded: (result: EmergencyResponse, fromVersion: number) => void;
  onRefresh: () => void;
};

/** Figma "04 Record expense": one explicit acknowledgement of a $2,000 change to the demo financial state. */
export function RecordExpense({ open, onClose, stateVersion, uncertain, onUncertain, onRecorded, onRefresh }: Props) {
  const router = useRouter();
  const inFlight = useRef(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  async function record() {
    if (!agreed || uncertain || inFlight.current) return;
    inFlight.current = true;
    setAgreed(false); setBusy(true); setProblem(null); // the acknowledgement is spent the moment it is used, even if the request is refused
    const fromVersion = stateVersion;
    try {
      let headers: Record<string, string>;
      try { headers = await writeHeaders(); }
      catch { setProblem({ code: 'SESSION_CHECK', message: 'Your session could not be checked. The expense request was not sent.', reasons: [], httpStatus: 0 }); return; }
      const outcome = await run(() => api.POST('/demo/emergency', { body: { expected_state_version: fromVersion, amount_minor: EMERGENCY_MINOR }, headers }));
      if (!outcome.ok) {
        if (outcome.expired) { router.replace('/login'); return; }
        setProblem(outcome.problem);
        if (outcome.problem.httpStatus === 0 || outcome.problem.httpStatus >= 500) onUncertain();
        onRefresh();
        return;
      }
      onRecorded(outcome.data, fromVersion);
    } finally { inFlight.current = false; setBusy(false); }
  }

  function close() { if (busy) return; setAgreed(false); setProblem(null); onClose(); }

  return <Dialog open={open} onClose={close} dismissible={!busy} title="Record an unexpected expense"
    description={<p>Your rules stay the same. Vallet will recheck what is safe with your new balance.</p>}
    footer={<>
      <Button kind="secondary" size="lg" onClick={close} disabled={busy}>Cancel</Button>
      <Button kind="primary" size="lg" onClick={() => void record()} disabled={!agreed || uncertain} busy={busy}>{busy ? 'Recording…' : 'Record expense'}</Button>
    </>}>
    <section className={styles.expenseContent} aria-label="Emergency expense">
      <div className={styles.expenseAmount}><span>Amount</span><strong className="t-h3 tabular">{formatUsd(EMERGENCY_MINOR)}</strong></div>
      <p className={styles.expenseWarning}>Any approval you have not sent yet will stop working.</p>
    </section>
    <Checkbox checked={agreed} disabled={busy || uncertain} onChange={(e) => setAgreed(e.target.checked)}>Yes, record this {formatUsd(EMERGENCY_MINOR)} expense.</Checkbox>
    {(problem || uncertain) && <EdgeCard tone={uncertain ? 'attention' : 'danger'} title={uncertain ? 'We cannot confirm the result' : 'The expense was not recorded'}
      description={<>
        <p>{problem?.message ?? 'An earlier attempt from this tab did not return an answer.'}</p>
        {uncertain
          ? <p>It may already have been recorded. Recording again is locked so it cannot happen twice; check Activity first.</p>
          : <p>Nothing changed. Review your money before trying again.</p>}
        {problem && problem.reasons.length > 0 && <ul>{problem.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
      </>} />}
  </Dialog>;
}
