import { useState } from 'react';
import type { Problem } from '@/lib/request';
import { isNotImplemented } from '@/lib/request';
import { EXECUTION_MEANING, explorerUrl, type Execution } from './requests';

type Props = { enabled: boolean; busy: boolean; execution: Execution | null; problem: Problem | null; onExecute: () => void };

/** Execution result exactly as the executor reported it: a real receipt and explorer link, or the real error. */
export function ExecutionPanel({ enabled, busy, execution, problem, onExecute }: Props) {
  const [agreed, setAgreed] = useState(false);
  const link = explorerUrl(execution?.tx_hash);
  return <section className="decision" aria-label="Execution">
    <h2>Execution</h2>
    {!execution && <>
      {!enabled && <p>Execution becomes available only when the certificate is valid and, if required, approved.</p>}
      <label className="check">
        <input type="checkbox" checked={agreed} disabled={!enabled || busy} onChange={(e) => setAgreed(e.target.checked)} />
        Send this transaction to the Base Sepolia testnet. No real money is used.
      </label>
      <div className="actions"><button type="button" disabled={!enabled || !agreed || busy} onClick={onExecute}>{busy ? 'Executing…' : 'Execute on testnet'}</button></div>
    </>}
    {problem && <div role="alert" className="notice">
      <p><strong>{isNotImplemented(problem) ? 'Execution is not available yet.' : 'The executor refused or failed.'}</strong> {problem.message}</p>
      {problem.reasons.length > 0 && <ul>{problem.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}
      <p>No transaction hash was produced.</p>
    </div>}
    {execution && <div role="status" className={execution.status === 'CONFIRMED' ? 'success' : 'notice'} data-testid="execution-result">
      <p><strong>{execution.status}</strong>: {EXECUTION_MEANING[execution.status]}</p>
      {execution.tx_hash && <p>Transaction <code>{execution.tx_hash}</code>{link && <> · <a href={link} target="_blank" rel="noreferrer">View on the Base Sepolia explorer</a></>}</p>}
      {execution.block_number !== null && <p>Block {execution.block_number} · {execution.confirmations} confirmation{execution.confirmations === 1 ? '' : 's'}</p>}
      {execution.error && <p>Error: {execution.error.message}</p>}
    </div>}
  </section>;
}
