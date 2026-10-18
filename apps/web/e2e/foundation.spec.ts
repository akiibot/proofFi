import { test, expect } from './fixtures';
import { signIn } from './auth-helper';
test('browser reads pristine seeded state and configured isolated chain without activating policy',async({page}, testInfo)=>{
  const chain = page.waitForResponse(r=>r.url().endsWith('/api/backend/chain/status'));
  const response = page.waitForResponse(r=>r.url().endsWith('/api/backend/financial-state'));
  await signIn(page);
  const stateResponse = await response;
  expect(stateResponse.status()).toBe(200);
  const state = await stateResponse.json();
  expect(state.snapshot.assets[0].amount_minor).toBe(1200000);
  expect(state.active_constitution_version).toBeNull();
  await expect(page.getByText('$12,000',{exact:true})).toBeVisible();
  await expect(page.getByText(state.snapshot_hash,{exact:true})).toBeVisible();
  const chainResponse = await chain;
  expect(chainResponse.status()).toBe(200);
  expect((await chainResponse.json()).status).toBe('READY'); // Explicit loopback fixture, not live readiness.
  await expect(page.getByText('Ready',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Refresh state'})).toBeEnabled();
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
