import { test, expect } from './fixtures';
import { password } from './test-credentials.json';

test('PF-023 acknowledgement waits for real hydration and remains effective afterwards', async ({ page }) => {
  // Authenticate through the real API to isolate this checkbox's hydration.
  const session = await page.request.post('/api/backend/auth/login', {
    headers: { Origin: 'http://127.0.0.1:3000' }, data: { password },
  });
  expect(session.status()).toBe(200);
  let release = () => {};
  const scriptsReady = new Promise<void>(resolve => { release = resolve; });
  let blockedChunks = 0;
  let attackRequests = 0;
  page.on('request', request => {
    if (request.url().endsWith('/api/backend/demo/attack')) attackRequests++;
  });
  await page.route('**/_next/static/**', async route => {
    if (new URL(route.request().url()).pathname.endsWith('.js')) {
      blockedChunks++;
      await scriptsReady;
    }
    await route.continue();
  });
  const checkbox = page.getByLabel(/Run this controlled test/);
  const button = page.getByRole('button', { name: 'Run the test' });
  try {
    await page.goto('/security', { waitUntil: 'commit' });
    await expect.poll(() => blockedChunks).toBeGreaterThan(0);
    await expect(checkbox).toBeDisabled();
    await expect(button).toBeDisabled();
  } finally { release(); }
  await expect(checkbox).toBeEnabled();
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await expect(button).toBeEnabled();
  expect(attackRequests).toBe(0);
});
