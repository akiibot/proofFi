// Isolated execution/audit inputs. These are display regressions, never live chain evidence.
import { test, expect } from '@playwright/test';
import { canonicalDigest } from '../src/lib/canonical';
import { executionEvidence } from '../src/lib/execution-evidence';
import type { components } from '../src/lib/schema';

type Event = components['schemas']['AuditEvent'];
type Execution = components['schemas']['Execution'];
const base: Execution = { id: 'isolated-execution', certificate_id: 'isolated-certificate', tx_hash: '0x' + 'ab'.repeat(32), status: 'PENDING', block_number: 100, confirmations: 1, error: null };
async function event(sequence: number, type: string, execution: Execution, details: Event['details'] = {}): Promise<Event> {
  return { id: `event-${sequence}`, sequence, event_type: type, actor: 'demo-user', created_at: '2026-10-19T00:00:00Z', previous_hash: null, event_hash: 'isolated', artifact_digest: await canonicalDigest(execution), details: { execution_id: base.id, certificate_id: base.certificate_id, ...details } };
}
async function trail(execution: Execution) {
  return [await event(1, 'EXECUTION_CLAIMED', { ...base, status: 'CLAIMED', tx_hash: null, block_number: null, confirmations: 0 }),
    await event(2, 'EXECUTION_RECONCILED', execution, { receipt_status: 1, block_number: 100, required_confirmations: 2 })];
}

test('PF-049 successful receipt with insufficient confirmations stays PENDING, never confirmed', async () => {
  const events = await trail(base);
  expect((await executionEvidence(events, base.certificate_id, () => JSON.stringify(base)))?.status).toBe('PENDING');
  expect((await executionEvidence(events, base.certificate_id, () => null))?.status).toBe('UNKNOWN');
});
test('PF-049 confirmation followed by reorg uses latest evidence, including a reorg retaining receipt_status=1', async () => {
  const confirmed: Execution = { ...base, status: 'CONFIRMED', confirmations: 2 };
  const events = await trail(confirmed);
  expect((await executionEvidence(events, base.certificate_id, () => JSON.stringify(confirmed)))?.status).toBe('CONFIRMED');
  const reorged: Execution = { ...base, status: 'REORGED', confirmations: 0 };
  events.push(await event(3, 'EXECUTION_RECONCILED', reorged, { receipt_status: 1, block_number: 100, required_confirmations: 2 }));
  expect((await executionEvidence(events, base.certificate_id, () => JSON.stringify(confirmed)))?.status).toBe('UNKNOWN');
  expect((await executionEvidence(events, base.certificate_id, () => JSON.stringify(reorged)))?.status).toBe('REORGED');
  const failed: Execution = { ...base, status: 'FAILED', confirmations: 3 };
  events.push(await event(4, 'EXECUTION_RECONCILED', failed, { receipt_status: 0 }));
  expect((await executionEvidence(events.reverse(), base.certificate_id, () => JSON.stringify(failed)))?.status).toBe('FAILED');
});
test('PF-049 ledger reversal without certificate_id invalidates cached confirmation; corrupted cache cannot supply authority', async () => {
  const confirmed: Execution = { ...base, status: 'CONFIRMED', confirmations: 2 };
  const events = await trail(confirmed);
  const reversed = await event(3, 'EXECUTION_LEDGER_REVERSED', confirmed);
  delete reversed.details.certificate_id;
  events.push(reversed);
  expect((await executionEvidence(events, base.certificate_id, () => JSON.stringify(confirmed)))?.status).toBe('UNKNOWN');
  events.pop();
  for (const raw of ['bad json', JSON.stringify({ ...confirmed, status: 'PENDING' }), JSON.stringify({ ...confirmed, certificate_id: 'other' })]) {
    expect((await executionEvidence(events, base.certificate_id, () => raw))?.status).toBe('UNKNOWN');
  }
});
test('PF-049 claim and dispatch reservation remain distinct from broadcast', async () => {
  const claimed: Execution = { ...base, status: 'CLAIMED', tx_hash: null, block_number: null, confirmations: 0 };
  const events = [await event(1, 'EXECUTION_CLAIMED', claimed)];
  expect((await executionEvidence(events, base.certificate_id, () => null))?.status).toBe('CLAIMED');
  const pending: Execution = { ...base, block_number: null, confirmations: 0 };
  events.push(await event(2, 'EXECUTION_DISPATCH_RESERVED', pending, { tx_hash: pending.tx_hash! }));
  expect((await executionEvidence(events, base.certificate_id, () => null))?.status).toBe('PENDING');
});
