import { test, expect } from './fixtures';
import { signIn } from './auth-helper';
test('browser reads actual seeded backend state and exposes unfinished capabilities',async({page}, testInfo)=>{
  const response = page.waitForResponse(r=>r.url().endsWith('/api/backend/financial-state'));
  await signIn(page);
  const stateResponse = await response;
  expect(stateResponse.status()).toBe(200);
  const state = await stateResponse.json();
  expect(state.snapshot.assets[0].amount_minor).toBe(1200000);
  expect(state.active_constitution_version).toBeNull();
  await expect(page.getByText('$12,000',{exact:true})).toBeVisible();
  await expect(page.getByText(state.snapshot_hash,{exact:true})).toBeVisible();
  await expect(page.getByText('Not configured',{exact:true})).toBeVisible();
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
