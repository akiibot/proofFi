import { test, expect } from './fixtures';
import { signIn } from './auth-helper';
import { candidate, ensureConstitution, TOKEN, RECIPIENT, writeHeaders } from './api-helpers';

// Journeys run after the read-only checks, against the isolated e2e database with the labeled test-fixture
// simulation config (e2e/seed_e2e_simulation_config.py). Rules are confirmed through the real API if needed.

const usd = (minor: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: minor % 100 ? 2 : 0, maximumFractionDigits: minor % 100 ? 2 : 0 }).format(minor / 100);

test('PF-021 a real check reaches the independent optimizer and its answer is shown as is', async ({ page }) => {
  await signIn(page);
  await ensureConstitution(page);
  await page.goto('/ask');
  const optimize = page.waitForResponse((r) => r.url().endsWith('/api/backend/optimize'));
  await page.getByRole('button', { name: 'Check it' }).click();
  const response = await optimize;
  expect(response.status()).toBe(200);
  const body = await response.json();
  const result = page.getByTestId('optimizer-result');
  await expect(result).toBeVisible();
  if (body.status === 'SAFE_ACTION') await expect(page.getByTestId('safe-amount')).toHaveText(usd(body.max_amount_minor));
  else await expect(result).toContainText(body.status === 'NO_SAFE_ACTION' ? 'Nothing is safe right now' : 'No single safe limit');
  await expect(page.getByTestId('liquidity-path')).toHaveCount(0); // the futures stay one click away, in a drawer
});

test('PF-021 an exact amount goes straight to the optimizer, without the planner', async ({ page }) => {
  await signIn(page);
  await ensureConstitution(page);
  await page.goto('/ask');
  let planned = 0;
  page.on('request', (r) => { if (r.url().endsWith('/api/backend/plans/generate') || r.url().endsWith('/api/backend/intent/parse')) planned++; });
  await page.getByRole('button', { name: 'Or check an exact amount yourself' }).click();
  await page.getByLabel('Amount (USD)').fill('1000');
  await page.getByRole('button', { name: /Where it goes/ }).click();
  await page.getByLabel('Token address').fill(TOKEN);
  await page.getByLabel('Recipient address').fill(RECIPIENT);
  const optimize = page.waitForResponse((r) => r.url().endsWith('/api/backend/optimize'));
  await page.getByRole('button', { name: 'Find the largest safe amount' }).click();
  expect((await optimize).status()).toBe(200);
  await expect(page.getByTestId('optimizer-result')).toBeVisible();
  expect(planned).toBe(0);
});

test('PF-021 when the planner needs a detail, the screen asks for it and checks nothing', async ({ page }) => {
  await signIn(page);
  await ensureConstitution(page);
  // Input-ambiguity response only; no candidate and no safe amount is ever fabricated.
  await page.route('**/api/backend/plans/generate', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mode: 'deterministic_demo', candidates: [], clarification: ['Which address should receive it?'] }) }));
  await page.goto('/ask');
  let optimized = 0;
  page.on('request', (r) => { if (r.url().endsWith('/api/backend/optimize')) optimized++; });
  await page.getByRole('button', { name: 'Check it' }).click();
  await expect(page.getByText('The AI needs one detail')).toBeVisible();
  await expect(page.getByText('“Which address should receive it?”')).toBeVisible();
  await expect(page.getByTestId('optimizer-result')).toHaveCount(0);
  await page.getByRole('button', { name: 'Answer' }).click();
  await expect(page.getByLabel('What should Vallet do?')).toBeVisible();
  expect(optimized).toBe(0);
});

test('PF-021 when the planner is down, the exact-amount path is offered', async ({ page }) => {
  await signIn(page);
  await ensureConstitution(page);
  await page.route('**/api/backend/plans/generate', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'UNAVAILABLE', message: 'Planner unavailable', reasons: [] }) }));
  await page.goto('/ask');
  await page.getByRole('button', { name: 'Check it' }).click();
  await expect(page.getByText('The AI is not responding')).toBeVisible();
  await expect(page.getByText('You can still check an exact amount yourself.')).toBeVisible();
  await page.getByRole('button', { name: 'Enter an amount' }).click();
  await expect(page.getByLabel('Amount (USD)')).toBeVisible();
});

test('PF-021 reports an intent failure even when candidate planning succeeds', async ({ page }) => {
  await signIn(page);
  await ensureConstitution(page);
  await page.route('**/api/backend/intent/parse', (route) => route.abort('failed'));
  await page.goto('/ask');
  await page.getByRole('button', { name: 'Check it' }).click();
  await expect(page.getByTestId('optimizer-result')).toBeVisible();
  await page.getByRole('button', { name: 'Show steps' }).click();
  await expect(page.getByText('Could not read your goal')).toBeVisible();
});

test('PF-021 refuses an empty goal and a malformed manual amount locally', async ({ page }) => {
  await signIn(page);
  await ensureConstitution(page);
  await page.goto('/ask');
  let posted = 0;
  page.on('request', (r) => { if (r.method() === 'POST' && /\/(plans\/generate|intent\/parse|optimize)$/.test(r.url())) posted++; });
  await page.getByLabel('What should Vallet do?').fill('   ');
  await page.getByRole('button', { name: 'Check it' }).click();
  await expect(page.getByText('Describe what you want Vallet to do.')).toBeVisible();
  await page.getByRole('button', { name: 'Or check an exact amount yourself' }).click();
  await page.getByLabel('Amount (USD)').fill('ten dollars');
  await page.getByRole('button', { name: /Where it goes/ }).click();
  await page.getByLabel('Token address').fill('not an address');
  await page.getByRole('button', { name: 'Find the largest safe amount' }).click();
  await expect(page.getByText('Enter a dollar amount like 7000 or 7000.50.')).toBeVisible();
  await expect(page.getByLabel('Token address')).toHaveAttribute('aria-invalid', 'true');
  expect(posted).toBe(0);
});

test('PF-021 the same seed, state and amount give the same simulation', async ({ page }) => {
  await signIn(page);
  await ensureConstitution(page);
  const headers = await writeHeaders(page);
  const simulate = async (id: string) => {
    const response = await page.request.post('/api/backend/simulate', { headers, data: { action: candidate(250000, id) } });
    expect(response.status()).toBe(200);
    return response.json();
  };
  const first = await simulate('determinism-1');
  const second = await simulate('determinism-2');
  expect(second.id).not.toBe(first.id); // a new run each time
  expect(second.metrics).toEqual(first.metrics);
  expect(second.sampled_liquidity_paths_minor).toEqual(first.sampled_liquidity_paths_minor);
});

for (const fixture of [
  { message: 'Configure an approved demo token and recipient before generating candidates.', title: 'Demo setup is incomplete', action: 'Check setup', href: '/settings' },
  { message: 'The configured token or recipient is not permitted by the confirmed policy.', title: 'Your rules block the demo configuration', action: 'Review rules', href: '/rules' },
  { message: 'Confirm a Financial Constitution before generating investment candidates.', title: 'Confirm your rules first', action: 'Review rules', href: '/rules' },
]) test(`PF-152 setup blocker: ${fixture.title}`, async ({ page }) => {
  await signIn(page);
  await ensureConstitution(page);
  await page.route('**/api/backend/plans/generate', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mode: 'deterministic_demo', candidates: [], clarification: [fixture.message] }) }));
  await page.goto('/ask');
  let financialWrites = 0;
  page.on('request', (r) => { if (r.method() === 'POST' && /\/(optimize|verify|approvals|execute|constitutions\/(drafts|confirm))$/.test(r.url())) financialWrites++; });
  await page.getByRole('button', { name: 'Check it' }).click();
  await expect(page.getByText(fixture.title, { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: fixture.action })).toHaveAttribute('href', fixture.href);
  await expect(page.getByText('Proposal generation paused')).toBeVisible();
  await expect(page.getByText('The AI needs one detail', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Answer', exact: true })).toHaveCount(0);
  await expect(page.getByTestId('optimizer-result')).toHaveCount(0);
  expect(financialWrites).toBe(0);
});
