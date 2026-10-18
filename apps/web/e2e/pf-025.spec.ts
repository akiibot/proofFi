import { test, expect } from './fixtures';
import { signIn } from './auth-helper';
import { getJson } from './api-helpers';
import { canonicalDigest } from '../src/lib/canonical';
import { verifyChain, eventLabel, type AuditEvent } from '../src/components/audit/chain';
import { STATUS_MEANING, statusMeaning } from '../src/components/certificates/status';

async function chain(count: number): Promise<AuditEvent[]> {
  const events: AuditEvent[] = [];
  let previous: string | null = null;
  for (let i = 1; i <= count; i++) {
    const unsigned = { id: `audit-${i}`, sequence: i, previous_hash: previous, actor: 'demo-user', event_type: 'CONSTITUTION_DRAFTED', artifact_digest: null, details: { draft_id: `d${i}` }, created_at: '2026-10-16T00:00:00Z' };
    const event_hash = await canonicalDigest(unsigned);
    events.push({ ...unsigned, event_hash });
    previous = event_hash;
  }
  return events;
}

test('PF-025 browser chain check accepts an intact chain and pinpoints edits, gaps and broken links', async () => {
  const events = await chain(4);
  expect(await verifyChain(events)).toEqual({ ok: true, checked: 4 });
  expect(await verifyChain([...events].reverse())).toEqual({ ok: true, checked: 4 }); // order of the API list does not matter
  expect(await verifyChain([])).toEqual({ ok: true, checked: 0 });

  const edited = events.map((e) => (e.sequence === 3 ? { ...e, details: { draft_id: 'changed' } } : e));
  expect(await verifyChain(edited)).toMatchObject({ ok: false, sequence: 3, reason: expect.stringContaining('do not match its recorded hash') });
  const gap = events.filter((e) => e.sequence !== 2);
  expect(await verifyChain(gap)).toMatchObject({ ok: false, sequence: 3, reason: expect.stringContaining('missing or duplicated') });
  const relinked = events.map((e) => (e.sequence === 4 ? { ...e, previous_hash: events[0].event_hash } : e));
  expect(await verifyChain(relinked)).toMatchObject({ ok: false, sequence: 4, reason: expect.stringContaining('link to the previous event') });
});

test('PF-025 every certificate status has a plain explanation and unknown ones are flagged', () => {
  for (const status of ['VALID', 'SIGNED_BUT_STALE', 'TAMPERED', 'EXPIRED', 'ALREADY_USED', 'APPROVAL_REQUIRED']) expect(STATUS_MEANING[status as keyof typeof STATUS_MEANING].meaning.length).toBeGreaterThan(20);
  expect(statusMeaning('SOMETHING_NEW').tone).toBe('bad');
  expect(eventLabel('CONSTITUTION_CONFIRMED')).toBe('Constitution confirmed');
  expect(eventLabel('BRAND_NEW_EVENT')).toBe('Brand new event');
});

test('PF-025 Activity shows exactly what the backend recorded and re-checks the chain in the browser', async ({ page }) => {
  await signIn(page);
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Activity' }).click();
  await expect(page.getByTestId('chain-status')).toBeVisible();
  const events = await getJson(page, 'audit');
  await expect(page.getByTestId('chain-status')).toContainText(`Record intact · all ${events.length} events re-checked`);
  if (events.length === 0) await expect(page.getByText('Nothing has happened yet.')).toBeVisible();
  // The download is the backend's own record, byte for byte in content.
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download' }).click();
  const file = await (await download).createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of file) chunks.push(chunk as Buffer);
  expect(JSON.parse(Buffer.concat(chunks).toString('utf8'))).toEqual(events);
});

test('PF-025 Activity says so when the record does not add up', async ({ page }) => {
  await signIn(page);
  const events = await chain(3);
  // Rendering fixture: one event is edited after the fact, which the browser must detect from the hashes alone.
  const edited = events.map((e) => (e.sequence === 2 ? { ...e, details: { draft_id: 'changed' } } : e));
  await page.route('**/api/backend/audit', (route) => route.fulfill({ json: edited }));
  await page.goto('/activity');
  await expect(page.getByTestId('chain-status')).toContainText('Record broken at event 2');
  await expect(page.getByText('The record does not add up')).toBeVisible();
  await expect(page.getByText('Record intact')).toHaveCount(0);
});

test('PF-025 checking a certificate that does not exist uses the real backend answer', async ({ page }) => {
  await signIn(page, '/activity/check');
  const response = page.waitForResponse((r) => r.url().endsWith('/api/backend/certificates/cert-does-not-exist/verify'));
  await page.getByLabel('Certificate ID').fill('cert-does-not-exist');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  const r = await response;
  expect(r.status()).toBe(409);
  expect((await r.json()).code).toBe('INVALID_CERTIFICATE');
  await expect(page.getByRole('alert').filter({ hasText: 'No certificate with ID "cert-does-not-exist" exists.' })).toBeVisible();
  await expect(page.getByTestId('certificate-status')).toHaveCount(0); // no status is invented
});

test('PF-025 the check refuses malformed IDs without calling the backend', async ({ page }) => {
  await signIn(page, '/activity/check');
  let calls = 0;
  page.on('request', (r) => { if (r.url().includes('/api/backend/certificates/')) calls++; });
  await page.getByLabel('Certificate ID').fill('../../etc/passwd');
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  await expect(page.getByText('A certificate ID uses only letters, numbers, - and _')).toBeVisible();
  expect(calls).toBe(0);
});
