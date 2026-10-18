import { test, expect } from './fixtures';
import { signIn } from './auth-helper';
const pages=[['/','Your goals.'],['/constitution','Constitution'],['/workspace','Workspace'],['/time-machine','Time Machine'],['/certificates','Certificates'],['/certificate-verifier','Certificate verifier'],['/red-team','Red team'],['/audit','Audit'],['/settings','Settings']];
test('Overhaul all routes retain keyboard-accessible navigation and fit mobile in both themes',async({page})=>{
 await signIn(page);
 await page.setViewportSize({width:320,height:850});
 for(const theme of ['light','dark']) {
  await page.goto('/settings');await page.getByLabel('Appearance',{exact:true}).selectOption(theme);
  for(const [route,heading] of pages) {
   await page.goto(route);await expect(page.getByRole('heading',{level:1})).toContainText(heading);
   await expect(page.locator('html')).toHaveAttribute('data-theme',theme);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
   await expect(page.getByRole('navigation',{name:'Screens'})).toBeVisible();
  }
 }
 await page.goto('/settings');await page.getByLabel('Appearance',{exact:true}).selectOption('system');
 await page.emulateMedia({colorScheme:'dark'});expect(await page.locator('html').evaluate(el=>getComputedStyle(el).colorScheme)).toBe('dark');
 await page.emulateMedia({colorScheme:'light'});expect(await page.locator('html').evaluate(el=>getComputedStyle(el).colorScheme)).toBe('light');
});
test('Overhaul maintenance requires acknowledgement and preserves real refusal',async({page})=>{
 await signIn(page);await page.goto('/settings');
 const reset=page.getByRole('button',{name:'Restore recorded demo',exact:true});await expect(reset).toBeDisabled();
 const state=await page.request.get('/api/backend/financial-state');const before=await state.json();
 await page.getByLabel('I want to restore the recorded funded demo selection.').check();
 const response=page.waitForResponse(r=>r.url().endsWith('/demo/reset'));await reset.click();
 expect((await response).status()).toBe(409);
 expect(await (await page.request.get('/api/backend/financial-state')).json()).toEqual(before);
 await expect(page.getByRole('status')).toContainText('recorded funded selection');
});
