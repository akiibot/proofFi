import { test, expect } from './fixtures';
import { signIn } from './auth-helper';

test('PF-049 legacy redirects preserve certificate, filter and exact-action query parameters', async ({ page }) => {
  await signIn(page);
  for (const [from, to] of [['/constitution', '/rules'], ['/workspace', '/ask'], ['/time-machine', '/ask'], ['/certificates', '/approve'], ['/red-team', '/security'], ['/audit', '/activity'], ['/certificate-verifier', '/activity/check']]) {
    const query = '?id=isolated-cert&amount=123.45&token=0x123&recipient=0x456&filter=needs-you';
    const response = await page.request.get(from + query, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    const target = new URL(response.headers().location, 'http://127.0.0.1:3000');
    expect(target.pathname).toBe(to);
    expect(target.search).toBe(query);
  }
  await page.goto('/time-machine?amount=123.45&token=0x123&recipient=0x456');
  await expect(page.getByLabel('Amount (USD)')).toHaveValue('123.45');
  await page.getByRole('button', { name: /Where it goes/ }).click();
  await expect(page.getByLabel('Token address')).toHaveValue('0x123');
  await expect(page.getByLabel('Recipient address')).toHaveValue('0x456');
});

test('PF-049 reopened dialog traps keyboard focus, Escape restores trigger, and primary screens fit 320px', async ({ page }) => {
  await signIn(page);
  const trigger = page.getByRole('button', { name: 'Record an expense' });
  const dialog = page.getByRole('dialog', { name: 'Record an unexpected expense' });
  for (let i = 0; i < 2; i++) {
    await trigger.click();
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    expect(await dialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Tab');
    await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  }
  await page.setViewportSize({ width: 320, height: 740 });
  for (const route of ['/', '/ask', '/rules', '/rules/history', '/activity', '/activity/check', '/security']) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), route).toBe(true);
  }
});
