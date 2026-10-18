import type { components } from './schema';
import { canonicalDigest } from './canonical';
import { api } from './api';
import { run } from './request';

type AuditEvent = components['schemas']['AuditEvent'];
type Execution = components['schemas']['Execution'];
export type ExecutionEvidence = { status: Execution['status'] | 'UNKNOWN'; event: AuditEvent; execution: Execution | null };
const key = (id: string) => `prooffi.execution-observation.${id}`;

/** Display cache only. Never read by approval, request identity, or execution eligibility code. */
export function rememberExecution(execution: Execution): void {
  try { sessionStorage.setItem(key(execution.id), JSON.stringify(execution)); } catch { /* unavailable storage means unknown in Activity */ }
}

/**
 * Audit receipt fields do not contain status/confirmation counts. Authenticate the complete observed backend
 * Execution against the latest execution artifact digest instead of guessing from receipt_status or a claim.
 * Storage supplies no authority: missing, changed, or stale cached bytes can only yield UNKNOWN.
 * Ledger events carry execution_id, not certificate_id; include them so reversal invalidates old confirmation.
 * Call only after verifying the full audit chain.
 */
export async function executionEvidence(events: AuditEvent[], certificateId: string, read: (id: string) => string | null | Promise<string | null> = id => sessionStorage.getItem(key(id))): Promise<ExecutionEvidence | null> {
  const ordered = [...events].sort((a, b) => a.sequence - b.sequence);
  const claims = ordered.filter(e => e.event_type === 'EXECUTION_CLAIMED' && e.details.certificate_id === certificateId);
  if (!claims.length) return null;
  const claim = claims[0];
  const id = claim.details.execution_id;
  if (claims.length !== 1 || typeof id !== 'string') return { status: 'UNKNOWN', event: claim, execution: null };
  const trail = ordered.filter(e => e.details.execution_id === id && ['EXECUTION_CLAIMED', 'EXECUTION_DISPATCH_RESERVED', 'EXECUTION_RECONCILED', 'EXECUTION_LEDGER_APPLIED', 'EXECUTION_LEDGER_REVERSED'].includes(e.event_type));
  const event = trail[trail.length - 1] ?? claim;
  const unknown: ExecutionEvidence = { status: 'UNKNOWN', event, execution: null };
  if (!['EXECUTION_CLAIMED', 'EXECUTION_DISPATCH_RESERVED', 'EXECUTION_RECONCILED'].includes(event.event_type)) return unknown;
  try {
    let execution: Execution | null = null;
    const raw = await read(id);
    if (raw) execution = JSON.parse(raw);
    // These two artifacts have a complete, deterministic public shape. Neither proves broadcast.
    if (!execution && event.event_type !== 'EXECUTION_RECONCILED') execution = {
      id, certificate_id: certificateId, status: event.event_type === 'EXECUTION_CLAIMED' ? 'CLAIMED' : 'PENDING',
      tx_hash: event.event_type === 'EXECUTION_CLAIMED' ? null : String(event.details.tx_hash), block_number: null, confirmations: 0, error: null,
    };
    if (!execution || execution.id !== id || execution.certificate_id !== certificateId ||
      !['CLAIMED', 'PENDING', 'CONFIRMED', 'FAILED', 'REORGED'].includes(execution.status) ||
      await canonicalDigest(execution) !== event.artifact_digest) return unknown;
    return { status: execution.status, event, execution };
  } catch { return unknown; }
}

export const executionLabel = (evidence: ExecutionEvidence): string => ({
  CLAIMED: 'Attempt claimed · broadcast not established',
  PENDING: 'Pending · confirmation not established',
  CONFIRMED: 'Confirmed on Base Sepolia',
  FAILED: 'The network reported a failure',
  REORGED: 'Reorged · no longer confirmed',
  UNKNOWN: 'Execution outcome unknown',
})[evidence.status];


/** Read the persisted authoritative observation. GET never reconciles or creates an attempt. */
export async function readExecutionEvidence(events: AuditEvent[], certificateId: string): Promise<ExecutionEvidence | null> {
  return executionEvidence(events, certificateId, async id => {
    const result = await run(() => api.GET('/executions/{id}', { params: { path: { id } } }));
    if (result.ok) { rememberExecution(result.data); return JSON.stringify(result.data); }
    // Mixed-version rollout/offline fallback is display only and still requires the latest audit digest.
    try { return sessionStorage.getItem(key(id)); } catch { return null; }
  });
}
