import { test, expect } from '@playwright/test';
import { signIn } from './auth-helper';
import { buildChart } from '../src/components/simulation/chart';
import { buildCandidate } from '../src/lib/candidate';

const TOKEN = '0x' + '1'.repeat(40);
const RECIPIENT = '0x' + '2'.repeat(40);

test('PF-021 chart geometry spans every sampled path and marks $0 only when it is in range', () => {
  const chart = buildChart([[100000, 50000, -20000], [100000, 90000, 80000]], 400, 200)!;
  expect(chart.lines).toHaveLength(2);
  expect(chart.lines[0].split(' ')).toHaveLength(3);
  expect(chart.days).toBe(2);
  expect(chart.min).toBe(-20000);
  expect(chart.max).toBe(100000);
  expect(chart.zeroY).not.toBeNull();
  expect(chart.yTicks.every((t) => t.value >= chart.min && t.value <= chart.max)).toBe(true);
  expect(buildChart([[5000, 6000]])!.zeroY).toBeNull();
  expect(buildChart([[7000, 7000]])!.lines[0]).toMatch(/^[\d.]+,[\d.]+ [\d.]+,[\d.]+$/); // flat line still drawable
  expect(buildChart([])).toBeNull();
  expect(buildChart([[-30000, 0, 40000]])!.yTicks.every((t) => !Object.is(t.value, -0))).toBe(true); // never labels "-$0"
});

test('PF-021 manual candidates are validated before anything is sent', () => {
  const ok = buildCandidate({ amount: '1000', token: TOKEN.toUpperCase().replace('0X', '0x'), recipient: RECIPIENT }, 'why');
  expect(ok.ok).toBe(true);
  if (ok.ok) {
    expect(ok.action.amount_minor).toBe(100000);
    expect(ok.action.token_address).toBe(TOKEN);
    expect(ok.action.chain_id).toBe(84532);
    expect(ok.action.funding_source).toBe('owned');
  }
  const bad = buildCandidate({ amount: '0', token: 'nope', recipient: `${RECIPIENT}\n${TOKEN}` }, 'why');
  expect(bad.ok).toBe(false);
  if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(['amount', 'recipient', 'token']);
});

test('PF-021 explains that a simulation needs a confirmed Constitution (fresh seed has none)', async ({ page }) => {
  await signIn(page);
  await page.goto('/time-machine');
  await expect(page.getByText('No Constitution is active, so the backend will refuse to simulate.')).toBeVisible();
  await page.getByLabel('Token address').fill(TOKEN);
  await page.getByLabel('Recipient address').fill(RECIPIENT);
  const response = page.waitForResponse((r) => r.url().endsWith('/api/backend/simulate'));
  await page.getByRole('button', { name: 'Run simulation' }).click();
  const body = await (await response).json();
  expect((await response).status()).toBeGreaterThanOrEqual(400);
  const alert = page.getByRole('alert').filter({ hasText: 'The simulation could not run.' });
  await expect(alert).toContainText(body.message); // the backend's own reason, not a made-up one
  await expect(alert.getByRole('link', { name: 'Confirm a Constitution' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Simulation result' })).toHaveCount(0);
});

test('PF-021 rejects malformed input in the browser without calling the backend', async ({ page }) => {
  await signIn(page);
  await page.goto('/time-machine');
  let posted = 0;
  page.on('request', (r) => { if (r.url().endsWith('/api/backend/simulate')) posted++; });
  await page.getByLabel('Amount (USD)').fill('ten dollars');
  await page.getByLabel('Token address').fill('0x123');
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.getByText('Enter a dollar amount like 7000 or 7000.50.')).toBeVisible();
  await expect(page.getByLabel('Token address')).toHaveAttribute('aria-invalid', 'true');
  expect(posted).toBe(0);
});
