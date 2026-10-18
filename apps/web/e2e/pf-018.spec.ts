import { test, expect } from './fixtures';
import { signIn } from './auth-helper';
import { getJson } from './api-helpers';

const CHAIN_BUTTON = /Base Sepolia · testnet|Testnet unavailable|Testnet not configured/;
const usd = (minor: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minor / 100);

test('PF-018 Home renders the real financial state and the chain drawer shows the real chain status', async ({ page }, testInfo) => {
  await signIn(page);
  const state = await getJson(page, 'financial-state');
  const chainStatus = await getJson(page, 'chain/status');

  // Every number on screen is derived from the API response, not typed into the page.
  const protectedMinor = state.snapshot.obligations.filter((o: { protected: boolean }) => o.protected).reduce((s: number, o: { amount_minor: number }) => s + o.amount_minor, 0);
  await expect(page.getByTestId('protected-total')).toHaveText(usd(protectedMinor)); // no rules active: only the protected obligations
  if (state.active_constitution_version === null) await expect(page.getByText('No rules active')).toBeVisible();

  // The chain drawer is the live response: its label, its reason text, its network id and its wallet.
  await page.getByRole('button', { name: CHAIN_BUTTON }).click();
  const drawer = page.getByRole('dialog', { name: 'Your testnet connection' });
  await expect(drawer.getByText('Ready · read-only checks passed')).toBeVisible();
  await expect(drawer.getByText(chainStatus.reason, { exact: true })).toBeVisible();
  await expect(drawer.getByText(`chain ${chainStatus.chain_id}`)).toBeVisible();
  if (chainStatus.wallet_address) await expect(drawer.getByText(chainStatus.wallet_address.slice(0, 8))).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('pf-018-desktop.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);
});

test('PF-018 shows a pending state while the backend is still answering', async ({ page }) => {
  // The request is only held back for a moment; the real response is passed through untouched.
  await page.route('**/api/backend/chain/status', async (route) => { await new Promise((resolve) => setTimeout(resolve, 1500)); await route.continue(); });
  await signIn(page);
  await expect(page.getByText('Checking chain')).toBeVisible();
  await expect(page.getByText('Chain ready', { exact: true })).toBeVisible();
  await expect(page.getByText('Checking chain')).toHaveCount(0);
});

test('PF-018 sends an expired session back to the login page', async ({ page, context }) => {
  await signIn(page);
  await expect(page.getByText('Chain ready', { exact: true })).toBeVisible(); // first load finished while the session was valid
  await context.clearCookies(); // the browser no longer holds a valid session, so the real backend answers 401
  await page.getByRole('button', { name: CHAIN_BUTTON }).click();
  await page.getByRole('button', { name: 'Check again' }).click();
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
  await expect(page.getByRole('button', { name: 'Testnet unavailable' })).toBeVisible();
  await expect(page.getByText('Chain unavailable', { exact: true })).toBeVisible();
  await expect(page.getByTestId('protected-total')).toBeVisible(); // financial state still shows
  await page.getByRole('button', { name: 'Testnet unavailable' }).click();
  const drawer = page.getByRole('dialog', { name: 'Your testnet connection' });
  await expect(drawer).toContainText('Backend unavailable');
  await expect(drawer.getByText('Wallet')).toHaveCount(0); // and no invented chain details take its place

  fail = false;
  await drawer.getByRole('button', { name: 'Check again' }).click();
  await expect(drawer.getByText('Ready · read-only checks passed')).toBeVisible();
});

test('PF-018 navigation has four real destinations and every old address still lands somewhere', async ({ page }) => {
  await signIn(page);
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  for (const [name, href] of [['Home', '/'], ['Ask', '/ask'], ['Rules', '/rules'], ['Activity', '/activity']]) {
    await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
  }
  for (const [from, to] of [['/constitution', /\/rules$/], ['/workspace', /\/ask$/], ['/time-machine?amount=5', /\/ask\?amount=5$/], ['/certificates?id=cert-1', /\/approve\?id=cert-1$/],
    ['/red-team', /\/security$/], ['/audit', /\/activity$/], ['/certificate-verifier?id=cert-1', /\/activity\/check\?id=cert-1$/]] as const) {
    await page.goto(from);
    await expect(page).toHaveURL(to);
  }
});

test('PF-018 sign-in page renders for visual review', async ({ page }, testInfo) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in', exact: true })).toBeVisible();
  await expect(page.getByLabel('Demo password')).toBeVisible();
  const button = page.getByRole('button', { name: 'Sign in', exact: true });
  await expect(button).toBeVisible();
  await expect(button).toHaveCSS('background-color', 'rgb(255, 238, 108)');
  await page.screenshot({ path: testInfo.outputPath('pf-018-login.png'), fullPage: true });
});

test('PF-018 stays inside the screen width on a phone', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await expect(page.getByText('Chain ready', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('pf-018-mobile.png'), fullPage: true });
});
