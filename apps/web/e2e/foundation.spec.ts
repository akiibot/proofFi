import { test, expect } from './fixtures';
import { signIn } from './auth-helper';
import { getJson } from './api-helpers';

const usd = (minor: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(minor / 100);

test('browser reads pristine seeded state and configured isolated chain without activating policy',async({page}, testInfo)=>{
  await signIn(page);
  const state = await getJson(page, 'financial-state');
  expect(state.snapshot.assets[0].amount_minor).toBe(1200000);
  expect(state.active_constitution_version).toBeNull();
  // Home arithmetic, derived here from the API response and not from the page's own helpers.
  const liquid = state.snapshot.assets.filter((a: { liquid: boolean }) => a.liquid).reduce((s: number, a: { amount_minor: number }) => s + a.amount_minor, 0);
  const tuition = state.snapshot.obligations.filter((o: { protected: boolean }) => o.protected).reduce((s: number, o: { amount_minor: number }) => s + o.amount_minor, 0);
  const living = state.snapshot.recurring_expenses.reduce((s: number, e: { amount_minor: number; due_days: number[] }) => s + e.amount_minor * e.due_days.length, 0);
  await expect(page.getByTestId('protected-total')).toHaveText(usd(tuition));
  await expect(page.getByTestId('free-total')).toHaveText(usd(liquid - tuition - living));
  await expect(page.getByText('No rules active')).toBeVisible(); // pristine seed: nothing is implied to be protected by rules
  expect((await getJson(page, 'chain/status')).status).toBe('READY'); // Explicit loopback fixture, not live readiness.
  await expect(page.getByText('Chain ready',{exact:true})).toBeVisible();
  await expect(page.getByText('Record intact',{exact:true})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('foundation-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:testInfo.outputPath('foundation-mobile.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
test('web proxy rejects unauthenticated mutations and arbitrary paths',async({request})=>{
  expect((await request.post('/api/backend/execute',{data:{}})).status()).toBe(401);
  expect((await request.get('/api/backend/anything')).status()).toBe(501);
});

test('execution observation proxy permits authenticated GET only and refuses arbitrary suffixes', async ({ page }) => {
  await signIn(page);
  expect((await page.request.get('/api/backend/executions/missing-observation')).status()).toBe(409);
  expect((await page.request.post('/api/backend/executions/missing-observation', { data: {} })).status()).toBe(501);
  expect((await page.request.get('/api/backend/executions/missing-observation/envelope')).status()).toBe(501);
  await page.context().clearCookies();
  expect((await page.request.get('/api/backend/executions/missing-observation')).status()).toBe(401);
});
