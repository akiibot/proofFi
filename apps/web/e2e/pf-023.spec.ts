import { test, expect } from './fixtures';
import { signIn } from './auth-helper';
import recorded from '../../../evidence/controlled-attack.json';
import recordedEvents from '../../../evidence/red-team-recorded-audit.json';

const acknowledgement = /Run the controlled \$4,000 borrowed-funding proposal/;

test('PF-023 acknowledgement is required and the real route rejects public input', async ({ page }) => {
  await signIn(page);
  await page.getByRole('navigation', { name: 'Screens' }).getByRole('link', { name: 'Red team', exact: true }).click();
  const button = page.getByRole('button', { name: 'Run controlled attack' });
  await expect(button).toBeDisabled();
  // Exercise the real protected backend and its no-public-input boundary.
  await page.route('**/api/backend/demo/attack', route => route.continue({ postData: JSON.stringify({ amount_minor: 1 }) }));
  await page.getByLabel(acknowledgement).check();
  const response = page.waitForResponse(r => r.url().endsWith('/api/backend/demo/attack'));
  await button.click();
  const r = await response;
  expect(r.status()).toBe(422);
  expect((await r.json()).message).toBe('Attack demo accepts no input body');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Attack demo accepts no input body');
  await expect(page.getByTestId('attack-verdict')).toHaveCount(0);
  await expect(page.getByLabel(acknowledgement)).not.toBeChecked();
});

// Frozen real response/audit data used only as an isolated browser rendering fixture.
// This test does not execute the backend attack or establish genuine browser acceptance.
test('PF-023 recorded response fixture shows actual rejection values and matching audit records', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/backend/demo/attack', route => route.fulfill({ json: recorded.response }));
  await page.route('**/api/backend/audit', route => route.fulfill({ json: recordedEvents }));
  await page.goto('/red-team');
  await page.getByLabel(acknowledgement).check();
  await page.getByRole('button', { name: 'Run controlled attack' }).click();
  await expect(page.getByTestId('attack-verdict')).toContainText('Controlled proposal blocked');
  await expect(page.getByRole('region', { name: 'Attack result' })).toContainText('$4,000');
  await expect(page.getByTestId('signer-called')).toHaveText('No');
  await expect(page.getByTestId('attack-tx')).toHaveText('None reported');
  await expect(page.getByRole('region', { name: 'Attack result' })).toContainText('ATTACK_EXECUTOR_REJECTED');
  await expect(page.getByLabel(acknowledgement)).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Run controlled attack' })).toBeDisabled();
});

test('PF-023 response loss reports unknown outcome and locks blind retries', async ({ page }) => {
  await signIn(page);
  let submissions = 0;
  await page.route('**/api/backend/demo/attack', async route => {
    submissions++;
    await route.fetch();
    await route.abort('failed');
  });
  await page.goto('/red-team');
  await page.getByLabel(acknowledgement).check();
  await page.getByRole('button', { name: 'Run controlled attack' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('The attempt outcome is unconfirmed.');
  await expect(page.getByRole('main').getByRole('alert')).not.toContainText('nothing was verified');
  await expect(page.getByRole('button', { name: 'Run controlled attack' })).toBeDisabled();
  expect(submissions).toBe(1);
});

test('PF-023 audit read failure cannot replace a received rejection response', async ({ page }) => {
  await signIn(page);
  await page.route('**/api/backend/demo/attack', route => route.fulfill({ json: recorded.response }));
  await page.route('**/api/backend/audit', route => route.fulfill({ status: 503, json: { code: 'UNAVAILABLE', message: 'ISOLATED audit fixture unavailable', reasons: [] } }));
  await page.goto('/red-team');
  await page.getByLabel(acknowledgement).check();
  await page.getByRole('button', { name: 'Run controlled attack' }).click();
  await expect(page.getByTestId('attack-verdict')).toContainText('Controlled proposal blocked');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('attack response was received');
});

test('PF-023 red-team screen fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  await page.goto('/red-team');
  await expect(page.getByRole('heading', { name: 'Red team', level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
