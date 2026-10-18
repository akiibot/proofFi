import { test as base, expect } from '@playwright/test';

// The demo backend keeps at most 32 live sessions in memory (docs/AUTHENTICATION.md). Every test signs in with a
// fresh browser context, so without this the suite would hit "Demo session capacity reached" as it grows.
// After each test, the session that test used (if still valid) is revoked through the real logout route.
export const test = base.extend<{ releaseSession: void }>({
  releaseSession: [async ({ page }, use) => {
    await use();
    try {
      const session = await page.request.get('/api/backend/auth/session');
      if (!session.ok()) return;
      const { csrf_token } = await session.json();
      await page.request.post('/api/backend/auth/logout', { headers: { Origin: 'http://127.0.0.1:3000', 'X-CSRF-Token': csrf_token } });
    } catch { /* the page may already be closed or signed out; nothing to release */ }
  }, { auto: true }],
});

export { expect };

export type { Page } from '@playwright/test';
