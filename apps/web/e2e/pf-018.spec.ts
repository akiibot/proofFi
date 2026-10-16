import { test, expect } from '@playwright/test';
import { signIn } from './auth-helper';

const CHAIN_LABEL: Record<string, string> = { CHAIN_NOT_CONFIGURED: 'Not configured', UNAVAILABLE: 'Unavailable', READY: 'Ready' };
const usd = (minor: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minor / 100);

test('PF-018 dashboard renders the real financial state and the real chain status', async ({ page }, testInfo) => {
  const financial = page.waitForResponse((r) => r.url().endsWith('/api/backend/financial-state'));
  const chain = page.waitForResponse((r) => r.url().endsWith('/api/backend/chain/status'));
  await signIn(page);
  const stateResponse = await financial;
  const chainResponse = await chain;
  expect(stateResponse.status()).toBe(200);
  expect(chainResponse.status()).toBe(200);
  const state = await stateResponse.json();
  const chainStatus = await chainResponse.json();

  // Every number on screen is derived from the API response, not typed into the page.
  const assets = state.snapshot.assets.reduce((sum: number, a: { amount_minor: number }) => sum + a.amount_minor, 0);
  const tuition = state.snapshot.obligations.filter((o: { protected: boolean }) => o.protected).reduce((sum: number, o: { amount_minor: number }) => sum + o.amount_minor, 0);
  await expect(page.getByRole('heading', { name: 'Total synthetic assets' }).locator('xpath=following-sibling::strong')).toHaveText(usd(assets));
  await expect(page.getByRole('heading', { name: 'Protected obligations' }).locator('xpath=following-sibling::strong')).toHaveText(usd(tuition));
  await expect(page.getByText(state.snapshot_hash, { exact: true })).toBeVisible();

  // Chain status is the live response: its label, its reason text and its network id.
  const panel = page.getByRole('region', { name: 'Chain status' });
  await expect(panel.getByText(CHAIN_LABEL[chainStatus.status], { exact: true })).toBeVisible();
  await expect(panel.getByText(chainStatus.reason, { exact: true })).toBeVisible();
  await expect(panel.getByText(`chain id ${chainStatus.chain_id}`)).toBeVisible();

  // No Constitution means the page must say so instead of implying protection.
  if (state.active_constitution_version === null) await expect(page.getByText('No Constitution is active yet')).toBeVisible();

  await page.screenshot({ path: testInfo.outputPath('pf-018-desktop.png'), fullPage: true });
});

test('PF-018 shows a loading state while the backend is still answering', async ({ page }) => {
  // The request is only held back for a moment; the real response is passed through untouched.
  await page.route('**/api/backend/chain/status', async (route) => { await new Promise((resolve) => setTimeout(resolve, 1500)); await route.continue(); });
  await signIn(page);
  await expect(page.getByRole('status').filter({ hasText: 'Loading chain status' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Chain status' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Loading chain status' })).toHaveCount(0);
});

test('PF-018 sends an expired session back to the login page', async ({ page, context }) => {
  await signIn(page);
  await context.clearCookies(); // the browser no longer holds a valid session, so the real backend answers 401
  await page.getByRole('button', { name: 'Refresh state' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel('Demo password')).toBeVisible();
});

test('PF-018 explains a failed section, keeps the rest usable and recovers on retry', async ({ page }) => {
  // Failure injection only (the transport fails); no financial, chain or verification result is fabricated.
  let fail = true;
  await page.route('**/api/backend/chain/status', async (route) => {
    if (!fail) return route.continue();
    await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'UNAVAILABLE', message: 'Backend unavailable. Start both services with npm run dev.', reasons: [] }) });
  });
  await signIn(page);
  const alert = page.getByRole('alert').filter({ hasText: 'Could not load chain status' });
  await expect(alert).toBeVisible();
  await expect(alert).toContainText('Backend unavailable');
  await expect(page.getByRole('heading', { name: 'Total synthetic assets' })).toBeVisible(); // financial state still shows
  await expect(page.getByRole('region', { name: 'Chain status' })).toHaveCount(0); // and no invented chain status takes its place

  fail = false;
  await alert.getByRole('button', { name: 'Try again' }).click();
  await expect(page.getByRole('region', { name: 'Chain status' })).toBeVisible();
  await expect(alert).toHaveCount(0);
});

test('PF-018 lists unbuilt screens as unavailable instead of linking to missing pages', async ({ page }) => {
  await signIn(page);
  const nav = page.getByRole('navigation', { name: 'Screens' });
  await expect(nav.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('aria-current', 'page');
  await expect(nav.getByRole('link', { name: 'Constitution' })).toHaveCount(0);
  await expect(nav.getByText('Constitution')).toBeVisible();
});

test('PF-018 stylesheet change leaves the login page intact', async ({ page }, testInfo) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Sign in to/ })).toBeVisible();
  await expect(page.getByLabel('Demo password')).toBeVisible();
  const button = page.getByRole('button', { name: 'Sign in', exact: true });
  await expect(button).toBeVisible();
  await expect(button).toHaveCSS('background-color', 'rgb(113, 237, 198)');
  await page.screenshot({ path: testInfo.outputPath('pf-018-login.png'), fullPage: true });
});

test('PF-018 stays inside the screen width on a phone', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await expect(page.getByRole('region', { name: 'Chain status' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('pf-018-mobile.png'), fullPage: true });
});
