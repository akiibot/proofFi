import { test, expect } from './fixtures';
import { signIn } from './auth-helper';

test('PF-024 requires explicit acknowledgement before sending an expense', async ({ page }) => {
  await signIn(page);
  await page.goto('/workspace');
  const panel = page.getByRole('region', { name: 'Emergency expense' });
  await expect(panel.getByRole('button', { name: 'Record the $2,000 emergency' })).toBeDisabled();
  await panel.getByLabel(/Record a \$2,000 emergency expense/).check();
  await expect(panel.getByRole('button', { name: 'Record the $2,000 emergency' })).toBeEnabled();
});

test('PF-024 real unconfirmed-policy refusal preserves state and shows the backend reason', async ({ page }) => {
  await signIn(page);
  const before = await (await page.request.get('/api/backend/financial-state')).json();
  await page.goto('/workspace');
  const panel = page.getByRole('region', { name: 'Emergency expense' });
  await panel.getByLabel(/Record a \$2,000 emergency expense/).check();
  const response = page.waitForResponse(r => r.url().endsWith('/api/backend/demo/emergency'));
  await panel.getByRole('button', { name: 'Record the $2,000 emergency' }).click();
  const r = await response;
  expect(r.request().postDataJSON()).toEqual({ expected_state_version: before.snapshot.version, amount_minor: 200000 });
  expect(r.status()).toBe(503);
  expect((await r.json()).message).toBe('Confirmed Constitution required');
  await expect(panel.getByRole('alert')).toContainText('Confirmed Constitution required');
  await expect(panel.getByTestId('emergency-result')).toHaveCount(0);
  expect((await (await page.request.get('/api/backend/financial-state')).json()).snapshot).toEqual(before.snapshot);
  // A generic 503 could also originate at the proxy after commit, so the UI conservatively locks retries.
  await expect(panel.getByRole('button', { name: 'Record the $2,000 emergency' })).toBeDisabled();
});

test('PF-024 real version conflict refreshes state and consumes the acknowledgement', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/backend/demo/emergency', route => {
    const body = route.request().postDataJSON();
    // Inject a stale version, but let the real API decide and return its actual refusal.
    return route.continue({ postData: JSON.stringify({ ...body, expected_state_version: body.expected_state_version + 1 }) });
  });
  await page.goto('/workspace');
  const panel = page.getByRole('region', { name: 'Emergency expense' });
  await panel.getByLabel(/Record a \$2,000 emergency expense/).check();
  const response = page.waitForResponse(r => r.url().endsWith('/api/backend/demo/emergency'));
  await panel.getByRole('button', { name: 'Record the $2,000 emergency' }).click();
  expect((await response).status()).toBe(409);
  await expect(panel.getByRole('alert')).toContainText('Financial state version conflict');
  await expect(panel.getByRole('alert')).toContainText('This request did not record an expense.');
  await expect(panel.getByLabel(/Record a \$2,000 emergency expense/)).not.toBeChecked();
  await expect(panel.getByRole('button', { name: 'Record the $2,000 emergency' })).toBeDisabled();
});

test('PF-024 response loss never claims unchanged state or blindly resubmits', async ({ page }) => {
  await signIn(page);
  let submissions = 0;
  await page.route('**/api/backend/demo/emergency', async route => {
    submissions++;
    await route.fetch(); // the real API receives the request; only its response is lost
    await route.abort('failed');
  });
  await page.goto('/workspace');
  const panel = page.getByRole('region', { name: 'Emergency expense' });
  await panel.getByLabel(/Record a \$2,000 emergency expense/).check();
  await panel.getByRole('button', { name: 'Record the $2,000 emergency' }).click();
  await expect(panel.getByRole('alert')).toContainText('The expense outcome is unknown.');
  await expect(panel.getByRole('alert')).toContainText('may already have been recorded');
  await expect(panel.getByRole('alert')).not.toContainText('state was not changed');
  await expect(panel.getByLabel(/Record a \$2,000 emergency expense/)).toBeDisabled();
  await expect(panel.getByRole('button', { name: 'Record the $2,000 emergency' })).toBeDisabled();
  expect(submissions).toBe(1);
});

// Isolated rendering fixture only: this does not claim a real expense, risk result or chain acceptance.
// Real atomic emergency/repricing/certificate invalidation is covered by the PF-032 backend suite.
test('PF-024 isolated response fixture displays the result and requires a new acknowledgement', async ({ page }) => {
  await signIn(page);
  const state = await (await page.request.get('/api/backend/financial-state')).json();
  const next = structuredClone(state);
  next.snapshot.version += 1;
  next.snapshot.realized_expense_minor += 200000;
  next.snapshot.assets[0].amount_minor -= 200000;
  await page.route('**/api/backend/demo/emergency', route => route.fulfill({
    json: { state: next, optimization: { status: 'NO_SAFE_ACTION', action: null, max_amount_minor: 0, precision_minor: 1, verifier_calls: 1, limiting_checks: ['isolated_ui_fixture'], next_cent_rejected: false } },
  }));
  await page.goto('/workspace');
  const panel = page.getByRole('region', { name: 'Emergency expense' });
  await panel.getByLabel(/Record a \$2,000 emergency expense/).check();
  await panel.getByRole('button', { name: 'Record the $2,000 emergency' }).click();
  await expect(panel.getByTestId('emergency-result')).toContainText(`Version ${state.snapshot.version} → version ${next.snapshot.version}`);
  await expect(panel.getByTestId('emergency-result')).toContainText('No safe amount exists');
  await expect(panel.getByLabel(/Record a \$2,000 emergency expense/)).not.toBeChecked();
  await expect(panel.getByRole('button', { name: 'Record the $2,000 emergency' })).toBeDisabled();
});
