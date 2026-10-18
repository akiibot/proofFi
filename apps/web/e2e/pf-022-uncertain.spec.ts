// ISOLATED browser-state fixtures, not live certificates, approvals or chain evidence.
// Mutation responses are intercepted solely to exercise loss/reopening behavior.
// The real auth session is used; production authority/execution are independently tested by the backend suite.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { signIn } from './auth-helper';
import { canonicalDigest } from '../src/lib/canonical';
import type { ActionCertificate, CertificateStatus } from '../src/components/certificates/status';
import type { AuditEvent } from '../src/components/audit/chain';

const certificate = JSON.parse(readFileSync(path.resolve(__dirname, '../../../evidence/base-sepolia-application-certificate.json'), 'utf8')) as ActionCertificate;
const id = certificate.payload.id;
const executionId = 'execution-isolated-browser';
const hash = '0x' + 'ab'.repeat(32); // synthetic fixture hash; never a live receipt
const pending = { id: executionId, certificate_id: id, status: 'PENDING', tx_hash: hash, block_number: null, confirmations: 0, error: null };

async function event(kind: string, details: AuditEvent['details']): Promise<AuditEvent> {
  const unsigned = { id: 'audit-isolated-browser', sequence: 1, previous_hash: null, actor: 'demo-user', event_type: kind, artifact_digest: null, details, created_at: certificate.payload.issued_at };
  return { ...unsigned, event_hash: await canonicalDigest(unsigned) };
}

async function fixture(page: Page, initial: CertificateStatus['status'] = 'VALID') {
  let status = initial;
  let events: AuditEvent[] = [];
  let auditUnavailable = false;
  await page.route(`**/api/backend/certificates/${id}`, route => route.fulfill({ json: certificate }));
  await page.route(`**/api/backend/certificates/${id}/verify`, route => route.fulfill({ json: { certificate_id: id, status, signature_valid: true, reasons: [] } }));
  await page.route('**/api/backend/audit', route => auditUnavailable
    ? route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: 'ISOLATED audit read failure', reasons: [] } })
    : route.fulfill({ json: events }));
  return {
    async claim() {
      events = [await event('EXECUTION_CLAIMED', { certificate_id: id, certificate_hash: certificate.certificate_hash, action_digest: certificate.payload.action_digest, execution_id: executionId })];
      status = 'ALREADY_USED';
    },
    async approve() {
      events = [await event('APPROVAL_RECORDED', { certificate_id: id, action_digest: certificate.payload.action_digest, decision: 'APPROVE' })];
      status = 'VALID';
    },
    stale() { status = 'SIGNED_BUT_STALE'; },
    failAudit() { auditUnavailable = true; },
  };
}

async function open(page: Page) {
  await page.goto(`/approve?id=${id}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Show proof' }).or(page.getByRole('button', { name: 'Show proof' }))).toBeVisible();
}
async function execute(page: Page) {
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /^(Approve and send|Send)$/ }).click();
}

test('PF-022 isolated response loss preserves identity across reopening and only reconciles its recorded claim', async ({ page }) => {
  await signIn(page);
  const state = await fixture(page);
  const bodies: unknown[] = [];
  await page.route('**/api/backend/execute', async route => {
    bodies.push(route.request().postDataJSON());
    if (bodies.length === 1) { await state.claim(); await route.abort('failed'); }
    else await route.fulfill({ json: pending });
  });
  await open(page); await execute(page);
  await expect(page.getByText('We cannot confirm the result')).toBeVisible();
  await page.reload();
  const reconcile = page.getByRole('button', { name: 'Check status' });
  await expect(reconcile).toBeEnabled();
  expect(bodies).toHaveLength(1);
  await expect(page.getByRole('button', { name: /^(Approve and send|Send)$/ })).toHaveCount(0);
  await reconcile.click();
  await expect(page.getByTestId('execution-result')).toContainText('Last observed: PENDING');
  await expect(page.getByTestId('execution-result')).toContainText('does not prove broadcast');
  expect(bodies).toHaveLength(2);
  expect(bodies[1]).toEqual(bodies[0]);
  expect(bodies[0]).toMatchObject({ certificate_id: id, action_digest: certificate.payload.action_digest });
});

test('PF-022 isolated lost response without a claim never becomes a blind resend after refresh or reopening', async ({ page }) => {
  await signIn(page); await fixture(page);
  let calls = 0;
  await page.route('**/api/backend/execute', route => { calls++; return route.abort('failed'); });
  await open(page); await execute(page);
  await expect(page.getByText('We cannot confirm the result')).toBeVisible();
  await page.getByRole('button', { name: 'Refresh' }).click();
  await page.reload();
  await expect(page.getByText('We cannot confirm the result')).toBeVisible();
  await expect(page.getByRole('button', { name: /^(Approve and send|Send)$/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Check status' })).toHaveCount(0);
  expect(calls).toBe(1);
});

test('PF-022 isolated uncertain decision locks both choices across reopening until audit records the final decision', async ({ page }) => {
  await signIn(page); const state = await fixture(page, 'APPROVAL_REQUIRED');
  let decisions = 0;
  await page.route('**/api/backend/approvals', route => { decisions++; return route.abort('failed'); });
  await open(page);
  await page.getByLabel(/I approve and authorize sending exactly this/).check();
  await page.getByRole('button', { name: 'Approve and send', exact: true }).click();
  await expect(page.getByText('We cannot confirm your OK')).toBeVisible();
  await expect(page.getByLabel(/I approve and authorize sending exactly this/)).not.toBeChecked();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Approve and send', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Deny', exact: true })).toBeDisabled();
  await state.approve();
  await page.getByRole('button', { name: 'Check again' }).click();
  await expect(page.getByText('Approved, not sent')).toBeVisible();
  await expect(page.getByText('Your OK is recorded.')).toBeVisible();
  expect(decisions).toBe(1);
});

test('PF-022 isolated successful execution response survives a failed subsequent status/audit refresh', async ({ page }) => {
  await signIn(page); const state = await fixture(page);
  await page.route('**/api/backend/execute', async route => {
    await state.claim(); state.failAudit();
    await route.fulfill({ json: { ...pending, status: 'CONFIRMED', block_number: 10, confirmations: 2 } });
  });
  await open(page); await execute(page);
  await expect(page.getByTestId('execution-result')).toContainText('Last observed: CONFIRMED');
  await expect(page.getByRole('alert').filter({ hasText: 'could not be checked' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'View on explorer' })).toHaveAttribute('href', `https://sepolia.basescan.org/tx/${hash}`);
  await expect(page.getByRole('button', { name: /^(Approve and send|Send)$/ })).toHaveCount(0);
});

test('PF-022 isolated corrupted retained identity refuses a new execution instead of replacing its key', async ({ page }) => {
  await signIn(page); await fixture(page);
  await page.evaluate(({ id, digest }) => sessionStorage.setItem(`prooffi.execute.${id}`, JSON.stringify({ certificate_id: id, action_digest: digest, idempotency_key: 'exec-corrupted-identity-001' })), { id, digest: 'b'.repeat(64) });
  let calls = 0;
  await page.route('**/api/backend/execute', route => { calls++; return route.abort('failed'); });
  await open(page);
  await expect(page.getByText('The original request identity cannot be read safely.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: /^(Approve and send|Send)$/ })).toHaveCount(0);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  expect(calls).toBe(0);
});


test('PF-049 combined consent cannot execute after fresh eligibility becomes stale', async ({ page }) => {
  await signIn(page); const state = await fixture(page, 'APPROVAL_REQUIRED');
  let executeCalls = 0;
  await page.route('**/api/backend/execute', route => { executeCalls++; return route.abort('failed'); });
  await page.route('**/api/backend/approvals', async route => {
    expect(route.request().postDataJSON()).toEqual({ certificate_id: id, action_digest: certificate.payload.action_digest, decision: 'APPROVE' });
    await state.approve(); state.stale();
    await route.fulfill({ json: { id: 'isolated-approval', certificate_id: id, action_digest: certificate.payload.action_digest, decision: 'APPROVE' } });
  });
  await open(page); await execute(page);
  await expect(page.getByText('Your money changed after this was signed')).toBeVisible();
  expect(executeCalls).toBe(0);
});

test('PF-049 reorged execution retains reconciliation of the identical original attempt', async ({ page }) => {
  await signIn(page); const state = await fixture(page);
  const bodies: unknown[] = [];
  await page.route('**/api/backend/execute', async route => {
    bodies.push(route.request().postDataJSON()); await state.claim();
    await route.fulfill({ json: bodies.length === 1 ? { ...pending, status: 'REORGED' } : pending });
  });
  await open(page); await execute(page);
  await expect(page.getByText('The network replaced the block')).toBeVisible();
  await page.getByRole('button', { name: 'Check status' }).click();
  await expect(page.getByTestId('execution-result')).toContainText('Last observed: PENDING');
  expect(bodies).toHaveLength(2); expect(bodies[1]).toEqual(bodies[0]);
  await expect(page.getByRole('button', { name: /^(Approve and send|Send)$/ })).toHaveCount(0);
});
