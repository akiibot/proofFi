'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';
import { formatUsd, shortAddress } from './format';
import { run } from './request';
import { readExecutionEvidence, executionLabel, type ExecutionEvidence } from './execution-evidence';
import type { components } from './schema';
import { verifyChain, type ChainCheck } from '@/components/audit/chain';
import type { IconName } from '@/ui/Icon';

export type AuditEvent = components['schemas']['AuditEvent'];
export type ActionCertificate = components['schemas']['ActionCertificate'];

export type Category = 'needs-you' | 'money' | 'blocked' | 'rules' | 'other';

/** One thing that happened, in plain words. Built only from recorded audit events and the certificates they name. */
export type ActivityItem = {
  key: string;
  category: Category;
  icon: IconName;
  title: string;
  description: string;
  at: string;
  href?: string;
  certificateId?: string;
  needsYou?: boolean;
};

const MAX_CERTIFICATES = 24;
const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

function changeCount(drafted: AuditEvent | undefined): number | null {
  const text = drafted?.details.changes;
  if (typeof text !== 'string' || !text.trim()) return null;
  return text.split(';').map((s) => s.trim()).filter(Boolean).length;
}

/**
 * Turns the audit log into readable items, newest first. Certificate amounts and recipients come from the signed
 * certificate payloads; anything that cannot be read is described without inventing a value.
 */
export function buildActivity(events: AuditEvent[], certificates: Map<string, ActionCertificate>, open: Set<string>, outcomes = new Map<string, ExecutionEvidence>()): ActivityItem[] {
  const ordered = [...events].sort((a, b) => a.sequence - b.sequence);
  const items: ActivityItem[] = [];
  const byCert = new Map<string, AuditEvent[]>();
  for (const e of ordered) {
    const id = e.details.certificate_id;
    if (typeof id === 'string') byCert.set(id, [...(byCert.get(id) ?? []), e]);
  }

  for (const e of ordered) {
    const at = e.created_at;
    switch (e.event_type) {
      case 'CERTIFICATE_ISSUED': {
        const id = String(e.details.certificate_id);
        const cert = certificates.get(id);
        const trail = byCert.get(id) ?? [];
        const amount = cert ? formatUsd(cert.payload.action.amount_minor) : 'A payment';
        const to = cert ? shortAddress(cert.payload.action.recipient) : 'a recipient';
        const outcome = outcomes.get(id);
        const claimed = trail.some((t) => t.event_type === 'EXECUTION_CLAIMED');
        const denied = trail.some((t) => t.event_type === 'APPROVAL_RECORDED' && t.details.decision === 'DENY');
        const href = `/activity/story?certificate=${encodeURIComponent(id)}`;
        if (outcome || claimed) {
          items.push({ key: e.id, category: 'money', icon: outcome?.status === 'CONFIRMED' ? 'check' : 'info',
            title: `${amount} to ${to} · ${outcome ? executionLabel(outcome) : 'Execution outcome unknown'}`,
            description: `Last recorded execution evidence · ${day(outcome?.event.created_at ?? at)}. Open the record to review or check the original attempt.`,
            at: outcome?.event.created_at ?? at, href, certificateId: id });
        } else if (denied) {
          items.push({ key: e.id, category: 'blocked', icon: 'cross', title: `You declined sending ${amount} to ${to}`, description: `Nothing was sent · ${day(at)}`, at, href, certificateId: id });
        } else if (open.has(id)) {
          items.push({ key: e.id, category: 'needs-you', icon: 'bell', title: cert?.payload.approval.required ? 'Approval waiting' : 'Ready to send', description: `Send ${amount} to ${to}`, at, href: `/approve?id=${encodeURIComponent(id)}`, certificateId: id, needsYou: true });
        } else {
          items.push({ key: e.id, category: 'other', icon: 'doc', title: `Certificate for ${amount} to ${to}`, description: `Not sent. It expired or no longer matches your money or rules · ${day(at)}`, at, href, certificateId: id });
        }
        break;
      }
      case 'ATTACK_EXECUTOR_REJECTED':
        items.push({ key: e.id, category: 'blocked', icon: 'lock', title: 'Security test: the AI was tricked, your money was not', description: `Borrowed-money transfer refused · nothing signed · ${day(at)}`, at, href: '/security' });
        break;
      case 'ACTION_REJECTED':
        if (!ordered.some((x) => x.event_type === 'ATTACK_EXECUTOR_REJECTED' && x.details.verification_id === e.details.verification_id)) {
          items.push({ key: e.id, category: 'blocked', icon: 'cross', title: 'The checker refused a proposal', description: `Your rules failed, so no certificate was issued · ${day(at)}`, at });
        }
        break;
      case 'CONSTITUTION_CONFIRMED': {
        const version = Number(e.details.version);
        const drafted = ordered.find((x) => x.event_type === 'CONSTITUTION_DRAFTED' && x.details.draft_id === e.details.draft_id);
        const n = changeCount(drafted);
        items.push({ key: e.id, category: 'rules', icon: 'settings', title: version === 1 ? 'You set your first rules' : `You updated your rules to version ${version}`, description: `${n === null ? 'Confirmed by you' : version === 1 ? `${n} values set` : `${n} value${n === 1 ? '' : 's'} changed`} · ${day(at)}`, at, href: '/rules/history' });
        break;
      }
      case 'EMERGENCY_EXPENSE_RECORDED':
        items.push({ key: e.id, category: 'other', icon: 'wallet', title: `You recorded a ${formatUsd(Number(e.details.amount_minor))} expense`, description: `Your rules did not change; what is safe was checked again · ${day(at)}`, at, href: '/' });
        break;
      case 'DEMO_RESET':
        items.push({ key: e.id, category: 'other', icon: 'info', title: 'The demo was reset', description: day(at), at });
        break;
    }
  }
  return items.sort((a, b) => b.at.localeCompare(a.at));
}

/** Certificate IDs referenced by issuance events, newest first, without duplicates. */
export function referencedCertificates(events: AuditEvent[]): string[] {
  return [...new Set(events.filter((e) => e.event_type === 'CERTIFICATE_ISSUED' && typeof e.details.certificate_id === 'string')
    .sort((a, b) => b.sequence - a.sequence).map((e) => e.details.certificate_id as string))].slice(0, MAX_CERTIFICATES);
}

export type ActivityData = { events: AuditEvent[]; items: ActivityItem[]; check: ChainCheck | null; certificates: Map<string, ActionCertificate> };
type Loaded = { events: AuditEvent[]; check: ChainCheck | null; certificates: Map<string, ActionCertificate>; outcomes: Map<string, ExecutionEvidence> };

/** Loads the audit log, recomputes its hash chain in the browser, and reads the certificates it names. */
export function useActivity(openCertificates: string[] = []) {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState('');
  const latest = useRef(0);
  const openKey = openCertificates.join(',');

  const load = useCallback(async () => {
    const id = ++latest.current;
    setError('');
    const outcome = await run(() => api.GET('/audit'));
    if (id !== latest.current) return;
    if (!outcome.ok) { if (outcome.expired) { router.replace('/login'); return; } setError(outcome.problem.message); return; }
    const events = outcome.data;
    const ids = referencedCertificates(events);
    const reads = await Promise.all(ids.map((cid) => run(() => api.GET('/certificates/{id}', { params: { path: { id: cid } } }))));
    const certificates = new Map<string, ActionCertificate>();
    reads.forEach((r) => { if (r.ok) certificates.set(r.data.payload.id, r.data); });
    let check: ChainCheck | null = null;
    try { check = await verifyChain(events); } catch { check = { ok: false, checked: 0, sequence: 0, reason: 'This browser could not compute hashes.' }; }
    if (id !== latest.current) return;
    const outcomes = new Map<string, ExecutionEvidence>();
    if (check?.ok) for (const cid of ids) {
      const outcome = await readExecutionEvidence(events, cid);
      if (outcome) outcomes.set(cid, outcome);
    }
    if (id !== latest.current) return;
    setLoaded({ events, check, certificates, outcomes });
  }, [router]);

  useEffect(() => { void load(); }, [load]);
  const data = useMemo<ActivityData | null>(() => (loaded ? { ...loaded, items: buildActivity(loaded.events, loaded.certificates, new Set(openKey ? openKey.split(',') : []), loaded.outcomes) } : null), [loaded, openKey]);
  return { data, error, reload: load };
}
