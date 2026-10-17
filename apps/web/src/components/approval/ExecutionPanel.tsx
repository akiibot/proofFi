import { useState } from 'react';
import type { Problem } from '@/lib/request';
import { isNotImplemented } from '@/lib/request';
import { EXECUTION_MEANING, explorerUrl, type Execution } from './requests';

type Props = {
  enabled: boolean; busy: boolean; execution: Execution | null; problem: Problem | null;
  attempted: boolean; uncertain: boolean; canReconcile: boolean;
  onExecute: () => void; onReconcile: () => void;
};

/** Receipt observations remain separate from immutable signed certificate contents. */
export function ExecutionPanel({ enabled, busy, execution, problem, attempted, uncertain, canReconcile, onExecute, onReconcile }: Props) {
  const [agreed, setAgreed] = useState(false);
  const link = explorerUrl(execution?.tx_hash);
  return <section className="decision" aria-label="Execution">
    <h2>Execution</h2>
    {!execution && !attempted && <>
      {!enabled && <p>Execution becomes available only when the certificate is valid and, if required, approved.</p>}
      <label className="check">
        <input type="checkbox" checked={agreed} disabled={!enabled || busy} onChange={(e) => setAgreed(e.target.checked)} />
        Send this transaction to the Base Sepolia testnet. No real money is used.
      </label>
      <div className="actions"><button type="button" disabled={!enabled || !agreed || busy} onClick={() => { setAgreed(false); onExecute(); }}>{busy ? 'Executing…' : 'Execute on testnet'}</button></div>
    </>}
    {uncertain && <p role="alert" className="notice">The execution outcome is unknown. A claim or transaction may already exist. Refresh status and audit; do not submit a new attempt.</p>}
    {problem && <div role="alert" className="notice">
      <p><strong>{isNotImplemented(problem) ? 'Execution is not enabled.' : uncertain ? 'Execution response unavailable.' : 'Execution request refused or not sent.'}</strong> {problem.message}</p>
      {problem.reasons.length > 0 && <ul>{problem.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
    </div>}
    {execution && <div role="status" className={execution.status === 'CONFIRMED' ? 'success' : 'notice'} data-testid="execution-result">
      <p><strong>Last observed: {execution.status}</strong>. {EXECUTION_MEANING[execution.status]}</p>
      {execution.tx_hash && <p>Stored transaction hash <code>{execution.tx_hash}</code>{link && <> · <a href={link} target="_blank" rel="noreferrer">View on the Base Sepolia explorer</a></>}</p>}
      {execution.block_number !== null && <p>Block {execution.block_number} · {execution.confirmations} confirmation{execution.confirmations === 1 ? '' : 's'}</p>}
      {execution.error && <p>Error: {execution.error.message}</p>}
    </div>}
    {attempted && <p className="hint">The original request identity is retained in this tab. Only a recorded claim with that identity can be reconciled here.</p>}
    {canReconcile && <button type="button" className="secondary" disabled={busy} onClick={onReconcile}>{busy ? 'Reconciling…' : 'Reconcile recorded attempt'}</button>}
    <p><a href="/audit">View linked audit evidence</a></p>
  </section>;
}
