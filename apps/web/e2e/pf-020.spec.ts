import { test, expect } from './fixtures';
import { signIn } from './auth-helper';
import { explainOptimizer, timeMachineLink, type OptimizerResult } from '../src/components/workspace/explain';
import type { CandidateAction } from '../src/lib/candidate';

// Browser tests use the real deterministic demo planner on the fresh unconfirmed seed.
// Clarification and optimizer refusals are genuine backend results, never fabricated safe actions.

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

test('PF-020 real demo planner clarification preserves the manual path without inventing candidates', async ({ page }) => {
  await signIn(page);
  await page.getByRole('navigation', { name: 'Screens' }).getByRole('link', { name: 'Workspace' }).click();
  await expect(page.getByLabel('What should ProofFi do?')).not.toHaveValue('');
  const response = page.waitForResponse(r => r.url().endsWith('/api/backend/plans/generate'));
  await page.getByRole('button', { name: 'Propose candidates' }).click();
  const r = await response;
  expect(r.status()).toBe(200);
  const body = await r.json();
  expect(body.mode).toBe('deterministic_demo');
  expect(body.candidates).toEqual([]);
  expect(body.clarification).toContain('Confirm a Financial Constitution before generating investment candidates.');
  await expect(page.getByText('The planner needs more detail:')).toBeVisible();
  for (const reason of body.clarification) await expect(page.getByText(reason, { exact: true })).toBeVisible();
  await expect(page.getByText('Or enter a candidate yourself')).toBeVisible();
  await page.getByText('Or enter a candidate yourself').click();
  await expect(page.getByLabel('Amount (USD)')).toBeVisible();
  await expect(page.getByTestId('optimizer-result')).toHaveCount(0);
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
  expect(r.status()).toBe(503);
  expect(body.code).toBe('UNAVAILABLE');
  expect(body.message).toBe('Confirmed Constitution required');
  const alert = page.getByRole('alert').filter({ hasText: 'The optimizer failed.' });
  await expect(alert).toContainText(body.message);
  await expect(page.getByTestId('optimizer-result')).toHaveCount(0);

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


test('PF-020 reports an intent transport failure even when candidate planning succeeds', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/backend/intent/parse', (route) => route.abort('failed'));
  await page.goto('/workspace');
  await expect(page.getByLabel('What should ProofFi do?')).not.toHaveValue('');
  await page.getByRole('button', { name: 'Propose candidates' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Goal interpretation failed.' })).toContainText('Failed to fetch');
  await expect(page.getByText('The planner needs more detail:')).toBeVisible();
  await expect(page.getByTestId('optimizer-result')).toHaveCount(0);
});
