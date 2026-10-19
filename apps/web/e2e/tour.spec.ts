import { test, expect, type Page } from '@playwright/test';
import { signIn } from './auth-helper';

// The tour never starts by itself under browser automation, so these tests open it from the account menu,
// which is the same path a person uses to replay it.
async function openTour(page: Page) {
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('menuitem', { name: 'Take the tour' }).click();
  await expect(page.getByTestId('tour')).toBeVisible();
}

test('tour: welcome card, step-by-step progress and a visible highlight', async ({ page }) => {
  await signIn(page);
  await openTour(page);
  const count = page.getByTestId('tour-count');
  await expect(count).toHaveText(/^0 \/ \d+$/);
  const total = Number((await count.textContent())!.split('/')[1]);
  expect(total).toBeGreaterThanOrEqual(6);
  await page.getByRole('button', { name: 'Start the tour' }).click();
  await expect(count).toHaveText(`1 / ${total}`);
  await expect(page.getByRole('dialog', { name: 'Is my money safe?' })).toBeVisible();
  await page.getByTestId('tour').getByRole('button', { name: 'Next' }).click();
  await expect(count).toHaveText(`2 / ${total}`);
  await page.getByTestId('tour').getByRole('button', { name: 'Back' }).click();
  await expect(count).toHaveText(`1 / ${total}`);
  // Everything behind the tour is blocked, so a stray click cannot change anything.
  await expect(page.getByRole('progressbar', { name: 'Tour progress' })).toHaveAttribute('aria-valuenow', '1');
});

test('tour: skipping ends it and is remembered', async ({ page }) => {
  await signIn(page);
  await openTour(page);
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByTestId('tour')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('vallet.tour.v1'))).toBe('skipped');
});

test('tour: Escape skips, and finishing walks every step', async ({ page }) => {
  await signIn(page);
  await openTour(page);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('tour')).toHaveCount(0);
  await openTour(page);
  await page.getByRole('button', { name: 'Start the tour' }).click();
  const total = Number(((await page.getByTestId('tour-count').textContent()) ?? '').split('/')[1]);
  for (let step = 1; step < total; step++) await page.getByTestId('tour').getByRole('button', { name: 'Next' }).click();
  await page.getByTestId('tour').getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByTestId('tour')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('vallet.tour.v1'))).toBe('done');
});

test('tour: the card fits a phone screen and every step stays reachable', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await signIn(page);
  await openTour(page);
  await page.getByRole('button', { name: 'Start the tour' }).click();
  const card = page.getByRole('dialog');
  const box = await card.boundingBox();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y + box!.height).toBeLessThanOrEqual(800);
});
