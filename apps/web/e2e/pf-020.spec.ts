import { test, expect } from './fixtures';
import { signIn } from './auth-helper';
import { explainOptimizer, timeMachineLink, type OptimizerResult } from '../src/components/workspace/explain';
import type { CandidateAction } from '../src/lib/candidate';

// The planner (PF-017), optimizer (PF-010) and verifier route (PF-029) still return 501 on main.
// These tests check that the screen reports exactly that, offers the manual path, and never shows an invented result.

const TOKEN = '0x' + '1'.repeat(40);
const RECIPIENT = '0x' + '2'.repeat(40);
const base: OptimizerResult = { status: 'SAFE_ACTION', action: null, max_amount_minor: 218000, precision_minor: 1, verifier_calls: 23, limiting_checks: ['reserve_breach_probability'], next_cent_rejected: true };

test('PF-020 explains each optimizer outcome using only backend numbers', () => {
  const safe = explainOptimizer(base);
  expect(safe.title).toBe('Largest safe amount: $2,180');
  expect(safe.body).toContain('23 independent verifier checks');
  expect(safe.body).toContain('One cent more is rejected');
  expect(safe.body).toContain('reserve breach probability');
  expect(safe.tone).toBe('ok');
  const none = explainOptimizer({ ...base, status: 'NO_SAFE_ACTION', max_amount_minor: 0 });
  expect(none.title).toBe('No safe amount exists');
  expect(none.tone).toBe('warn');
  expect(explainOptimizer({ ...base, status: 'NON_MONOTONIC_FEASIBILITY' }).tone).toBe('bad');
  expect(explainOptimizer({ ...base, next_cent_rejected: false }).body).not.toContain('One cent more');
});

test('PF-020 hands a candidate to the Time Machine through the link, exactly', () => {
  const action = { amount_minor: 218050, token_address: TOKEN, recipient: RECIPIENT } as CandidateAction;
  const url = new URL(timeMachineLink(action), 'http://x');
  expect(url.pathname).toBe('/time-machine');
  expect(url.searchParams.get('amount')).toBe('2180.50');
  expect(url.searchParams.get('token')).toBe(TOKEN);
  expect(url.searchParams.get('recipient')).toBe(RECIPIENT);
  expect(new URL(timeMachineLink({ ...action, amount_minor: 218000 }), 'http://x').searchParams.get('amount')).toBe('2180');
});

test('PF-020 reports that the planner is not available yet and offers the manual path', async ({ page }) => {
  await signIn(page);
  await page.getByRole('navigation', { name: 'Screens' }).getByRole('link', { name: 'Workspace' }).click();
  const goal = page.getByLabel('What should ProofFi do?');
  await expect(goal).not.toHaveValue(''); // starts from the goal stored in the financial state
  const response = page.waitForResponse((r) => r.url().endsWith('/api/backend/plans/generate'));
  await page.getByRole('button', { name: 'Propose candidates' }).click();
  const r = await response;
  const body = await r.json();
  if (r.status() === 501) {
    const alert = page.getByRole('alert').filter({ hasText: 'The planner is not available yet.' });
    await expect(alert).toContainText(body.message);
    await expect(page.getByText('Or enter a candidate yourself')).toBeVisible();
    await expect(page.getByLabel('Amount (USD)')).toBeVisible(); // manual path is open
  } else {
    expect(r.status()).toBe(200); // once PF-017 lands, candidates come from the backend
    await expect(page.getByText(/proposed \d+ candidate/)).toBeVisible();
  }
});

test('PF-020 a manual candidate reaches the real optimizer and its answer is shown as is', async ({ page }) => {
  await signIn(page);
  await page.goto('/workspace');
  await page.getByText('Or enter a candidate yourself').click();
  await page.getByLabel('Amount (USD)').fill('1000');
  await page.getByLabel('Token address').fill(TOKEN);
  await page.getByLabel('Recipient address').fill(RECIPIENT);
  const response = page.waitForResponse((r) => r.url().endsWith('/api/backend/optimize'));
  await page.getByRole('button', { name: 'Find the largest safe amount' }).click();
  const r = await response;
  const body = await r.json();
  if (r.status() === 200) {
    await expect(page.getByTestId('optimizer-result')).toContainText(explainOptimizer(body).title);
  } else {
    const alert = page.getByRole('alert').filter({ hasText: /The optimizer (is not available yet|failed)\./ });
    await expect(alert).toContainText(body.message);
    await expect(page.getByTestId('optimizer-result')).toHaveCount(0); // no invented amount
  }
});

test('PF-020 refuses an empty goal and a malformed manual candidate locally', async ({ page }) => {
  await signIn(page);
  await page.goto('/workspace');
  let posted = 0;
  page.on('request', (r) => { if (r.method() === 'POST' && /\/(plans\/generate|intent\/parse|optimize)$/.test(r.url())) posted++; });
  await page.getByLabel('What should ProofFi do?').fill('   ');
  await page.getByRole('button', { name: 'Propose candidates' }).click();
  await expect(page.getByText('Describe what you want ProofFi to do.')).toBeVisible();
  await page.getByText('Or enter a candidate yourself').click();
  await page.getByLabel('Token address').fill('not an address');
  await page.getByRole('button', { name: 'Find the largest safe amount' }).click();
  await expect(page.getByLabel('Token address')).toHaveAttribute('aria-invalid', 'true');
  expect(posted).toBe(0);
});

test('PF-020 Time Machine opens with the candidate carried in the link', async ({ page }) => {
  await signIn(page);
  await page.goto(`/time-machine?amount=2180.50&token=${TOKEN}&recipient=${RECIPIENT}`);
  await expect(page.getByLabel('Amount (USD)')).toHaveValue('2180.50');
  await expect(page.getByLabel('Token address')).toHaveValue(TOKEN);
  await expect(page.getByLabel('Recipient address')).toHaveValue(RECIPIENT);
});

test('PF-020 Workspace fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto('/workspace');
  await expect(page.getByRole('heading', { name: 'Workspace', level: 1 })).toBeVisible();
  await page.getByText('Or enter a candidate yourself').click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
