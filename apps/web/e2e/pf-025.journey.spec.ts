import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { readFileSync } from 'node:fs';
import { signIn } from './auth-helper';
import { canonicalDigest } from '../src/lib/canonical';
import { getJson } from './api-helpers';

// Runs after the Rules and Ask journeys, so the real audit log has events. If it runs alone,
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

async function openActivity(page: Page) {
  await signIn(page);
  await ensureEvents(page);
  await page.goto('/activity');
  await expect(page.getByTestId('chain-status')).toBeVisible();
  return (await getJson(page, 'audit')) as { event_type: string; sequence: number; event_hash: string }[];
}

test('PF-025 shows what happened, newest first, with a browser-verified hash chain', async ({ page }, testInfo) => {
  const events = await openActivity(page);
  expect(events.length).toBeGreaterThan(0);
  await expect(page.getByTestId('chain-status')).toHaveText(`Record intact · all ${events.length} events re-checked`);
  const rows = page.getByTestId('activity-row');
  await expect(rows.first()).toBeVisible();
  const times = await rows.evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-at') ?? ''));
  expect(times.length).toBeGreaterThan(0);
  expect(times).toEqual([...times].sort().reverse()); // newest first
  await page.screenshot({ path: testInfo.outputPath('pf-025-audit.png'), fullPage: true });
});

test('PF-025 filtering shows only that kind of event and "All" brings everything back', async ({ page }) => {
  await openActivity(page);
  const rows = page.getByTestId('activity-row');
  await expect(rows.first()).toBeVisible();
  const all = await rows.count();
  await page.getByRole('button', { name: 'Rule changes' }).click();
  await expect(page.getByRole('button', { name: 'Rule changes' })).toHaveAttribute('aria-pressed', 'true');
  const ruleRows = await rows.allInnerTexts();
  expect(ruleRows.length).toBeGreaterThan(0);
  expect(ruleRows.length).toBeLessThanOrEqual(all);
  for (const text of ruleRows) expect(text).toMatch(/rules/i);
  await page.getByRole('button', { name: 'All' }).click();
  await expect(rows).toHaveCount(all);
});

test('PF-025 the downloaded record is exactly the backend log', async ({ page }) => {
  const events = await openActivity(page);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download' }).click();
  const file = await (await download).path();
  const saved = JSON.parse(readFileSync(file, 'utf8'));
  expect(saved).toEqual(events);
  // The exported events still verify independently of the page.
  for (const event of saved) { const { event_hash, ...rest } = event; expect(await canonicalDigest(rest)).toBe(event_hash); }
});

test('PF-025 Activity fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openActivity(page);
  await expect(page.getByTestId('chain-status')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
