import { useState } from 'react';
import { formatUsd, formatUtc } from '@/lib/format';
import type { ActionCertificate } from '@/components/certificates/status';
import type { Approval } from './requests';

type Props = { certificate: ActionCertificate; enabled: boolean; busy: boolean; approval: Approval | null; onDecide: (decision: 'APPROVE' | 'DENY') => void };

/** A decision about exactly this certificate. Approving never overrides a policy failure; the backend refuses that itself. */
export function ApprovalPanel({ certificate, enabled, busy, approval, onDecide }: Props) {
  const [agreed, setAgreed] = useState(false);
  const p = certificate.payload;
  if (approval) {
    return <section className="decision" aria-label="Your decision">
      <h2>Your decision</h2>
      <p role="status" className={approval.decision === 'APPROVE' ? 'success' : 'notice'}>
        {approval.decision === 'APPROVE' ? 'Approved' : 'Denied'} at {formatUtc(approval.created_at)} for certificate <code>{approval.certificate_id}</code>.
        {approval.consumed_at ? ` Used by an execution at ${formatUtc(approval.consumed_at)}.` : ''}
      </p>
    </section>;
  }
  if (!p.approval.required) return null;
  return <section className="decision" aria-label="Your decision">
    <h2>Your decision</h2>
    <p>This action needs your approval because: {p.approval.reasons.join('; ') || 'the Constitution requires it'}.</p>
    {!enabled && <p className="notice">Approval is not available for this certificate in its current status.</p>}
    <label className="check">
      <input type="checkbox" checked={agreed} disabled={!enabled || busy} onChange={(e) => setAgreed(e.target.checked)} />
      I approve exactly this transaction: {formatUsd(p.action.amount_minor)} ({p.transaction.amount_base_units} base units) of token <code>{p.transaction.token_address}</code> to <code>{p.transaction.recipient}</code> on Base Sepolia, valid until {formatUtc(p.expires_at)}.
    </label>
    <div className="actions">
      <button type="button" disabled={!enabled || !agreed || busy} onClick={() => onDecide('APPROVE')}>{busy ? 'Recording…' : 'Approve'}</button>
      <button type="button" className="secondary" disabled={!enabled || busy} onClick={() => onDecide('DENY')}>Deny</button>
    </div>
  </section>;
}
