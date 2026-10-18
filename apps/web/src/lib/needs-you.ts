import { api } from './api';
import { run, writeHeaders } from './request';
import type { components } from './schema';

type AuditEvent = components['schemas']['AuditEvent'];

export type NeedsYou = {
  certificateId: string;
  amountMinor: number;
  recipient: string;
  expiresAt: string;
  /** APPROVAL_REQUIRED waits for a decision; VALID is approved (or needs none) and waits to be sent. */
  status: 'APPROVAL_REQUIRED' | 'VALID';
};

const RECENT = 6;

/**
 * Certificates that still wait for the person: issued, not decided, not claimed for execution, not expired, and
 * confirmed current by POST /certificates/{id}/verify. The backend re-checks everything before any action;
 * this list only decides what to show on Home and in the bell. Returns null when it cannot be read.
 */
export async function loadNeedsYou(events?: AuditEvent[]): Promise<NeedsYou[] | null | 'expired'> {
  let log = events;
  if (!log) {
    const outcome = await run(() => api.GET('/audit'));
    if (!outcome.ok) return outcome.expired ? 'expired' : null;
    log = outcome.data;
  }
  const closed = new Set(log.filter((e) => e.event_type === 'EXECUTION_CLAIMED' || (e.event_type === 'APPROVAL_RECORDED' && e.details.decision === 'DENY'))
    .map((e) => String(e.details.certificate_id)));
  const approved = new Set(log.filter((e) => e.event_type === 'APPROVAL_RECORDED' && e.details.decision === 'APPROVE').map((e) => String(e.details.certificate_id)));
  const issued = log.filter((e) => e.event_type === 'CERTIFICATE_ISSUED' && typeof e.details.certificate_id === 'string')
    .sort((a, b) => b.sequence - a.sequence).map((e) => e.details.certificate_id as string)
    .filter((id) => !closed.has(id)).slice(0, RECENT);
  if (!issued.length) return [];

  const now = Date.now();
  const certificates = await Promise.all(issued.map((id) => run(() => api.GET('/certificates/{id}', { params: { path: { id } } }))));
  const open = certificates.flatMap((c) => (c.ok && Date.parse(c.data.payload.expires_at) > now ? [c.data] : []));
  if (!open.length) return [];

  let headers: Record<string, string>;
  try { headers = await writeHeaders(); } catch { return null; }
  const statuses = await Promise.all(open.map((c) => run(() => api.POST('/certificates/{id}/verify', { params: { path: { id: c.payload.id } }, headers }))));
  const result: NeedsYou[] = [];
  open.forEach((c, i) => {
    const s = statuses[i];
    if (!s.ok || !s.data.signature_valid) return;
    if (s.data.status !== 'APPROVAL_REQUIRED' && s.data.status !== 'VALID') return;
    if (s.data.status === 'VALID' && c.payload.approval.required && !approved.has(c.payload.id)) return;
    result.push({ certificateId: c.payload.id, amountMinor: c.payload.action.amount_minor, recipient: c.payload.action.recipient, expiresAt: c.payload.expires_at, status: s.data.status });
  });
  return result;
}
