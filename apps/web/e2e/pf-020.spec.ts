import { test, expect } from './fixtures';
import { signIn } from './auth-helper';
import { limitSentence, reasonText, stressRows, type OptimizerResult, type SimulationRun } from '../src/screens/ask/explain';

// Browser tests use the real deterministic demo planner on the fresh unconfirmed seed.
// Clarification and optimizer refusals are genuine backend results, never fabricated safe actions.

const TOKEN = '0x' + '1'.repeat(40);
const RECIPIENT = '0x' + '2'.repeat(40);
const rules = { tuition_reserve_minor: 700000, emergency_floor_minor: 200000, autonomy_limit_minor: 15000, new_recipient_requires_approval: true as const, allowed_chain_id: 84532 as const, allowed_tokens: [] as string[], known_recipients: [] as string[], blocked_recipients: [] as string[], high_risk_concentration_bps: 2500, goal_satisfaction_min_bps: 9500, reserve_breach_max_bps: 500, borrowed_funding_forbidden: true as const };
const base: OptimizerResult = { status: 'SAFE_ACTION', action: null, max_amount_minor: 218000, precision_minor: 1, verifier_calls: 23, limiting_checks: ['HIGH_RISK_CONCENTRATION_EXCEEDED'], next_cent_rejected: true };

test('PF-020 explains each optimizer outcome using only backend values', () => {
  const safe = limitSentence(base, rules);
  expect(safe).toContain('more would put over 25% of your free money in high-risk assets (your Rule VII)');
  expect(safe).toContain('One cent more is refused.');
  expect(limitSentence({ ...base, next_cent_rejected: false }, rules)).not.toContain('One cent more');
  const none = limitSentence({ ...base, status: 'NO_SAFE_ACTION', max_amount_minor: 0, limiting_checks: ['TUITION_RESERVE_VIOLATION', 'EMERGENCY_FLOOR_VIOLATION'] }, rules);
  expect(none).toContain('Even $1 would break your rules');
  expect(none).toContain('it would dip into your $7,000 tuition (your Rule I)');
  expect(none).not.toContain('more would'); // wording for "nothing is safe" never talks about a larger amount
  expect(limitSentence({ ...base, status: 'NON_MONOTONIC_FEASIBILITY' }, rules)).toContain('will not pick a number');
});

test('PF-020 shows an unknown reason in plain words instead of hiding it', () => {
  expect(reasonText('SOME_NEW_BACKEND_CODE', rules)).toBe('some new backend code');
  expect(reasonText('CHAIN_GAS_BALANCE', null)).toContain('gas');
});

test('PF-020 names the four stress tests from the run parameters', () => {
  const run = { stress_results: [
    { name: 'market_shock', parameters: { market_loss_bps: 3000 }, passed: true, minimum_liquidity_minor: 479900, goal_funded: true },
    { name: 'income_delay', parameters: { income_delay_days: 30 }, passed: true, minimum_liquidity_minor: 479900, goal_funded: true },
    { name: 'emergency_expense', parameters: { emergency_expense_minor: 200000 }, passed: false, minimum_liquidity_minor: 279900, goal_funded: true },
    { name: 'fee_shock', parameters: { fee_multiplier: 3 }, passed: true, minimum_liquidity_minor: 479700, goal_funded: true },
  ] } as unknown as SimulationRun;
  const rows = stressRows(run);
  expect(rows.map((r) => r.label)).toEqual(['Market crash, −30%', 'Income 30 days late', 'Surprise $2,000 bill', 'Fees triple']);
  expect(rows.map((r) => r.passed)).toEqual([true, true, false, true]); // a failed stress is never shown as passed
});

test('PF-020 with no rules the Ask screen says so and offers to set them, instead of calling the planner', async ({ page }) => {
  await signIn(page, '/ask');
  await expect(page.getByRole('heading', { name: 'What should Vallet do?' })).toBeVisible();
  await expect(page.getByText('No rules yet')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Set my rules' })).toHaveAttribute('href', '/rules');
  await expect(page.getByRole('button', { name: 'Check it' })).toBeDisabled();
  await expect(page.getByTestId('optimizer-result')).toHaveCount(0);
  // A suggestion chip only fills the box; it never starts a check.
  let posted = 0;
  page.on('request', (r) => { if (r.method() === 'POST' && /\/(plans\/generate|intent\/parse|optimize|verify)$/.test(r.url())) posted++; });
  await expect(page.getByRole('button', { name: 'How much can I safely use this month?' })).toHaveCount(0);
  await page.getByRole('button', { name: 'How much can I invest while protecting my tuition?' }).click();
  await expect(page.getByLabel('What should Vallet do?')).toHaveValue('How much can I invest while protecting my tuition?');
  await page.getByLabel('What should Vallet do?').press('Control+Enter');
  await expect(page.getByRole('heading', { name: 'What should Vallet do?' })).toBeVisible();
  expect(posted).toBe(0);
});

test('PF-020 the real planner refuses to suggest anything before rules exist', async ({ page }) => {
  await signIn(page, '/ask');
  const headers = { Origin: 'http://127.0.0.1:3000', 'X-CSRF-Token': (await (await page.request.get('/api/backend/auth/session')).json()).csrf_token };
  const planned = await page.request.post('/api/backend/plans/generate', { headers, data: { goal: 'Invest as much as possible without risking my tuition.' } });
  expect(planned.status()).toBe(200);
  const body = await planned.json();
  expect(body.mode).toBe('deterministic_demo');
  expect(body.candidates).toEqual([]);
  expect(body.clarification).toContain('Confirm a Financial Constitution before generating investment candidates.');
});

test('PF-020 an old Time Machine link opens the exact-amount form with the candidate carried in the link', async ({ page }) => {
  await signIn(page);
  await page.goto(`/time-machine?amount=2180.50&token=${TOKEN}&recipient=${RECIPIENT}`);
  await expect(page).toHaveURL(/\/ask\?/);
  await expect(page.getByLabel('Amount (USD)')).toHaveValue('2180.50');
  await page.getByRole('button', { name: /Where it goes/ }).click();
  await expect(page.getByLabel('Token address')).toHaveValue(TOKEN);
  await expect(page.getByLabel('Recipient address')).toHaveValue(RECIPIENT);
});

test('PF-020 Ask fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page, '/ask');
  await expect(page.getByRole('heading', { name: 'What should Vallet do?' })).toBeVisible();
  await page.getByRole('button', { name: 'Or check an exact amount yourself' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
