import { password } from './test-credentials.json';
import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export async function signIn(page: Page) {
  // PUBLIC test credential; never read the developer's real password into failure artifacts.
  await page.goto('/login');
  await page.getByLabel('Demo password').fill(password);
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(page.getByRole('button',{name:'Sign out'})).toBeVisible();
}
