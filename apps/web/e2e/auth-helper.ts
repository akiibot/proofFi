import { password } from './test-credentials.json';
import type { Page, Request, Response } from '@playwright/test';
import { expect } from '@playwright/test';

export async function signIn(page: Page) {
  // PUBLIC test credential; never read the developer's real password into failure artifacts.
  // Failure-only telemetry for the current Windows hydration observation (#60).
  // Never capture credential values, headers, response bodies or raw console text.
  const started = Date.now();
  let phase = 'navigation';
  const events: object[] = [];
  const remember = (event: object) => { if (events.length < 40) events.push(event); };
  const localPath = (url: string) => {
    const parsed = new URL(url);
    return ['127.0.0.1', 'localhost'].includes(parsed.hostname) ? parsed.pathname : null;
  };
  const failed = (request: Request) => {
    const route = localPath(request.url());
    if (route?.startsWith('/_next/')) remember({ kind: 'asset-failure', path: route, code: request.failure()?.errorText.match(/(?:net::)?ERR_[A-Z_]+/)?.[0] ?? 'OTHER' });
  };
  const response = (reply: Response) => {
    const route = localPath(reply.url());
    if (route?.startsWith('/_next/') && reply.request().resourceType() === 'script') remember({ kind: 'script-response', path: route, status: reply.status() });
    if (route === '/api/backend/auth/login') remember({ kind: 'login-response', status: reply.status() });
  };
  const pageError = (error: Error) => remember({ kind: 'javascript-error', chunk: /chunk|dynamically imported module/i.test(error.message), hydration: /hydration/i.test(error.message), type: ['Error', 'TypeError', 'ReferenceError', 'SyntaxError', 'ChunkLoadError'].includes(error.name) ? error.name : 'OtherError' });
  page.on('requestfailed', failed); page.on('response', response); page.on('pageerror', pageError);
  try {
    await page.goto('/login');
    phase = 'hydration/input';
    await page.getByLabel('Demo password').fill(password);
    phase = 'authentication';
    await page.getByRole('button',{name:'Sign in',exact:true}).click();
    phase = 'dashboard';
    await expect(page.getByRole('button',{name:'Sign out'})).toBeVisible();
  } catch (error) {
    console.error('PF026_LOGIN_DIAGNOSTIC ' + JSON.stringify({ phase, elapsed_ms: Date.now() - started, path: localPath(page.url()), events }));
    throw error;
  } finally {
    page.off('requestfailed', failed); page.off('response', response); page.off('pageerror', pageError);
  }
}
