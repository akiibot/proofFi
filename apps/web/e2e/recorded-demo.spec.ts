import { test, expect } from '@playwright/test';
test('recorded walkthrough is instant, labeled, and never calls financial services', async ({ page }) => {
  const financial: string[] = [];
  page.on('request', r => { if (r.url().includes('/api/backend/')) financial.push(r.url()); });
  await page.goto('/demo');
  await expect(page.getByText('Recorded example · sending disabled', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByText(/\$2,000 maximum after 24 checks/)).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('link', { name: 'View the original recorded certificate' })).toHaveAttribute('href', /hosted-action-certificate.json$/);
  await expect(page.getByRole('link', { name: 'Try live', exact: true })).toHaveAttribute('href', '/login#live-demo');
  await page.getByRole('button', { name: 'Replay example' }).click();
  await expect(page.getByRole('status')).toHaveText('Step 1 of 3');
  expect(financial).toEqual([]);
});
