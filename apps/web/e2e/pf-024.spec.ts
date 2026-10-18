import { test, expect, type Page } from './fixtures';
import { signIn } from './auth-helper';

const acknowledgement = /Yes, record this \$2,000 expense/;
const record = (dialog: ReturnType<Page['getByRole']>) => dialog.getByRole('button', { name: 'Record expense', exact: true });

async function openExpense(page: Page) {
  await signIn(page);
  await page.getByRole('button', { name: 'Record an expense' }).click();
  const dialog = page.getByRole('dialog', { name: 'Record an unexpected expense' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test('PF-024 requires explicit acknowledgement before sending an expense', async ({ page }) => {
  const dialog = await openExpense(page);
  await expect(record(dialog)).toBeDisabled();
  await dialog.getByLabel(acknowledgement).check();
  await expect(record(dialog)).toBeEnabled();
});

test('PF-024 real unconfirmed-policy refusal preserves state and shows the backend reason', async ({ page }) => {
  const before = await (async () => { await signIn(page); return (await page.request.get('/api/backend/financial-state')).json(); })();
  await page.getByRole('button', { name: 'Record an expense' }).click();
  const dialog = page.getByRole('dialog', { name: 'Record an unexpected expense' });
  await dialog.getByLabel(acknowledgement).check();
  const response = page.waitForResponse(r => r.url().endsWith('/api/backend/demo/emergency'));
  await record(dialog).click();
  const r = await response;
  expect(r.request().postDataJSON()).toEqual({ expected_state_version: before.snapshot.version, amount_minor: 200000 });
  expect(r.status()).toBe(503);
  expect((await r.json()).message).toBe('Confirmed Constitution required');
  await expect(dialog.getByRole('alert')).toContainText('Confirmed Constitution required');
  await expect(page.getByTestId('emergency-result')).toHaveCount(0);
  expect((await (await page.request.get('/api/backend/financial-state')).json()).snapshot).toEqual(before.snapshot);
  // A generic 503 could also originate at the proxy after commit, so the UI conservatively locks retries.
  await expect(record(dialog)).toBeDisabled();
});

test('PF-024 real version conflict refreshes state and consumes the acknowledgement', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/backend/demo/emergency', route => {
    const body = route.request().postDataJSON();
    // Inject a stale version, but let the real API decide and return its actual refusal.
    return route.continue({ postData: JSON.stringify({ ...body, expected_state_version: body.expected_state_version + 1 }) });
  });
  await page.getByRole('button', { name: 'Record an expense' }).click();
  const dialog = page.getByRole('dialog', { name: 'Record an unexpected expense' });
  await dialog.getByLabel(acknowledgement).check();
  const response = page.waitForResponse(r => r.url().endsWith('/api/backend/demo/emergency'));
  await record(dialog).click();
  expect((await response).status()).toBe(409);
  await expect(dialog.getByRole('alert')).toContainText('Financial state version conflict');
  await expect(dialog.getByRole('alert')).toContainText('Nothing changed.');
  await expect(dialog.getByLabel(acknowledgement)).not.toBeChecked();
  await expect(record(dialog)).toBeDisabled();
});

test('PF-024 response loss never claims unchanged state or blindly resubmits', async ({ page }) => {
  await signIn(page);
  let submissions = 0;
  await page.route('**/api/backend/demo/emergency', async route => {
    submissions++;
    await route.fetch(); // the real API receives the request; only its response is lost
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Record an expense' }).click();
  const dialog = page.getByRole('dialog', { name: 'Record an unexpected expense' });
  await dialog.getByLabel(acknowledgement).check();
  await record(dialog).click();
  await expect(dialog.getByRole('alert')).toContainText('We cannot confirm the result');
  await expect(dialog.getByRole('alert')).toContainText('may already have been recorded');
  await expect(dialog.getByRole('alert')).not.toContainText('state was not changed');
  await expect(dialog.getByLabel(acknowledgement)).toBeDisabled();
  await expect(record(dialog)).toBeDisabled();
  // Closing and reopening the dialog keeps the lock, and still says why.
  await dialog.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Record an expense' }).click();
  const again = page.getByRole('dialog', { name: 'Record an unexpected expense' });
  await expect(again.getByRole('alert')).toContainText('We cannot confirm the result');
  await expect(record(again)).toBeDisabled();
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
  await page.getByRole('button', { name: 'Record an expense' }).click();
  const dialog = page.getByRole('dialog', { name: 'Record an unexpected expense' });
  await dialog.getByLabel(acknowledgement).check();
  await record(dialog).click();
  const result = page.getByTestId('emergency-result');
  await expect(result).toContainText('Safe to invest now');
  await expect(result).toContainText('Even $1 would break your rules now.');
  await expect(page.getByText('You recorded a $2,000 expense.')).toBeVisible();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Record an expense' }).click();
  const again = page.getByRole('dialog', { name: 'Record an unexpected expense' });
  await expect(again.getByLabel(acknowledgement)).not.toBeChecked();
  await expect(record(again)).toBeDisabled();
});
