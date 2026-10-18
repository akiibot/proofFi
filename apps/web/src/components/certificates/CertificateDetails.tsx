import { formatUsd, formatUtc } from '@/lib/format';
import { bpsToPercent } from '@/lib/units';
import { statusMeaning, type ActionCertificate, type CertificateStatus } from './status';

export function StatusBanner({ status }: { status: CertificateStatus }) {
  const meaning = statusMeaning(status.status);
  return <div className={`status-banner tone-${meaning.tone}`} role="status" data-testid="certificate-status">
    <p className="status-title">{meaning.title}</p>
    <p>{meaning.meaning}</p>
    <p>Signature {status.signature_valid ? 'verified' : 'not verified'}.{status.reasons.length > 0 && <> Reasons: {status.reasons.join('; ')}.</>}</p>
  </div>;
}

/** The signed payload, in the words a person checks before approving: what moves, where, under which rules, until when. */
export function CertificateDetails({ certificate }: { certificate: ActionCertificate }) {
  const p = certificate.payload;
  const tx = p.transaction;
  return <section className="certificate" aria-label="Certificate details">
    <h2>Certificate <code>{p.id}</code></h2>
    <dl className="rule-list">
      <div><dt>Action</dt><dd>{p.action.action_type === 'TEST_TOKEN_ALLOCATION' ? 'Test token allocation' : 'Transfer'} of {formatUsd(p.action.amount_minor)}</dd></div>
      <div><dt>Recipient</dt><dd><code>{p.action.recipient}</code></dd></div>
      <div><dt>Token</dt><dd><code>{p.action.token_address}</code></dd></div>
      <div><dt>Chain</dt><dd>Base Sepolia testnet ({tx.chain_id})</dd></div>
      <div><dt>Exact token amount</dt><dd>{tx.amount_base_units} base units</dd></div>
      <div><dt>Approval</dt><dd>{p.approval.required ? `Required: ${p.approval.reasons.join('; ') || 'yes'}` : 'Not required'}</dd></div>
      <div><dt>Issued</dt><dd>{formatUtc(p.issued_at)}</dd></div>
      <div><dt>Expires</dt><dd>{formatUtc(p.expires_at)}</dd></div>
      <div><dt>Constitution</dt><dd><code>{p.constitution_version}</code></dd></div>
      <div><dt>Policy fingerprint</dt><dd><code>{p.policy_digest}</code></dd></div>
      <div><dt>State</dt><dd>Version {p.state_version} · <code>{p.state_snapshot_hash}</code></dd></div>
      <div><dt>Simulated reserve breach</dt><dd>{bpsToPercent(p.simulation.metrics.reserve_breach_probability_bps)}%</dd></div>
      <div><dt>Simulated goal probability</dt><dd>{bpsToPercent(p.simulation.metrics.goal_satisfaction_probability_bps)}%</dd></div>
      <div><dt>Verifier key</dt><dd><code>{certificate.key_id}</code></dd></div>
      <div><dt>Certificate hash</dt><dd><code>{certificate.certificate_hash}</code></dd></div>
      <div><dt>Nonce</dt><dd><code>{p.nonce}</code></dd></div>
    </dl>
    <h3 className="section-label">Policy checks</h3>
    <PolicyVerdict certificate={certificate} />
  </section>;
}

const DECISION: Record<string, string> = { PASS: 'Every rule passed', DENY: 'Denied by policy', REQUIRES_APPROVAL: 'Allowed only with your approval' };
const RULE_STATUS: Record<string, string> = { PASS: 'Passed', FAIL: 'Failed', REQUIRES_APPROVAL: 'Needs approval' };

function measuredText(measured: Record<string, number | string | boolean>): string {
  return Object.entries(measured).map(([k, v]) => `${k.replace(/_/g, ' ')} ${String(v)}`).join(' · ');
}

function PolicyVerdict({ certificate }: { certificate: ActionCertificate }) {
  const { decision, checks } = certificate.payload.verdict;
  return <>
    <p>Decision: <b>{DECISION[decision] ?? decision}</b></p>
    {checks.length === 0
      ? <p>No individual rule checks were recorded.</p>
      : <ul className="checks">{checks.map((c, i) => <li key={`${c.rule}-${i}`} className={`check-${c.status.toLowerCase()}`}>
        <span>{RULE_STATUS[c.status] ?? c.status}</span> {c.rule.replace(/_/g, ' ')} <small>({c.reason_code}{Object.keys(c.measured).length ? `; ${measuredText(c.measured)}` : ''})</small>
      </li>)}</ul>}
  </>;
}

/** The exact transaction the executor would sign. Shown so a person approves concrete bytes, not a summary. */
export function TransactionFields({ certificate }: { certificate: ActionCertificate }) {
  const tx = certificate.payload.transaction;
  return <dl className="rule-list" aria-label="Exact transaction">
    <div><dt>From (sender)</dt><dd><code>{tx.sender}</code></dd></div>
    <div><dt>Token contract (to)</dt><dd><code>{tx.to}</code></dd></div>
    <div><dt>Recipient</dt><dd><code>{tx.recipient}</code></dd></div>
    <div><dt>Amount</dt><dd>{tx.amount_base_units} base units ({tx.token_decimals} decimals)</dd></div>
    <div><dt>Native value</dt><dd>{tx.value_wei} wei</dd></div>
    <div><dt>Nonce</dt><dd>{tx.nonce}</dd></div>
    <div><dt>Gas limit</dt><dd>{tx.gas_limit}</dd></div>
    <div><dt>Max fee per gas</dt><dd>{tx.max_fee_per_gas_wei} wei</dd></div>
    <div><dt>Max priority fee</dt><dd>{tx.max_priority_fee_per_gas_wei} wei</dd></div>
    <div><dt>Call data</dt><dd><code>{tx.data}</code></dd></div>
  </dl>;
}
