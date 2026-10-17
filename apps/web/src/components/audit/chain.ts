import { canonicalDigest } from '@/lib/canonical';
import type { components } from '@/lib/schema';

export type AuditEvent = components['schemas']['AuditEvent'];

export type ChainCheck =
  | { ok: true; checked: number }
  | { ok: false; checked: number; sequence: number; reason: string };

/**
 * Recomputes the hash chain in the browser, the same way services/api/app/audit/append.py builds it:
 * event_hash = SHA-256(canonical JSON of the event without event_hash), previous_hash = the prior event's hash,
 * sequence = 1, 2, 3… This detects ordinary edits; it cannot prove a database administrator did not rewrite the whole chain.
 */
export async function verifyChain(events: AuditEvent[]): Promise<ChainCheck> {
  const ordered = [...events].sort((a, b) => a.sequence - b.sequence);
  let previous: string | null = null;
  for (let index = 0; index < ordered.length; index++) {
    const event = ordered[index];
    if (event.sequence !== index + 1) return { ok: false, checked: index, sequence: event.sequence, reason: `Expected event ${index + 1} but found ${event.sequence}; an event is missing or duplicated.` };
    if (event.previous_hash !== previous) return { ok: false, checked: index, sequence: event.sequence, reason: 'Its link to the previous event does not match.' };
    const { event_hash, ...unsigned } = event;
    if ((await canonicalDigest(unsigned)) !== event_hash) return { ok: false, checked: index, sequence: event.sequence, reason: 'Its contents do not match its recorded hash.' };
    previous = event_hash;
  }
  return { ok: true, checked: ordered.length };
}

const LABELS: Record<string, string> = {
  CONSTITUTION_DRAFTED: 'Constitution draft saved',
  CONSTITUTION_CONFIRMED: 'Constitution confirmed',
  SIMULATION_COMPLETED: 'Simulation completed',
  APPROVAL_RECORDED: 'Approval recorded',
  APPROVAL_REJECTED: 'Approval rejected',
  CERTIFICATE_ISSUED: 'Certificate issued',
  EXECUTION_CLAIMED: 'Execution claimed',
  EXECUTION_CONFIRMED: 'Execution confirmed',
  EXECUTION_FAILED: 'Execution failed',
  ACTION_REJECTED: 'Action rejected',
};

/** A readable name for an event type. Unknown types are shown in plain words rather than hidden. */
export function eventLabel(type: string): string {
  return LABELS[type] ?? type.toLowerCase().replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
