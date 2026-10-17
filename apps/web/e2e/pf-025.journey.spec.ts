import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { readFileSync } from 'node:fs';
import { signIn } from './auth-helper';
import { canonicalDigest } from '../src/lib/canonical';

// Runs after the Constitution and Time Machine journeys, so the real audit log has events. If it runs alone,
// it records one draft through the real API first.

async function ensureEvents(page: Page) {
  const events = await (await page.request.get('/api/backend/audit')).json();
  if (events.length > 0) return;
  const session = await (await page.request.get('/api/backend/auth/session')).json();
  const state = await (await page.request.get('/api/backend/financial-state')).json();
  const headers = { Origin: 'http://127.0.0.1:3000', 'X-CSRF-Token': session.csrf_token };
  const draft = await page.request.post('/api/backend/constitutions/drafts', { headers, data: { base_version: state.active_constitution_version, rules: { allowed_tokens: [], known_recipients: [] } } });
  expect(draft.status()).toBe(200);
}

async function openAudit(page: Page) {
  await signIn(page);
  await ensureEvents(page);
  const response = page.waitForResponse((r) => r.url().endsWith('/api/backend/audit'));
  await page.goto('/audit');
  return (await response).json() as Promise<{ event_type: string; sequence: number; event_hash: string }[]>;
}

test('PF-025 shows every recorded event, newest first, with a browser-verified hash chain', async ({ page }, testInfo) => {
  const events = await openAudit(page);
  expect(events.length).toBeGreaterThan(0);
  const table = page.getByRole('table', { name: 'Audit events' });
  await expect(table.getByRole('row')).toHaveCount(events.length + 1);
  await expect(page.getByTestId('chain-status')).toHaveText(`Hash chain intact: all ${events.length} events recomputed and linked.`);
  const newest = Math.max(...events.map((e) => e.sequence));
  await expect(table.getByRole('row').nth(1).getByRole('cell').first()).toHaveText(String(newest));
  await page.screenshot({ path: testInfo.outputPath('pf-025-audit.png'), fullPage: true });
});

test('PF-025 filtering by event type shows only that type', async ({ page }) => {
  const events = await openAudit(page);
  const type = events[0].event_type;
  const select = page.getByLabel('Show');
  await select.selectOption({ value: type });
  await expect(page.getByRole('table', { name: 'Audit events' }).getByRole('row')).toHaveCount(events.filter((e) => e.event_type === type).length + 1);
  await select.selectOption({ value: 'all' });
  await expect(page.getByRole('table', { name: 'Audit events' }).getByRole('row')).toHaveCount(events.length + 1);
});

test('PF-025 the downloaded audit file is exactly the backend log', async ({ page }) => {
  const events = await openAudit(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download JSON' }).click();
  const file = await (await download).path();
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  expect(saved).toEqual(events);
  // The exported events still verify independently of the page.
  for (const event of saved) { const { event_hash, ...rest } = event; expect(await canonicalDigest(rest)).toBe(event_hash); }
});

test('PF-025 audit screen fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAudit(page);
  await expect(page.getByTestId('chain-status')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
