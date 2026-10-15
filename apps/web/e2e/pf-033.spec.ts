import { test, expect } from '@playwright/test';
import { signIn } from './auth-helper';

test('PF-033 login, protected read, CSRF refusal and logout use real backend sessions',async({page,context})=>{
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);
  await signIn(page);
  await expect(page.getByText('$12,000',{exact:true})).toBeVisible();
  const cookie=(await context.cookies()).find(c=>c.name==='prooffi_session');
  expect(cookie?.httpOnly).toBe(true);
  expect(cookie?.sameSite).toBe('Strict');
  const missingCsrf = await page.evaluate(async()=>{
    const response=await fetch('/api/backend/execute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({certificate_id:'fake',action_digest:'a'.repeat(64),idempotency_key:'browser-test-key'})});
    return response.status;
  });
  expect(missingCsrf).toBe(403);
  await page.getByRole('button',{name:'Sign out'}).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await context.request.get('/api/backend/financial-state')).status()).toBe(401);
});

test('PF-033 unauthenticated requests cannot borrow a server credential',async({request})=>{
  expect((await request.get('/api/backend/financial-state',{headers:{Authorization:'Bearer fake','X-User-Id':'demo-user'}})).status()).toBe(401);
  expect((await request.post('/api/backend/auth/login',{data:{password:'wrong-test-password'}})).status()).toBe(403);
});
