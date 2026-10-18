import { test, expect } from './fixtures';
import { signIn } from './auth-helper';

test.describe('PF-022 certificate form without hydration', () => {
  test.use({ javaScriptEnabled: false });
  test('does not accept edits or submission before React handles them', async ({ page }) => {
    await page.goto('/certificates');
    await expect(page.getByLabel('Certificate ID')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Open certificate' })).toBeDisabled();
  });
});

test('PF-022 enables the form after real hydration and preserves the entered certificate ID', async ({ page }) => {
  await signIn(page);
  let release!: () => void;
  let held = true;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/_next/static/**/*.js*', async route => {
    if (held) await gate;
    await route.continue();
  });
  try {
    await page.goto('/certificates', { waitUntil: 'commit' });
    await expect(page.getByLabel('Certificate ID')).toBeVisible();
    await expect(page.getByLabel('Certificate ID')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Open certificate' })).toBeDisabled();
  } finally {
    held = false;
    release();
  }
  await expect(page.getByLabel('Certificate ID')).toBeEnabled();
  await page.getByLabel('Certificate ID').fill('cert-unknown');
  const response = page.waitForResponse(r => r.url().endsWith('/api/backend/certificates/cert-unknown'));
  await page.getByRole('button', { name: 'Open certificate' }).click();
  expect((await response).status()).toBe(409);
  await expect(page.getByLabel('Certificate ID')).toHaveValue('cert-unknown');
  await expect(page.getByRole('alert').filter({ hasText: 'No certificate with ID "cert-unknown" exists.' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Your decision' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Execution' })).toHaveCount(0);
});
