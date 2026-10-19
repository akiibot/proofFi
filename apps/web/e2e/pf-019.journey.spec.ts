import { test, expect, type Page } from './fixtures';
import { signIn } from './auth-helper';
import { canonicalDigest } from '../src/lib/canonical';

// Runs against the isolated e2e database (see e2e/server.mjs). Each test is written to hold whatever the
// active version is when it starts, so the order inside this file does not matter.

const ORIGIN = 'http://127.0.0.1:3000';

async function apiState(page: Page) {
  const state = await (await page.request.get('/api/backend/financial-state')).json();
  const history = await (await page.request.get('/api/backend/constitutions/history')).json();
  return { activeId: state.active_constitution_version as string | null, history: history as { id: string; version: number; policy_digest: string; rules: Record<string, unknown> }[] };
}

async function openRules(page: Page) {
  await signIn(page, '/rules');
  await page.getByRole('button', { name: /^(Edit rules|Set up my rules)$/ }).click();
  await expect(page.getByRole('button', { name: 'Review changes' })).toBeVisible();
}

/** Address lists are edited inside a chip such as "0 known addresses"; open it to reach its text box. */
async function expandList(page: Page, name: RegExp) { await page.getByRole('button', { name }).click(); }

const reviewDialog = (page: Page) => page.getByRole('dialog', { name: 'Review draft' });
const changeRow = (page: Page, label: string) => reviewDialog(page).getByRole('listitem').filter({ hasText: label });

test('PF-019 saving a draft shows the change but never activates it', async ({ page }) => {
  await openRules(page);
  const before = await apiState(page);
  await page.getByLabel('Autonomy limit (USD)').fill('120');
  await page.getByRole('button', { name: 'Review changes' }).click();

  const review = reviewDialog(page);
  await expect(review).toBeVisible();
  await expect(changeRow(page, 'AI may act alone up to')).toContainText('$120');
  await expect(review.getByRole('button', { name: 'Activate' })).toBeDisabled();

  const after = await apiState(page);
  expect(after.activeId).toBe(before.activeId); // a draft is not authority
  expect(after.history.length).toBe(before.history.length);
});

test('PF-019 a late initial load cannot replace rules the person has edited', async ({ page }) => {
  await signIn(page);
  let release!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  let draftsRequests = 0;
  let newerFetched!: () => void;
  const newerResponse = new Promise<void>((resolve) => { newerFetched = resolve; });
  await page.route('**/api/backend/constitutions/drafts', async (route) => {
    if (route.request().method() !== 'GET') return route.continue();
    const request = ++draftsRequests; // identify arrival order before asynchronous I/O
    if (request === 1) await newerResponse; // force the newer fetch to complete first
    const response = await route.fetch();
    if (request === 2) newerFetched();
    if (request === 1) await held;
    await route.fulfill({ response }); // reorder real responses; do not substitute policy data
  });
  try {
    await page.goto('/rules');
    await expect.poll(() => draftsRequests).toBe(2);
    await page.getByRole('button', { name: /^(Edit rules|Set up my rules)$/ }).click();
    const input = page.getByLabel('Autonomy limit (USD)');
    await expect(page.getByRole('button', { name: 'Review changes' })).toBeVisible();
    await input.fill('111');
    const late = page.waitForResponse((r) => r.url().endsWith('/api/backend/constitutions/drafts'));
    release();
    await late;
    await expect(input).toHaveValue('111');
    await page.getByRole('button', { name: 'Review changes' }).click();
    await expect(changeRow(page, 'AI may act alone up to')).toContainText('$111');
  } finally { release(); newerFetched(); }
});

test('PF-019 confirming needs the explicit checkbox and activates exactly the reviewed rules', async ({ page }, testInfo) => {
  await openRules(page);
  await page.getByLabel('Autonomy limit (USD)').fill('125');
  await page.getByLabel('Emergency floor (USD)').fill('2100');
  await page.getByRole('button', { name: 'Review changes' }).click();
  const review = reviewDialog(page);
  const activate = review.getByRole('button', { name: 'Activate' });
  await expect(review.getByTestId('draft-digest')).toHaveText(/^[0-9a-f]{64}$/);
  const shownDigest = await review.getByTestId('draft-digest').innerText();
  await expect(activate).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('pf-019-review.png'), fullPage: true });
  await review.getByLabel(/Yes, make these my rules/).check();
  await activate.click();

  await expect(page.getByRole('status').filter({ hasText: 'is now your active rules' })).toBeVisible();
  const { activeId, history } = await apiState(page);
  const newest = [...history].sort((a, b) => b.version - a.version)[0];
  expect(activeId).toBe(newest.id);
  expect(newest.policy_digest).toBe(shownDigest); // what the person saw is what the backend stored
  expect(newest.rules.autonomy_limit_minor).toBe(12500);
  expect(newest.rules.emergency_floor_minor).toBe(210000);
  await expect(page.getByText(`Version ${newest.version} · active`)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('pf-019-active.png'), fullPage: true });

  // Home now reports the active version instead of "no rules".
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Home' }).click();
  await expect(page.getByText(`Rules v${newest.version} active`)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Your budget needs attention.', exact: true })).toBeVisible();
  await expect(page.getByText('Your planning budget is $300 short', { exact: false })).toBeVisible();
  await expect(page.getByText('Budget shortfall', { exact: true })).toBeVisible();
  await expect(page.getByTestId('free-total')).toHaveText('$300');
  await expect(page.getByText('Shortfall $300', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: /is (still )?safe/ })).toHaveCount(0);
});

test('PF-019 rejects malformed values in the browser before anything is sent', async ({ page }) => {
  await openRules(page);
  let posted = 0;
  page.on('request', (r) => { if (r.method() === 'POST' && r.url().endsWith('/api/backend/constitutions/drafts')) posted++; });
  await page.getByLabel('Tuition reserve (USD)').fill('lots');
  await page.getByLabel('Maximum reserve-breach probability (%)').fill('150');
  await expandList(page, /known address/);
  await page.getByLabel('Known recipients').fill('0x' + 'd'.repeat(40));
  await expandList(page, /blocked address/);
  await page.getByLabel('Blocked recipients').fill('0x' + 'd'.repeat(40));
  await page.getByRole('button', { name: 'Review changes' }).click();

  await expect(page.getByText('Enter a dollar amount like 7000 or 7000.50.')).toBeVisible();
  await expect(page.getByText('A percentage cannot be above 100.')).toBeVisible();
  await expect(page.getByText('An address cannot be both known and blocked.')).toBeVisible();
  await expect(page.getByLabel('Tuition reserve (USD)')).toHaveAttribute('aria-invalid', 'true');
  await expect(reviewDialog(page)).toHaveCount(0);
  expect(posted).toBe(0);
});

test('PF-019 refuses to confirm a draft once the active version changed elsewhere', async ({ page }) => {
  await openRules(page);
  await page.getByLabel('Autonomy limit (USD)').fill('130');
  await page.getByRole('button', { name: 'Review changes' }).click();
  const review = reviewDialog(page);
  await expect(review).toBeVisible();

  // Meanwhile another tab confirms a different draft through the real API.
  const { activeId, history } = await apiState(page);
  const activeRules = history.find((v) => v.id === activeId)?.rules ?? null;
  const session = await (await page.request.get('/api/backend/auth/session')).json();
  const headers = { Origin: ORIGIN, 'X-CSRF-Token': session.csrf_token };
  const rules = { ...(activeRules ?? { allowed_tokens: [], known_recipients: [] }), autonomy_limit_minor: 14000 };
  const created = await page.request.post('/api/backend/constitutions/drafts', { headers, data: { base_version: activeId, rules } });
  expect(created.status()).toBe(200);
  const other = await created.json();
  const confirmed = await page.request.post('/api/backend/constitutions/confirm', { headers, data: { draft_id: other.id, confirmed: true, expected_policy_digest: await canonicalDigest(other.rules) } });
  expect(confirmed.status()).toBe(200);
  const otherVersion = await confirmed.json();

  await review.getByLabel(/Yes, make these my rules/).check();
  await review.getByRole('button', { name: 'Activate' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Your active rules changed since this draft was made' })).toBeVisible();
  await expect(page.getByText(`Version ${otherVersion.version} · active`)).toBeVisible();
  expect((await apiState(page)).activeId).toBe(otherVersion.id); // the stale draft did not win
});

test('PF-019 history lists versions newest first with exactly one active', async ({ page }) => {
  await signIn(page, '/rules/history');
  const { history, activeId } = await apiState(page);
  test.skip(history.length === 0, 'needs at least one confirmed version from the journeys above');
  const versions = page.locator('ol > li[aria-label^="Version"]');
  await expect(versions).toHaveCount(history.length);
  const newest = Math.max(...history.map((v) => v.version));
  await expect(versions.first()).toHaveAttribute('aria-label', `Version ${newest}`);
  await expect(versions.getByText('Active', { exact: true })).toHaveCount(1);
  expect(history.some((v) => v.id === activeId)).toBe(true);
});

test('PF-019 Rules screen fits a phone screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openRules(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
