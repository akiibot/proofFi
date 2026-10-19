import { test, expect } from './fixtures';
import { signIn } from './auth-helper';
import { ensureConstitution } from './api-helpers';
import { amountFrom } from '../src/screens/simulate/useSimulation';
import { bpsToPercent } from '../src/lib/units';

test('Simulate: amounts are read only when they carry a money cue', () => {
  expect(amountFrom('What if I invest $2,000?')).toBe(200000);
  expect(amountFrom('what if I put 3000 dollars in')).toBe(300000);
  expect(amountFrom('try $2.5k')).toBe(250000);
  expect(amountFrom('$1,234.5')).toBe(123450);
  expect(amountFrom('invest without risking tuition')).toBeNull();
  expect(amountFrom('in 30 days')).toBeNull();
});

test('Simulate: a typed amount is simulated against the rules and shown on the stage', async ({ page }) => {
  await signIn(page);
  await ensureConstitution(page);
  await page.goto('/simulate');
  await expect(page.getByRole('link', { name: 'Simulate' })).toHaveAttribute('aria-current', 'page');
  await expect(page.getByText('No simulation running')).toBeVisible();
  await page.getByRole('textbox', { name: 'What do you want to test?' }).fill('What if I invest $1,000?');
  await expect(page.getByText('Testing an investment of $1,000')).toBeVisible();
  const simulated = page.waitForResponse((r) => r.url().endsWith('/api/backend/simulate') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Run simulation' }).click();
  const response = await simulated;
  expect(response.status()).toBe(200);
  const run = await response.json();
  // The result is held for the display pacing (MIN_RUN_MS, about 24s), so allow for it.
  const slow = { timeout: 40_000 };
  await expect(page.getByTestId("sim-stage")).toHaveAttribute('data-mode', 'result', slow);
  await expect(page.getByTestId('sim-status')).toContainText(`Done · ${run.config.path_count.toLocaleString('en-US')} futures over ${run.config.horizon_days} days`, slow);
  const results = page.getByTestId('sim-results');
  await expect(results).toContainText('Tuition paid', slow);
  await expect(results).toContainText(`${bpsToPercent(run.metrics.goal_satisfaction_probability_bps)}%`);
  await expect(page.getByRole('link', { name: 'Check it on Ask' })).toHaveAttribute('href', '/ask?amount=1000');
});

test('Simulate: tapping a suggestion runs the simulation straight away', async ({ page }) => {
  await signIn(page);
  await ensureConstitution(page);
  await page.goto('/simulate');
  const simulated = page.waitForResponse((r) => r.url().endsWith('/api/backend/simulate') && r.request().method() === 'POST');
  await page.getByRole('button', { name: 'Invest $2,000' }).click();
  expect((await simulated).status()).toBe(200);
  await expect(page.getByTestId('sim-stage')).toHaveAttribute('data-mode', 'result', { timeout: 15_000 });
  await expect(page.getByTestId('sim-stage')).toContainText('Testing $2,000');
});

test('Simulate: the page fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto('/simulate');
  await expect(page.getByText('No simulation running')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('Simulate: its own tour opens from the account menu and walks the page', async ({ page }) => {
  await signIn(page);
  await page.goto('/simulate');
  await expect(page.getByText('No simulation running')).toBeVisible();
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('menuitem', { name: 'Take the tour' }).click();
  const tour = page.getByTestId('tour');
  await expect(tour).toBeVisible();
  await expect(page).toHaveURL(/\/simulate$/);
  await expect(tour.getByRole('heading', { name: 'Test a decision before you make it' })).toBeVisible();
  await expect(page.getByTestId('tour-count')).toHaveText('0 / 4');
  await tour.getByRole('button', { name: 'Start the tour' }).click();
  await expect(page.getByRole('dialog', { name: 'Your possible futures appear here' })).toBeVisible();
  for (let step = 1; step < 4; step++) await tour.getByRole('button', { name: 'Next' }).click();
  await tour.getByRole('button', { name: 'Finish' }).click();
  await expect(tour).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('vallet.tour.simulate.v1'))).toBe('done');
});
