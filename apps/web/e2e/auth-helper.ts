import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export async function signIn(page: Page) {
  // Local provisioned secret is read by the test runner, never bundled into web code.
  const password = process.env.PROOFFI_TEST_PASSWORD ?? readFileSync(path.resolve(__dirname,'../../../.local/demo-password.txt'),'utf8').trim();
  await page.goto('/login');
  await page.getByLabel('Demo password').fill(password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sign out'})).toBeVisible();
}
