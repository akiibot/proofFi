import { test, expect } from './fixtures';

test('judge: disclosed launch opens a real isolated session and fresh Home tour', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByText('$17,000 synthetic cash', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Launch demo', exact: true }).click();
  await expect(page.getByText('Judge demo', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Sending disabled', { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId('tour')).toBeVisible();
  const access = await (await page.request.get('/api/backend/auth/access')).json();
  expect(access.mode).toBe('judge');
  expect(access.execution_enabled).toBe(false);
  expect(access.scope_id).toMatch(/^judge-/);
  await page.keyboard.press('Escape');
  expect(await (await page.request.get('/api/backend/financial-state')).json()).toMatchObject({ active_constitution_version: null });
});
