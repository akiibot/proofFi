'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { formatUsd, shortAddress } from '@/lib/format';
import { isNotImplemented } from '@/lib/request';
import { explorerUrl, EXECUTION_MEANING } from '@/components/approval/requests';
import { Page } from '@/shell/AppFrame';
import { useApp } from '@/shell/AppContext';
import { Button, TextLink } from '@/ui/Button';
import { Checkbox } from '@/ui/form';
import { Icon } from '@/ui/Icon';
import { EdgeCard, KeyValue, KeyValueList, PageHeader, ProgressSteps, Skeleton, Status } from '@/ui/kit';
import { countdown } from '@/lib/money';
import { approvalSentence, groupedUnits, tokenAmount, validUntil } from './proof';
import { ProofDrawer } from './ProofDrawer';
import { useCertificateFlow } from './useCertificateFlow';
import styles from './approve.module.css';

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (!active) return; const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, [active]);
  return now;
}

const STEPS = (current: 'ok' | 'done') => [
  { label: 'Safe amount', state: 'done' as const },
  { label: 'Verified and signed', state: 'done' as const },
  { label: 'Your OK and send', state: current === 'done' ? ('done' as const) : ('current' as const) },
  { label: 'Done', state: current === 'done' ? ('current' as const) : ('todo' as const) },
];

/** Figma "09 Approve and send", "10 Proof" and "11 Done": one exact consent, then one send. */
export function ApproveScreen() {
  const id = useSearchParams().get('id');
  const flow = useCertificateFlow(id);
  const { refreshNeedsYou, setChainOpen } = useApp();
  const [agreed, setAgreed] = useState(false);
  const [proofOpen, setProofOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { certificate: cert, status, evidence, busy } = flow;
  const now = useNow(Boolean(cert));

  useEffect(() => { if (flow.execution || flow.approval) void refreshNeedsYou(); }, [flow.execution, flow.approval, refreshNeedsYou]);

  if (!id) return <Page width={680}><EdgeCard where="Approve" title="No certificate chosen" description="Ask Vallet for a safe amount first; the approval screen opens from there." action={<Button kind="primary" href="/ask">Ask Vallet</Button>} /></Page>;
  if (busy === 'load' && !cert) return <Page width={680}><div className={styles.loading} role="status" aria-label="Loading"><Skeleton width={360} height={20} /><Skeleton width="70%" height={40} radius={10} /><Skeleton height={200} radius={12} /></div></Page>;
  if (flow.loadError || !cert) return <Page width={680}><EdgeCard where="Approve" tone="danger" title="We could not open this" description={flow.loadError || 'The certificate could not be read.'}
    action={<><Button kind="secondary" onClick={() => void flow.reload()}>Try again</Button><Button kind="flat" href="/ask">Ask again</Button></>} /></Page>;

  const p = cert.payload;
  const tx = p.transaction;
  const amount = formatUsd(p.action.amount_minor);
  const recipient = shortAddress(tx.recipient);
  const tokens = tokenAmount(tx.amount_base_units, tx.token_decimals);
  const isNewRecipient = p.approval.reasons.includes('NEW_RECIPIENT_APPROVAL_REQUIRED');
  const remaining = countdown(p.expires_at, now);
  const needsApproval = status?.status === 'APPROVAL_REQUIRED';
  const decided = evidence?.decision ?? flow.approval?.decision ?? null;
  const exec = flow.execution;
  const confirmed = exec?.status === 'CONFIRMED';
  const link = explorerUrl(exec?.tx_hash);
  const locked = busy !== null || flow.approvalUnknown;
  const actionable = Boolean(status) && !flow.readProblem && !flow.identityProblem && !flow.attempted && !evidence?.claim && decided !== 'DENY'
    && ((status?.status === 'APPROVAL_REQUIRED' && status.signature_valid) || (status?.status === 'VALID' && status.signature_valid));
  const recordedNotSent = decided === 'APPROVE' && status?.status === 'VALID' && !flow.attempted && !evidence?.claim;
  const proof = <ProofDrawer open={proofOpen} onClose={() => setProofOpen(false)} certificate={cert} status={status} />;

  /* ---------- 11 Done ---------- */
  if (confirmed && exec) return <Page width={680} className={styles.donePage}>
    <span className={styles.check} aria-hidden><Icon name="check" size={24} /></span>
    <PageHeader size="md" title={`Sent. ${amount} is confirmed.`} subtitle={`Confirmed on Base Sepolia testnet${exec.block_number !== null ? ` in block ${exec.block_number.toLocaleString('en-US')}` : ''}. It was signed once, by the executor, after your OK.`} />
    <div className={styles.transaction} data-testid="execution-result">
      <span className="sr-only">Last observed: {exec.status}. {EXECUTION_MEANING[exec.status]}</span>
      {exec.tx_hash && <><code title={exec.tx_hash}>{exec.tx_hash.slice(0, 8)}…{exec.tx_hash.slice(-9)}</code>
      <Button kind="flat" size="sm" leftIcon="copy" onClick={() => { void navigator.clipboard?.writeText(exec.tx_hash ?? '').then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); }); }}>{copied ? 'Copied' : 'Copy'}</Button>
      {link && <Button kind="flat" size="sm" rightIcon="arrow-right-up" href={link} aria-label="View on explorer">View on explorer</Button>}</>}
    </div>
    {flow.readProblem && <p role="alert" className="t-body-1 c-med">{flow.readProblem}</p>}
    <div className={styles.actions}>
      <Button kind="primary" size="xl" href="/">Back to Home</Button>
      <TextLink href={`/activity/story?certificate=${encodeURIComponent(p.id)}`}>See the full record</TextLink>
    </div>
  </Page>;

  /* ---------- states that replace the approval ---------- */
  const claimed = Boolean(evidence?.claim) || flow.attempted;
  let state: React.ReactNode = null;
  if (flow.identityProblem) state = <EdgeCard where="Done" tone="attention" title="We cannot confirm the result" description={<><p>{flow.identityProblem}</p><p>Sending again is locked. Your record is kept.</p></>}
    action={<Button kind="secondary" href={`/activity/story?certificate=${encodeURIComponent(p.id)}`}>See the record</Button>} />;
  else if (claimed && (flow.executionUnknown || exec) && !confirmed) {
    const failed = exec && (exec.status === 'FAILED' || exec.status === 'REORGED');
    state = failed
      ? <EdgeCard where="Done" tone="danger" title={exec.status === 'REORGED' ? 'The network replaced the block' : 'The network reported a failure'} description={<><p>{EXECUTION_MEANING[exec.status]}</p>{exec.error && <p>{exec.error.message}</p>}<p>Nothing more will be sent under this certificate.</p></>}
        action={<Button kind="secondary" href={`/activity/story?certificate=${encodeURIComponent(p.id)}`}>See the record</Button>} />
      : flow.executionUnknown && !exec
        ? <EdgeCard where="Done" tone="attention" title="We cannot confirm the result" description={<><p>A transaction may already exist. Sending again is locked.</p><p>Check the status instead of sending a second time.</p></>}
          action={flow.canReconcile ? <Button kind="secondary" busy={busy === 'reconcile'} onClick={() => void flow.reconcile()}>Check status</Button> : <Button kind="secondary" busy={busy === 'refresh'} onClick={() => void flow.refresh()}>Refresh</Button>} />
        : <EdgeCard where="Done" tone="attention" role="status" title="Waiting for confirmation" description={<div data-testid="execution-result"><p>Sent and waiting for the network. This can take a minute.</p>{exec && <p>Last observed: {exec.status}. {EXECUTION_MEANING[exec.status]}</p>}</div>}
          action={<Button kind="secondary" busy={busy === 'reconcile'} disabled={!flow.canReconcile} onClick={() => void flow.reconcile()}>Refresh</Button>} />;
  } else if (decided === 'DENY') state = <EdgeCard where="Approve" role="status" title="You declined this" description="Nothing was sent, and this certificate can no longer be used. A new request needs a new certificate." action={<Button kind="primary" href="/">Back to Home</Button>} />;
  else if (status && !actionable && !recordedNotSent) {
    const s = status.status;
    state = s === 'EXPIRED'
      ? <EdgeCard where="Approve" tone="attention" title="This offer expired" description="5 minutes passed. Nothing was approved." action={<Button kind="secondary" href="/ask">Check again</Button>} />
      : s === 'SIGNED_BUT_STALE'
        ? <EdgeCard where="Approve" tone="attention" title="Your money changed after this was signed" description="The signature is genuine, but this certificate can no longer be used. Check what is safe now." action={<Button kind="primary" href="/ask">Check again</Button>} />
        : s === 'ALREADY_USED'
          ? <EdgeCard where="Approve" tone="attention" title="This was already used" description="A send was already started under this certificate, so it cannot authorize another." action={<Button kind="secondary" href={`/activity/story?certificate=${encodeURIComponent(p.id)}`}>See the record</Button>} />
          : s === 'TAMPERED'
            ? <EdgeCard where="Approve" tone="danger" title="This does not match its signature" description="Treat it as forged. Nothing can be approved or sent." action={<Button kind="secondary" href="/activity">Back to Activity</Button>} />
            : <EdgeCard where="Approve" tone="attention" title="This cannot be approved" description={status.reasons.join('; ') || 'The backend does not offer it for approval.'} action={<Button kind="secondary" href="/ask">Ask again</Button>} />;
  }

  const submitting = busy === 'approve' || busy === 'send';
  return <Page width={680}>
    <section className={styles.approval} aria-label="Approval">
      <ProgressSteps steps={STEPS('ok')} />
      <PageHeader size="md" title={`Send ${amount} to the demo destination?`}
        subtitle={needsApproval ? approvalSentence(cert) : p.approval.required ? 'Your OK for this is already recorded. It is signed and ready to send.' : 'Your rules allow this without your OK. It is signed and ready to send.'} />

      <KeyValueList label="Summary">
        <KeyValue label="Amount" value={`${amount} · ${tokens} test tokens`} />
        <KeyValue label="To" value={<span title={tx.recipient}>{recipient}{isNewRecipient ? ' · new to you' : ' · known'}<span className="sr-only"> ({tx.recipient})</span></span>} />
        <KeyValue label="Network" value="Base Sepolia testnet · no real money" />
        <KeyValue label="Offer expires" value={remaining ? `in ${remaining}` : 'expired'} />
      </KeyValueList>

      <div className={styles.verified}>
        <Status state={status ? (status.signature_valid ? 'pass' : 'fail') : 'pending'}>Independently verified and signed · all {p.verdict.checks.length} rules checked</Status>
        <TextLink onClick={() => setProofOpen(true)}>Show proof</TextLink>
      </div>

      {flow.readProblem && <EdgeCard where="Approve" tone="attention" role="alert" title="We could not re-check this" description={flow.readProblem}
        action={<Button kind="secondary" busy={busy === 'refresh'} onClick={() => void flow.refresh()}>Check again</Button>} />}

      {state}

      {(flow.approvalProblem || flow.approvalUnknown) && <EdgeCard where="Approve" tone={flow.approvalUnknown ? 'attention' : 'danger'} title={flow.approvalUnknown ? 'We cannot confirm your OK' : 'Your OK was not recorded'}
        description={<><p>{flow.approvalProblem?.message ?? 'Your decision was sent from this tab, but its answer was never seen.'}</p>{flow.approvalUnknown ? <p>It may already be recorded. Check again; do not decide twice.</p> : <p>Nothing was approved or sent.</p>}</>}
        action={flow.approvalUnknown ? <Button kind="secondary" busy={busy === 'refresh'} onClick={() => void flow.refresh()}>Check again</Button> : undefined} />}

      {recordedNotSent && !flow.executionProblem && <EdgeCard where="Approve" tone="attention" role="status" title="Approved, not sent" description="Your OK is recorded. Nothing has been sent yet."
        action={<Button kind="primary" busy={busy === 'send'} disabled={locked} onClick={() => void flow.sendNow()}>Send now</Button>} />}

      {flow.executionProblem && !flow.executionUnknown && (isNotImplemented(flow.executionProblem)
        ? <EdgeCard where="Approve" tone="attention" title="Sending is off" description={<><p>The testnet connection is not ready. Your plan is saved.</p><p className="c-low">{flow.executionProblem.message}</p></>} action={<Button kind="secondary" onClick={() => setChainOpen(true)}>See status</Button>} />
        : <EdgeCard where="Approve" tone="danger" title="Approved, not sent" description={<><p>Your OK is recorded. Sending failed before it started.</p><p>{flow.executionProblem.message}</p>{flow.executionProblem.reasons.length > 0 && <ul>{flow.executionProblem.reasons.map((r) => <li key={r}>{r}</li>)}</ul>}</>}
          action={recordedNotSent ? <Button kind="primary" busy={busy === 'send'} disabled={locked} onClick={() => void flow.sendNow()}>Send now</Button> : undefined} />)}

      {actionable && !recordedNotSent && <>
        <div className={styles.consent}>
          <Checkbox checked={agreed} disabled={locked} onChange={(e) => setAgreed(e.target.checked)}>
            {needsApproval ? 'I approve exactly this' : 'Send exactly this'}: {amount} ({groupedUnits(tx.amount_base_units)} base units) of the test token to <span title={tx.recipient}>{recipient}</span><span className="sr-only"> ({tx.recipient}, token {tx.token_address})</span> on Base Sepolia, valid until {validUntil(cert)} UTC.
          </Checkbox>
        </div>
        <div className={styles.actions}>
          <Button kind="primary" size="xl" busy={submitting} disabled={!agreed || locked} onClick={() => { setAgreed(false); void flow.approveAndSend(); }}>{submitting ? (busy === 'send' ? 'Sending…' : 'Recording your OK…') : needsApproval ? 'Approve and send' : 'Send'}</Button>
          {needsApproval && <Button kind="secondary" size="xl" disabled={locked} onClick={() => { setAgreed(false); void flow.deny(); }}>Deny</Button>}
        </div>
        <p className="t-body-1 c-low">Approving can never override a broken rule. If one had failed, there would be nothing here to approve.</p>
      </>}
      <TextLink href="/" className={styles.leave}>{actionable ? 'Not now' : 'Back to Home'}</TextLink>
    </section>
    {proof}
  </Page>;
}
