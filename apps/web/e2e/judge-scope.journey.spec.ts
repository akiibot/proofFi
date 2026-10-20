import { test, expect } from './fixtures';
import { signIn } from './auth-helper';
import { launchJudge } from './judge-helper';
import { getJson, writeHeaders, ensureConstitution } from './api-helpers';

test('judge: cross-tab replacement, hidden snapshots and operator recovery records stay isolated', async ({ page, context }) => {
  test.setTimeout(150000);
  await signIn(page);
  const before = await getJson(page, 'financial-state');
  await page.evaluate(() => {
    sessionStorage.setItem('prooffi.lastSafe', JSON.stringify({ amountMinor: 9876543, stateVersion: 2 }));
    sessionStorage.setItem('prooffi.execute.preserved', '{"idempotency_key":"operator-recovery-preserved"}');
    localStorage.setItem('vallet.tour.v1', 'done');
  });
  const switcher = await context.newPage();
  try {
    const a = await launchJudge(switcher);
    await page.bringToFront();
    await expect(page.getByText('Judge demo', { exact: true })).toBeVisible();
    if (await page.getByTestId('tour').count()) await page.getByTestId('tour').getByRole('button', { name: 'Skip', exact: true }).click();
    await ensureConstitution(page);
    const expenseHeaders = await writeHeaders(page);
    const expense = await page.request.post('/api/backend/demo/emergency', { headers: expenseHeaders, data: { expected_state_version: 2, amount_minor: 200000 } });
    expect(expense.status()).toBe(200);
    const stateA = await getJson(page, 'financial-state');
    expect(stateA.snapshot.version).toBe(3);
    expect(await page.evaluate(() => localStorage.getItem('vallet.tour.v1'))).toBe('done');
    expect(await page.evaluate(scope => localStorage.getItem(`vallet.judge.${scope}.vallet.tour.v1`), a.scope_id)).toBe('skipped');

    // A real delayed financial response cannot repopulate a replaced scope.
    let release!: () => void, captured!: () => void;
    const held = new Promise<void>(resolve => { release = resolve; });
    const received = new Promise<void>(resolve => { captured = resolve; });
    await page.route('**/api/backend/financial-state', async route => {
      const response = await route.fetch(); captured(); await held; await route.fulfill({ response });
    }, { times: 1 });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await received;
    let releaseAccess!: () => void, capturedAccess!: () => void;
    const heldAccess = new Promise<void>(resolve => { releaseAccess = resolve; });
    const receivedAccess = new Promise<void>(resolve => { capturedAccess = resolve; });
    await page.route('**/api/backend/auth/access', async route => {
      const response = await route.fetch(); capturedAccess(); await heldAccess; await route.fulfill({ response });
    }, { times: 1 });
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await receivedAccess;
    const b = await launchJudge(switcher);
    expect(b.scope_id).not.toBe(a.scope_id);
    await page.bringToFront();
    await expect(page.getByText('Judge demo', { exact: true })).toBeVisible();
    const stateB = await getJson(page, 'financial-state');
    expect(stateB.id).not.toBe(stateA.id);
    await expect(page.getByTestId('free-total')).toHaveText('$6,800');
    releaseAccess(); release();
    await expect(page.getByTestId('free-total')).toHaveText('$6,800');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Record an expense', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Record an unexpected expense' })).toBeVisible();
    const portalHidden = await page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
      return [...document.querySelectorAll('[data-session-overlay]')].every(node => getComputedStyle(node).visibility === 'hidden');
    });
    expect(portalHidden).toBe(true);
    await expect(page.locator('[data-access-mode]')).toBeHidden();
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true })));
    await expect(page.getByText('Judge demo', { exact: true })).toBeVisible();
    await signIn(page);
    expect(await getJson(page, 'financial-state')).toEqual(before);
    expect(await page.evaluate(() => sessionStorage.getItem('prooffi.execute.preserved'))).toBe('{"idempotency_key":"operator-recovery-preserved"}');
    expect(await page.evaluate(() => sessionStorage.getItem('prooffi.lastSafe'))).toContain('9876543');
    expect(await page.evaluate(scope => localStorage.getItem(`vallet.judge.${scope}.vallet.tour.v1`), b.scope_id)).toBeNull();
  } finally { await switcher.close(); }
});

test('judge: unavailable cross-tab transports withhold financial content', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'BroadcastChannel', { value: undefined });
    Storage.prototype.setItem = () => { throw new Error('isolated storage unavailable'); };
  });
  await page.goto('/');
  await expect(page.getByText(/Enable browser storage or cross-tab notifications/)).toBeVisible();
  await expect(page.getByTestId('protected-total')).toHaveCount(0);
});

test('judge: failed consent retains operator authority and direct sending stays forbidden', async ({ page }) => {
  test.setTimeout(150000);
  await signIn(page);
  const before = await getJson(page, 'financial-state');
  const refused = await page.request.post('/api/backend/auth/judge', { headers: { Origin: 'http://127.0.0.1:3000' }, data: { profile_id: 'synthetic-funded-demo-v1', accept_synthetic_assumptions: false } });
  expect(refused.status()).toBe(422);
  expect(await getJson(page, 'financial-state')).toEqual(before);
  await launchJudge(page);
  const headers = await writeHeaders(page);
  for (const route of ['approvals', 'execute', 'demo/attack', 'demo/reset']) {
    expect((await page.request.post(`/api/backend/${route}`, { headers, data: {} })).status()).toBe(403);
  }
  await page.goto('/security');
  await expect(page.getByRole('button', { name: 'Executor probe disabled' })).toBeDisabled();
  await page.goto('/login');
  await page.goBack();
  await expect(page.getByText('Judge demo', { exact: true })).toBeVisible();
});

test('judge: missing authority and unavailable metadata never restore financial content', async ({ page, context }) => {
  await signIn(page);
  await expect(page.getByTestId('protected-total')).toBeVisible();
  await page.route('**/api/backend/auth/access', route => route.abort('failed'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page.locator('[data-access-mode]')).toBeHidden();
  await expect(page.getByText('Failed to fetch', { exact: true })).toBeVisible();
  await page.unroute('**/api/backend/auth/access');
  await context.clearCookies();
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByTestId('protected-total')).toHaveCount(0);
});
