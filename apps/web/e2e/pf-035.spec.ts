import { test, expect } from '@playwright/test';

test.describe('PF-035 unhydrated login', () => {
  test.use({ javaScriptEnabled: false });
  test('does not offer an interactive credential form before React handles submission', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Demo password')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
    await expect(page.locator('form')).toHaveAttribute('method', 'post');
  });
});

test('PF-035 enables login only after the real JavaScript finishes hydration', async ({ page }) => {
  let release!: () => void;
  let held = true;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/_next/static/**/*.js*', async route => {
    if (held) await gate;
    await route.continue();
  });
  try {
    await page.goto('/login', { waitUntil: 'commit' });
    await expect(page.getByLabel('Demo password')).toBeVisible();
    await expect(page.getByLabel('Demo password')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeDisabled();
  } finally {
    held = false;
    release();
  }
  await expect(page.getByLabel('Demo password')).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Sign in', exact: true })).toBeEnabled();
});
