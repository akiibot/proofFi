import type { Page } from '@playwright/test';
import { test, expect } from './fixtures';
import { signIn } from './auth-helper';
import { canonicalDigest } from '../src/lib/canonical';
import { bpsToPercent } from '../src/lib/units';

// Real engine output: the isolated e2e database holds one labeled test-fixture simulation config
// (e2e/seed_e2e_simulation_config.py). A Constitution is confirmed here if an earlier journey did not.

const TOKEN = '0x' + '1'.repeat(40);
const RECIPIENT = '0x' + '2'.repeat(40);
const usd = (minor: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: minor % 100 ? 2 : 0 }).format(minor / 100);

async function ensureConstitution(page: Page) {
  const state = await (await page.request.get('/api/backend/financial-state')).json();
  if (state.active_constitution_version) return;
  const session = await (await page.request.get('/api/backend/auth/session')).json();
  const headers = { Origin: 'http://127.0.0.1:3000', 'X-CSRF-Token': session.csrf_token };
  const draft = await (await page.request.post('/api/backend/constitutions/drafts', { headers, data: { base_version: null, rules: { allowed_tokens: [TOKEN], known_recipients: [RECIPIENT] } } })).json();
  expect((await page.request.post('/api/backend/constitutions/confirm', { headers, data: { draft_id: draft.id, confirmed: true, expected_policy_digest: await canonicalDigest(draft.rules) } })).status()).toBe(200);
}

async function runSimulation(page: Page, amount: string) {
  await page.getByLabel('Amount (USD)').fill(amount);
  await page.getByLabel('Token address').fill(TOKEN);
  await page.getByLabel('Recipient address').fill(RECIPIENT);
  const response = page.waitForResponse((r) => r.url().endsWith('/api/backend/simulate'));
  await page.getByRole('button', { name: 'Run simulation' }).click();
  const r = await response;
  expect(r.status()).toBe(200);
  return r.json();
}

test('PF-021 shows a real seeded simulation: metrics, stresses, paths and every assumption', async ({ page }, testInfo) => {
  await signIn(page);
  await ensureConstitution(page);
  await page.goto('/time-machine');
  const run = await runSimulation(page, '1000');
  const result = page.getByRole('region', { name: 'Simulation result' });
  await expect(result).toBeVisible();

  await expect(result.getByTestId('metric-goal')).toHaveText(`${bpsToPercent(run.metrics.goal_satisfaction_probability_bps)}%`);
  await expect(result.getByTestId('metric-breach')).toHaveText(`${bpsToPercent(run.metrics.reserve_breach_probability_bps)}%`);
  await expect(result.getByTestId('metric-p05')).toHaveText(usd(run.metrics.p05_terminal_liquidity_minor));
  await expect(result.getByTestId('metric-expected')).toHaveText(usd(run.metrics.expected_terminal_value_minor));

  await expect(result.getByTestId('liquidity-path')).toHaveCount(run.sampled_liquidity_paths_minor.length);
  await expect(result.getByRole('table', { name: 'Named stress tests' }).getByRole('row')).toHaveCount(run.stress_results.length + 1);
  for (const label of ['Market shock', 'Income delay', 'Emergency expense', 'Fee shock']) await expect(result.getByRole('rowheader', { name: label })).toBeVisible();

  await expect(result.getByTestId('config-seed')).toHaveText(String(run.config.seed));
  await expect(result.getByText('E2E TEST FIXTURE', { exact: false })).toBeVisible(); // the run says which assumptions it used
  await expect(result.getByText('This is seeded scenario arithmetic, not a prediction.')).toBeVisible();
  await expect(result.getByText(run.state_snapshot_hash)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('pf-021-time-machine.png'), fullPage: true });
});

test('PF-021 the same seed, state and amount give the same result', async ({ page }) => {
  await signIn(page);
  await ensureConstitution(page);
  await page.goto('/time-machine');
  const first = await runSimulation(page, '2500');
  const second = await runSimulation(page, '2500');
  expect(second.id).not.toBe(first.id); // a new candidate each time
  expect(second.metrics).toEqual(first.metrics);
  expect(second.sampled_liquidity_paths_minor).toEqual(first.sampled_liquidity_paths_minor);
});

test('PF-021 Time Machine fits a phone screen with a result shown', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await ensureConstitution(page);
  await page.goto('/time-machine');
  await runSimulation(page, '500');
  await expect(page.getByRole('region', { name: 'Simulation result' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
