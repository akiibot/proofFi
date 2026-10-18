'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { ActionCertificate, AuditEvent } from '@/lib/activity';
import { formatUsd, shortAddress } from '@/lib/format';
import { run, writeHeaders } from '@/lib/request';
import type { CertificateStatus } from '@/components/certificates/status';
import { recallAsk } from '@/lib/safe-memory';
import { verifyChain, eventLabel, type ChainCheck } from '@/components/audit/chain';
import { executionEvidence, executionLabel, type ExecutionEvidence } from '@/lib/execution-evidence';
import { explorerUrl } from '@/components/approval/requests';
import { Page } from '@/shell/AppFrame';
import { Button, TextLink } from '@/ui/Button';
import type { IconName } from '@/ui/Icon';
import { Divider, EdgeCard, KeyValue, KeyValueList, PageHeader, Skeleton, Status, TimelineStep } from '@/ui/kit';
import { Drawer } from '@/ui/overlay';
import { ProofDrawer } from '../approve/ProofDrawer';
import styles from './activity.module.css';

const hhmm = (iso: string) => new Date(iso).toISOString().slice(11, 16);

type Step = { key: string; icon: IconName; title: string; description: string; at: string; events: AuditEvent[]; certificate?: boolean };

/** Related events: everything recorded under this certificate, plus the verification and simulation that produced it. */
function related(events: AuditEvent[], cert: ActionCertificate): AuditEvent[] {
  const id = cert.payload.id;
  const issued = events.find((e) => e.event_type === 'CERTIFICATE_ISSUED' && e.details.certificate_id === id);
  const verification = issued?.details.verification_id;
  const action = issued?.details.action_id;
  const verified = events.find((e) => (e.event_type === 'ACTION_VERIFIED' || e.event_type === 'ACTION_REJECTED') && e.details.verification_id === verification);
  const simulation = verified?.details.simulation_id;
  const executionIds = new Set(events.filter(e => e.details.certificate_id === id && e.event_type === 'EXECUTION_CLAIMED').map(e => e.details.execution_id));
  const mine = events.filter((e) => (e.details.execution_id && executionIds.has(e.details.execution_id)) || e.details.certificate_id === id || (verification && e.details.verification_id === verification) || (simulation && e.details.simulation_id === simulation) || (action && e.details.action_id === action));
  return [...new Map(mine.map((e) => [e.id, e])).values()].sort((a, b) => a.sequence - b.sequence);
}

function buildSteps(mine: AuditEvent[], cert: ActionCertificate, outcome: ExecutionEvidence | null): Step[] {
  const p = cert.payload;
  const out: Step[] = [];
  const ask = recallAsk(p.id);
  const by = (type: string) => mine.find((e) => e.event_type === type);
  const issued = by('CERTIFICATE_ISSUED');
  const verified = by('ACTION_VERIFIED');
  const decision = mine.find((e) => e.event_type === 'APPROVAL_RECORDED');
  const claimed = by('EXECUTION_CLAIMED');
  const signed = by('EXECUTION_SIGNED');
  const amount = formatUsd(p.action.amount_minor);
  const rules = p.verdict.checks.length;
  const futures = p.simulation.config.path_count.toLocaleString('en-US');
  const minutes = Math.round((Date.parse(p.expires_at) - Date.parse(p.issued_at)) / 60000);

  if (ask) {
    out.push({ key: 'asked', icon: 'chat', title: 'You asked', description: `“${ask.goal}”`, at: ask.at, events: [] });
    if (ask.suggestionsMinor.length) out.push({ key: 'suggested', icon: 'ai', title: `The AI suggested ${ask.suggestionsMinor.map(formatUsd).join(', ')}`, description: 'Untrusted suggestions; not used as authority.', at: ask.at, events: [] });
  }
  out.push({ key: 'limit', icon: 'chart', title: `The checker verified: ${amount}`, description: `Checked against ${rules} rules and ${futures} futures.`, at: verified?.created_at ?? p.issued_at, events: [verified, mine.find((e) => e.event_type === 'SIMULATION_COMPLETED')].filter(Boolean) as AuditEvent[], certificate: true });
  out.push({ key: 'signed', icon: 'doc', title: 'The independent checker signed it', description: `Certificate ${p.id.length > 16 ? `${p.id.slice(0, 9)}…${p.id.slice(-4)}` : p.id}, valid ${minutes} minutes.`, at: issued?.created_at ?? p.issued_at, events: issued ? [issued] : [], certificate: true });
  if (decision) {
    const approve = decision.details.decision === 'APPROVE';
    out.push({ key: 'decision', icon: 'user', title: approve ? 'You approved' : 'You declined', description: approve ? `Exactly ${amount} to ${shortAddress(p.action.recipient)}.` : 'Nothing was sent.', at: decision.created_at, events: [decision] });
  }
  if (claimed) out.push({ key: 'attempt', icon: 'arrow-right-up', title: signed ? 'The executor signed the attempt' : 'The executor claimed the attempt', description: 'A claim, signature or dispatch reservation alone does not prove broadcast.', at: (signed ?? claimed).created_at, events: [claimed, signed].filter(Boolean) as AuditEvent[] });
  if (claimed || outcome) out.push({ key: 'outcome', icon: outcome?.status === 'CONFIRMED' ? 'check' : 'info',
    title: outcome ? executionLabel(outcome) : 'Execution outcome unknown',
    description: outcome?.status === 'UNKNOWN' || !outcome ? 'The audit does not expose the complete current execution status. Check the original attempt; do not send again.' : `Last recorded: ${outcome.status}${outcome.execution ? ` · ${outcome.execution.confirmations} confirmations${outcome.execution.block_number !== null ? ` · block ${outcome.execution.block_number}` : ''}` : ''}. Check the original attempt for a fresh observation.`,
    at: outcome?.event.created_at ?? claimed!.created_at, events: outcome ? [outcome.event] : [] });
  return out;
}

/** Figma "16 Story": one payment, every step checked and linked to the one before it. */
export function StoryScreen() {
  const router = useRouter();
  const id = useSearchParams().get('certificate');
  const [events, setEvents] = useState<AuditEvent[] | null>(null);
  const [cert, setCert] = useState<ActionCertificate | null>(null);
  const [check, setCheck] = useState<ChainCheck | null>(null);
  const [status, setStatus] = useState<CertificateStatus | null>(null);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState<ExecutionEvidence | null>(null);
  const [proofFor, setProofFor] = useState<Step | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setError(''); setOutcome(null); setStatus(null);
    const [audit, certificate] = await Promise.all([run(() => api.GET('/audit')), run(() => api.GET('/certificates/{id}', { params: { path: { id } } }))]);
    if ((!audit.ok && audit.expired) || (!certificate.ok && certificate.expired)) { router.replace('/login'); return; }
    if (!audit.ok) { setError(audit.problem.message); return; }
    if (!certificate.ok) { setError(certificate.problem.code === 'INVALID_CERTIFICATE' ? 'No payment with that certificate exists.' : certificate.problem.message); return; }
    setEvents(audit.data); setCert(certificate.data);
    try {
      const headers = await writeHeaders();
      const checked = await run(() => api.POST('/certificates/{id}/verify', { params: { path: { id } }, headers }));
      if (checked.ok) setStatus(checked.data);
    } catch { /* the drawer then says the status could not be read */ }
    try { const chain = await verifyChain(audit.data); setCheck(chain); setOutcome(chain.ok ? await executionEvidence(audit.data, id) : null); } catch { setCheck({ ok: false, checked: 0, sequence: 0, reason: 'This browser could not compute hashes.' }); }
  }, [id, router]);
  useEffect(() => { void load(); }, [load]);

  const mine = useMemo(() => (events && cert ? related(events, cert) : []), [events, cert]);
  const steps = useMemo(() => (cert ? buildSteps(mine, cert, outcome) : []), [mine, cert, outcome]);

  if (!id) return <Page width={720}><EdgeCard where="Activity" title="No payment chosen" description="Open a payment from Activity to see its story." action={<Button kind="secondary" href="/activity">Back to Activity</Button>} /></Page>;
  if (error) return <Page width={720}><EdgeCard where="Activity" tone="danger" title="This story could not be loaded" description={error} action={<><Button kind="secondary" onClick={() => void load()}>Try again</Button><Button kind="flat" href="/activity">Back to Activity</Button></>} /></Page>;
  if (!cert || !events) return <Page width={720}><div className={styles.skeletons} role="status" aria-label="Loading"><Skeleton width={90} height={32} /><Skeleton width="60%" height={52} radius={12} />{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={56} />)}</div></Page>;

  const p = cert.payload;
  const decided = mine.find((e) => e.event_type === 'APPROVAL_RECORDED');
  const claimed = mine.some((e) => e.event_type === 'EXECUTION_CLAIMED');
  const link = explorerUrl(outcome?.execution?.tx_hash);
  const first = steps[0]?.at ?? p.issued_at, last = steps[steps.length - 1]?.at ?? p.issued_at;
  const day = new Date(first).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' });
  const title = outcome ? `${formatUsd(p.action.amount_minor)} · ${executionLabel(outcome)}` : claimed ? `${formatUsd(p.action.amount_minor)} · execution outcome unknown` : decided?.details.decision === 'DENY' ? `You declined ${formatUsd(p.action.amount_minor)}` : `${formatUsd(p.action.amount_minor)} · not sent`;

  function download() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(mine, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url; a.download = `prooffi-payment-${p.id}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  return <Page width={720}>
    <Button kind="flat" size="sm" leftIcon="chevron-left" href="/activity" className={styles.back}>Activity</Button>
    <PageHeader eyebrow={`${day}, ${hhmm(first)} to ${hhmm(last)}`} title={title} subtitle={check?.ok ? "Audit hashes verified. Execution outcomes require matching backend evidence." : "Audit integrity has not been established. Treat these records as unverified."} />
    <ol className={styles.timeline} aria-label="Steps">
      {steps.map((s, i) => <TimelineStep key={s.key} index={i} icon={s.icon} title={s.title} description={s.description} time={hhmm(s.at)} last={i === steps.length - 1}
        action={(s.certificate || s.events.length > 0) ? <TextLink onClick={() => setProofFor(s)}>Proof</TextLink> : undefined} />)}
    </ol>
    <Divider />
    <div className={styles.footer}>
      <Status state={!check ? 'pending' : check.ok ? 'pass' : 'fail'}>{mine.length} linked records · {!check ? 'checking' : check.ok ? 'intact' : `the record breaks at event ${check.sequence}`}</Status>
      <div className={styles.footerLinks}>
        {claimed && <Button kind="secondary" size="sm" href={`/approve?id=${encodeURIComponent(p.id)}`}>Check original attempt</Button>}
        {link && <Button kind="flat" size="sm" rightIcon="arrow-right-up" href={link}>View on explorer</Button>}
        <TextLink onClick={download}>Download record</TextLink>
      </div>
    </div>

    {proofFor?.certificate && <ProofDrawer open onClose={() => setProofFor(null)} certificate={cert} status={status} />}
    <Drawer open={Boolean(proofFor && !proofFor.certificate)} onClose={() => setProofFor(null)} title="Proof">
      <div className={styles.eventProof}>
        <p className="t-body-2 c-med">What was recorded for this step. Each record carries the fingerprint of the one before it.</p>
        {(proofFor?.events ?? []).map((e) => <section key={e.id} aria-label={eventLabel(e.event_type)}>
          <h3 className="t-title-1">{eventLabel(e.event_type)}</h3>
          <KeyValueList>
            <KeyValue label="Record" value={`#${e.sequence}`} />
            <KeyValue label="When" value={`${e.created_at.replace('T', ' ').slice(0, 16)} UTC`} />
            <KeyValue label="By" value={e.actor} />
            <KeyValue label="Fingerprint" mono value={<span title={e.event_hash}>{e.event_hash.slice(0, 14)}…</span>} />
            <KeyValue label="Before it" mono value={e.previous_hash ? <span title={e.previous_hash}>{e.previous_hash.slice(0, 14)}…</span> : 'First record'} />
            {Object.entries(e.details).map(([k, v]) => <KeyValue key={k} label={k.replace(/_/g, ' ')} mono={/id|hash|digest|tx/.test(k)} value={String(v)} />)}
          </KeyValueList>
        </section>)}
      </div>
    </Drawer>
  </Page>;
}
