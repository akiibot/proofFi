import { test, expect } from './fixtures';
import { signIn } from './auth-helper';
import { approvalRequest, canApprove, canExecute, executeRequest, explorerUrl, newIdempotencyKey } from '../src/components/approval/requests';
import type { ActionCertificate, CertificateStatus } from '../src/components/certificates/status';

// The fresh isolated browser database has no issued certificate; these refusals do not fabricate one.
// These checks cover the request builders and gates directly, and the real backend refusals end to end.

const certificate = { payload: { id: 'cert-1', action_digest: 'a'.repeat(64) } } as unknown as ActionCertificate;
const status = (s: CertificateStatus['status'], signature_valid = true): CertificateStatus => ({ certificate_id: 'cert-1', status: s, signature_valid, reasons: [] });
const ORIGIN = 'http://127.0.0.1:3000';

test('PF-022 approval and execution requests bind the exact certificate and action digest', () => {
  expect(approvalRequest(certificate, 'APPROVE')).toEqual({ certificate_id: 'cert-1', action_digest: 'a'.repeat(64), decision: 'APPROVE' });
  expect(approvalRequest(certificate, 'DENY').decision).toBe('DENY');
  expect(executeRequest(certificate, 'exec-1')).toEqual({ certificate_id: 'cert-1', action_digest: 'a'.repeat(64), idempotency_key: 'exec-1' });
});

test('PF-022 idempotency keys always meet the backend length rule and never repeat', () => {
  const keys = Array.from({ length: 50 }, () => newIdempotencyKey());
  expect(keys.every((k) => k.length >= 16 && k.length <= 100)).toBe(true);
  expect(new Set(keys).size).toBe(keys.length);
});

test('PF-022 approval and execution are offered only for the right signed status', () => {
  expect(canApprove(status('APPROVAL_REQUIRED'))).toBe(true);
  expect(canApprove(status('APPROVAL_REQUIRED', false))).toBe(false);
  for (const s of ['VALID', 'SIGNED_BUT_STALE', 'TAMPERED', 'EXPIRED', 'ALREADY_USED'] as const) expect(canApprove(status(s))).toBe(false);
  expect(canExecute(status('VALID'))).toBe(true);
  expect(canExecute(status('VALID', false))).toBe(false);
  for (const s of ['APPROVAL_REQUIRED', 'SIGNED_BUT_STALE', 'TAMPERED', 'EXPIRED', 'ALREADY_USED'] as const) expect(canExecute(status(s))).toBe(false);
  expect(canApprove(null)).toBe(false);
  expect(canExecute(null)).toBe(false);
});

test('PF-022 explorer links exist only for well-formed transaction hashes', () => {
  const hash = '0x' + 'ab'.repeat(32);
  expect(explorerUrl(hash)).toBe(`https://sepolia.basescan.org/tx/${hash}`);
  for (const bad of [null, undefined, '', '0x123', 'ab'.repeat(32), `${hash}00`, '0x' + 'zz'.repeat(32)]) expect(explorerUrl(bad)).toBeNull();
});

test('PF-022 opening an unknown certificate shows the real backend answer and no decision panels', async ({ page }) => {
  await signIn(page);
  await page.getByRole('navigation', { name: 'Screens' }).getByRole('link', { name: 'Certificates' }).click();
  await page.getByLabel('Certificate ID').fill('cert-unknown');
  const response = page.waitForResponse((r) => r.url().endsWith('/api/backend/certificates/cert-unknown'));
  await page.getByRole('button', { name: 'Open certificate' }).click();
  expect((await response).status()).toBe(409);
  await expect(page.getByRole('alert').filter({ hasText: 'No certificate with ID "cert-unknown" exists.' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Your decision' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Execution' })).toHaveCount(0);
});

test('PF-022 malformed certificate IDs are refused before any request', async ({ page }) => {
  await signIn(page);
  await page.goto('/certificates');
  let calls = 0;
  page.on('request', (r) => { if (r.url().includes('/api/backend/certificates/')) calls++; });
  await page.getByLabel('Certificate ID').fill('cert 1; drop');
  await page.getByRole('button', { name: 'Open certificate' }).click();
  await expect(page.getByText('A certificate ID uses only letters, numbers, - and _')).toBeVisible();
  expect(calls).toBe(0);
});

test('PF-022 the real backend refuses approval and execution without a genuine certificate', async ({ page }) => {
  await signIn(page);
  const session = await (await page.request.get('/api/backend/auth/session')).json();
  const headers = { Origin: ORIGIN, 'X-CSRF-Token': session.csrf_token };
  const approval = await page.request.post('/api/backend/approvals', { headers, data: approvalRequest(certificate, 'APPROVE') });
  expect(approval.status()).toBe(409);
  expect((await approval.json()).code).toBe('INVALID_CERTIFICATE');
  const execution = await page.request.post('/api/backend/execute', { headers, data: executeRequest(certificate, newIdempotencyKey()) });
  const refusal = await execution.json();
  if (execution.status() === 501) {
    expect(refusal.code).toBe('NOT_IMPLEMENTED');
    expect(refusal.message).toContain('explicit operator enablement'); // intentional default-off gate
  } else {
    expect(execution.status()).toBe(409);
    expect(refusal.code).toBe('INVALID_CERTIFICATE');
  }
});
