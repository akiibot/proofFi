import { test, expect } from './fixtures';
import { signIn } from './auth-helper';

// POST /demo/attack returns 501 until PF-031 lands. The test accepts either answer and checks the screen states
// exactly what the backend said: today the honest "not available", later a denied, unsigned, hash-free attack.

test('PF-023 the attack needs an explicit acknowledgement before it runs', async ({ page }) => {
  await signIn(page);
  await page.getByRole('navigation', { name: 'Screens' }).getByRole('link', { name: 'Red team' }).click();
  const launch = page.getByRole('button', { name: 'Run the attack' });
  await expect(launch).toBeDisabled();
  await page.getByLabel(/deliberately malicious proposal/).check();
  await expect(launch).toBeEnabled();
});

test('PF-023 shows the real backend outcome of the attack and never a transaction hash', async ({ page }, testInfo) => {
  await signIn(page);
  await page.goto('/red-team');
  await page.getByLabel(/deliberately malicious proposal/).check();
  const response = page.waitForResponse((r) => r.url().endsWith('/api/backend/demo/attack'));
  await page.getByRole('button', { name: 'Run the attack' }).click();
  const r = await response;
  const body = await r.json();
  if (r.status() === 200) {
    expect(body.signer_called).toBe(false);
    expect(body.tx_hash ?? null).toBeNull();
    await expect(page.getByTestId('attack-verdict')).toContainText(body.verification.verdict.decision === 'DENY' ? 'AI fooled. Funds safe.' : 'not fully contained');
    await expect(page.getByTestId('signer-called')).toHaveText('No');
    await expect(page.getByTestId('attack-tx')).toHaveText('None. No transaction exists.');
  } else {
    const alert = page.getByRole('alert').filter({ hasText: r.status() === 501 ? 'The red-team demo is not available yet.' : 'The attack demo failed.' });
    await expect(alert).toContainText(body.message);
    await expect(alert).toContainText('nothing was verified, signed or sent');
    await expect(page.getByTestId('attack-verdict')).toHaveCount(0); // no invented "funds safe" banner
  }
  await page.screenshot({ path: testInfo.outputPath('pf-023-red-team.png'), fullPage: true });
});

test('PF-023 red-team screen fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto('/red-team');
  await expect(page.getByRole('heading', { name: 'Red team', level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
