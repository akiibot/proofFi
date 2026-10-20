import { expect, type Page } from '@playwright/test';

/** Respect the real global start budget; never weaken server limits for tests. */
export async function launchJudge(page: Page) {
  await page.bringToFront();
  await page.goto('/login');
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = page.waitForResponse(r => r.url().endsWith('/api/backend/auth/judge') && r.request().method() === 'POST');
    await page.getByRole('button', { name: 'Launch demo', exact: true }).click();
    const response = await reply;
    if (response.status() === 429 && attempt === 0) { await page.waitForTimeout(61000); continue; }
    if (!response.ok()) { const failure = await response.json(); expect(response.status(), `${failure.code}: ${failure.message}`).toBe(200); }
    expect(response.request().postDataJSON()).toEqual({ profile_id: 'synthetic-funded-demo-v1', accept_synthetic_assumptions: true });
    break;
  }
  await expect(page.getByText('Judge demo', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('tour')).toBeVisible();
  await page.getByTestId('tour').getByRole('button', { name: 'Skip', exact: true }).click();
  await expect(page.getByTestId('tour')).toHaveCount(0);
  return (await (await page.request.get('/api/backend/auth/access')).json()) as { scope_id: string; mode: string };
}
