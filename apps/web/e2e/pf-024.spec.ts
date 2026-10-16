import { test, expect } from './fixtures';
import { signIn } from './auth-helper';

// POST /demo/emergency returns 501 until PF-032 lands. The state must stay unchanged when it refuses, and the
// screen must say exactly what the backend said. Once implemented, the same test checks the new version and result.

test('PF-024 recording the emergency needs an explicit acknowledgement', async ({ page }) => {
  await signIn(page);
  await page.goto('/workspace');
  const panel = page.getByRole('region', { name: 'Emergency expense' });
  await expect(panel.getByRole('button', { name: 'Record the $2,000 emergency' })).toBeDisabled();
  await panel.getByLabel(/Record a \$2,000 emergency expense/).check();
  await expect(panel.getByRole('button', { name: 'Record the $2,000 emergency' })).toBeEnabled();
});

test('PF-024 shows the real backend answer and only changes state when the backend did', async ({ page }) => {
  await signIn(page);
  const before = await (await page.request.get('/api/backend/financial-state')).json();
  await page.goto('/workspace');
  const panel = page.getByRole('region', { name: 'Emergency expense' });
  await expect(panel).toContainText(`version ${before.snapshot.version} becomes the next version`);
  await panel.getByLabel(/Record a \$2,000 emergency expense/).check();
  const response = page.waitForResponse((r) => r.url().endsWith('/api/backend/demo/emergency'));
  await panel.getByRole('button', { name: 'Record the $2,000 emergency' }).click();
  const r = await response;
  const sent = JSON.parse(r.request().postData() ?? '{}');
  expect(sent).toEqual({ expected_state_version: before.snapshot.version, amount_minor: 200000 });
  const body = await r.json();
  const after = await (await page.request.get('/api/backend/financial-state')).json();
  if (r.status() === 200) {
    expect(after.snapshot.version).toBe(before.snapshot.version + 1);
    await expect(panel.getByTestId('emergency-result')).toContainText(`Version ${before.snapshot.version} → version ${body.state.snapshot.version}`);
  } else {
    expect(after.snapshot.version).toBe(before.snapshot.version); // a refusal leaves the state untouched
    const alert = panel.getByRole('alert');
    await expect(alert).toContainText(body.message);
    await expect(alert).toContainText('Your financial state was not changed.');
    await expect(panel.getByTestId('emergency-result')).toHaveCount(0);
  }
});
