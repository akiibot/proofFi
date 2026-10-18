import { test, expect } from './fixtures';
import { signIn } from './auth-helper';

// The certificate check lives in a dialog that is only drawn once the browser has hydrated, so there is never an
// interactive form that React has not yet taken over.
test.describe('PF-022 certificate check without hydration', () => {
  test.use({ javaScriptEnabled: false });
  test('offers no form before React handles it', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Demo password')).toBeDisabled();
    await page.goto('/activity/check');
    await expect(page.getByLabel('Certificate ID')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Check', exact: true })).toHaveCount(0);
  });
});

test('PF-022 shows the check form after real hydration and preserves the entered certificate ID', async ({ page }) => {
  await signIn(page);
  let release!: () => void;
  let held = true;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/_next/static/**/*.js*', async route => {
    if (held) await gate;
    await route.continue();
  });
  try {
    await page.goto('/activity/check', { waitUntil: 'commit' });
    await expect(page.getByLabel('Certificate ID')).toHaveCount(0);
  } finally {
    held = false;
    release();
  }
  await expect(page.getByLabel('Certificate ID')).toBeEnabled();
  await page.getByLabel('Certificate ID').fill('cert-unknown');
  const response = page.waitForResponse(r => r.url().endsWith('/api/backend/certificates/cert-unknown/verify'));
  await page.getByRole('button', { name: 'Check', exact: true }).click();
  expect((await response).status()).toBe(409);
  await expect(page.getByLabel('Certificate ID')).toHaveValue('cert-unknown');
  await expect(page.getByRole('alert').filter({ hasText: 'No certificate with ID "cert-unknown" exists.' })).toBeVisible();
  await expect(page.getByTestId('certificate-status')).toHaveCount(0);
});
