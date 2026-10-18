import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { test, expect, type Page } from './fixtures';
import { signIn } from './auth-helper';
import { candidate, ensureConstitution, getJson, RECIPIENT, TOKEN, writeHeaders } from './api-helpers';
import { canonicalDigest } from '../src/lib/canonical';
import credentials from './test-credentials.json';
import { captureActualResponses, type CapturedResponse } from './actual-response-capture';

// Real browser/API/SQLite/crypto/executor; ONLY the loopback chain is simulated.
// Genuine A/C and malicious rejection evidence are separately linked in the matrix.
const ROOT = path.resolve(__dirname, '../../..');
const python = path.join(ROOT, process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python');
test.beforeAll(() => {
  execFileSync(python, ['apps/web/e2e/seed_e2e_acceptance.py'], { cwd: ROOT, env: { ...process.env, PYTHONPATH: 'services/api', DATABASE_URL: 'sqlite:///./.local/e2e.db' } });
});

async function stats(page: Page) {
  const { url } = JSON.parse(readFileSync(path.join(ROOT, '.local/e2e-chain.json'), 'utf8'));
  expect(new URL(url).hostname).toBe('127.0.0.1');
  const response = await page.request.post(url, { data: { jsonrpc: '2.0', id: 1, method: 'prooffi_fixtureStats', params: [] } });
  return (await response.json()).result;
}
async function safe(page: Page, fromGoal = false) {
  if (fromGoal) { await page.goto('/'); await page.getByRole('link', { name: 'Ask ProofFi', exact: true }).click(); }
  else await page.goto('/ask');
  const optimized = page.waitForResponse(r => r.url().endsWith('/api/backend/optimize'));
  if (fromGoal) {
    await page.getByLabel('What should ProofFi do?').fill('Invest as much as possible while protecting tuition.');
    const planned = page.waitForResponse(r => r.url().endsWith('/api/backend/plans/generate'));
    await page.getByRole('button', { name: 'Check it', exact: true }).click();
    const plan = await planned;
    expect(plan.status()).toBe(200);
    expect((await plan.json()).mode).toBe('deterministic_demo');
  } else {
    await page.getByRole('button', { name: 'Or check an exact amount yourself' }).click();
    await page.getByRole('button', { name: /Where it goes/ }).click();
    await page.getByLabel('Token address').fill(TOKEN);
    await page.getByLabel('Recipient address').fill(RECIPIENT);
    await page.getByRole('button', { name: 'Find the largest safe amount', exact: true }).click();
  }
  const r = await optimized;
  expect(r.status()).toBe(200);
  const result = await r.json();
  expect(result.status).toBe('SAFE_ACTION');
  expect(result.max_amount_minor).toBeGreaterThan(0);
  expect(result.next_cent_rejected).toBe(true);
  await expect(page.getByTestId('optimizer-result')).toContainText('One cent more is refused');
  return result;
}
/** "Continue with $X": the independent verifier signs exactly the safe action, and the screen opens the approval. */
async function issue(page: Page) {
  const issued = page.waitForResponse(r => r.url().endsWith('/api/backend/verify'));
  await page.getByRole('button', { name: /^Continue with / }).click();
  const r = await issued;
  expect(r.status()).toBe(200);
  const result = await r.json();
  expect(result.certificate_id).toBeTruthy();
  await expect(page).toHaveURL(new RegExp('/approve\\?id=' + result.certificate_id));
  return result;
}

test('AT-11 draft stays inactive, confirmation is explicit and prior policy history is immutable', async ({ page }) => {
  await signIn(page); await ensureConstitution(page);
  const history = await getJson(page, 'constitutions/history');
  const state = await getJson(page, 'financial-state');
  await page.goto('/rules');
  await page.getByRole('button', { name: 'Edit rules' }).click();
  await page.getByLabel('Autonomy limit (USD)').fill('111');
  await page.getByRole('button', { name: 'Review changes' }).click();
  const review = page.getByRole('dialog', { name: 'Review draft' });
  await expect(review.getByRole('button', { name: 'Activate' })).toBeDisabled();
  expect((await getJson(page, 'financial-state')).active_constitution_version).toBe(state.active_constitution_version);
  await review.getByLabel(/Yes, make these my rules/).check();
  await review.getByRole('button', { name: 'Activate' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'is now your active rules' })).toBeVisible();
  const after = await getJson(page, 'constitutions/history');
  expect(after.length).toBe(history.length + 1);
  for (const old of history) expect(after.find((v: { id: string }) => v.id === old.id)).toEqual(old);
  const newest = after.reduce((a: { version: number }, b: { version: number }) => b.version > a.version ? b : a);
  expect(newest.rules.autonomy_limit_minor).toBe(11100);
  expect(await canonicalDigest(newest.rules)).toBe(newest.policy_digest);
});

test('AT-10 repeated trusted input retains exact simulation identity and displayed seed', async ({ page }) => {
  await signIn(page); await ensureConstitution(page);
  const headers = await writeHeaders(page); const action = candidate(150000, 'at10-reproducible');
  const a = await page.request.post('/api/backend/simulate', { headers, data: { action } });
  const b = await page.request.post('/api/backend/simulate', { headers, data: { action } });
  expect(a.status()).toBe(200); expect(b.status()).toBe(200);
  const first = await a.json(); expect(await b.json()).toEqual(first);
  await safe(page);
  await page.getByRole('button', { name: 'See the futures' }).click();
  const drawer = page.getByRole('dialog', { name: /futures with/ });
  await expect(drawer.getByTestId('metric-goal')).toBeVisible();
  await drawer.getByRole('button', { name: /^Assumptions · seed/ }).click();
  await expect(drawer.getByTestId('config-seed')).toHaveText(String(first.config.seed));
});

test('AT-02 oversized action is denied without a certificate or signing', async ({ page }) => {
  await signIn(page); await ensureConstitution(page); const before = await stats(page);
  const r = await page.request.post('/api/backend/verify', { headers: await writeHeaders(page), data: { action: candidate(1100000, 'at02-oversized') } });
  expect(r.status()).toBe(200); const result = await r.json();
  expect(result.verdict.decision).toBe('DENY'); expect(result.certificate_id).toBeNull(); expect(await stats(page)).toEqual(before);
});

test('AT-03 exact positive safe maximum independently verifies and its next cent is denied', async ({ page }) => {
  await signIn(page); await ensureConstitution(page); const result = await safe(page);
  const verified = await issue(page); expect(verified.certificate_id).toBeTruthy();
  const r = await page.request.post('/api/backend/verify', { headers: await writeHeaders(page), data: { action: { ...result.action, id: 'at03-next-cent', amount_minor: result.max_amount_minor + 1 } } });
  expect(r.status()).toBe(200); const rejected = await r.json(); expect(rejected.verdict.decision).toBe('DENY'); expect(rejected.certificate_id).toBeNull();
});

test('AT-04 controlled malicious borrowed proposal is denied without a certificate or dispatch', async ({ page }) => {
  await signIn(page); const before = await stats(page); await page.goto('/security');
  await page.getByLabel(/Run this controlled test/).check();
  const response = page.waitForResponse(r => r.url().endsWith('/api/backend/demo/attack'));
  await page.getByRole('button', { name: 'Run the test', exact: true }).click();
  const r = await response; expect(r.status()).toBe(200); const body = await r.json();
  expect(body.verification.verdict.decision).toBe('DENY'); expect(body.verification.certificate_id).toBeNull(); expect(body.signer_called).toBe(false); expect(body.tx_hash ?? null).toBeNull(); expect(await stats(page)).toEqual(before);
  await expect(page.getByTestId('attack-verdict')).toContainText('Your money is safe.');
});

test('AT-08/AT-09 one acknowledged expense reduces the maximum and invalidates the unchanged certificate', async ({ page }) => {
  await signIn(page); await ensureConstitution(page); const before = await getJson(page, 'financial-state');
  const optimized = await safe(page); const verified = await issue(page); const id = verified.certificate_id;
  const certificate = await getJson(page, 'certificates/' + id); const chainBefore = await stats(page);
  await page.goto('/');
  await expect(page.getByText(/approval waiting|ready to send/)).toBeVisible(); // the unsent certificate is waiting for the person
  await page.getByRole('button', { name: 'Record an expense' }).click();
  const dialog = page.getByRole('dialog', { name: 'Record an unexpected expense' });
  await dialog.getByLabel(/Yes, record this \$2,000 expense/).check();
  const response = page.waitForResponse(r => r.url().endsWith('/api/backend/demo/emergency'));
  await dialog.getByRole('button', { name: 'Record expense', exact: true }).click();
  const r = await response; expect(r.request().postDataJSON()).toEqual({ expected_state_version: before.snapshot.version, amount_minor: 200000 });
  expect(r.status()).toBe(200); const outcome = await r.json();
  expect(outcome.state.snapshot.version).toBe(before.snapshot.version + 1);
  expect(outcome.state.snapshot.realized_expense_minor).toBe(before.snapshot.realized_expense_minor + 200000);
  expect(outcome.optimization.max_amount_minor).toBeLessThan(optimized.max_amount_minor);
  expect(['SAFE_ACTION', 'NO_SAFE_ACTION']).toContain(outcome.optimization.status);
  expect(outcome.state.active_constitution_version).toBe(before.active_constitution_version);
  const total = (assets: { amount_minor: number }[]) => assets.reduce((sum, a) => sum + a.amount_minor, 0);
  expect(total(before.snapshot.assets) - total(outcome.state.snapshot.assets)).toBe(200000);
  await expect(page.getByTestId('emergency-result')).toContainText('no longer works');
  expect(await getJson(page, 'certificates/' + id)).toEqual(certificate);
  const status = await page.request.post('/api/backend/certificates/' + id + '/verify', { headers: await writeHeaders(page) });
  expect(status.status()).toBe(200); expect(await status.json()).toMatchObject({ status: 'SIGNED_BUT_STALE', signature_valid: true });
  const audit = await getJson(page, 'audit'); expect(audit.filter((e: { event_type: string }) => e.event_type === 'EMERGENCY_EXPENSE_RECORDED')).toHaveLength(1);
  expect(await stats(page)).toEqual(chainBefore);
});

test('AT-01 goal -> proposal -> safe amount -> certificate -> exact approval -> one dispatch -> confirmed audit', async ({ page }, testInfo) => {
  await signIn(page); await ensureConstitution(page); const before = await getJson(page, 'financial-state'); const initial = await stats(page); expect(initial.send_calls).toBe(0);
  await safe(page, true);
  await page.screenshot({ path: testInfo.outputPath('pf-049-ask.png'), fullPage: true });
  const result = await issue(page); const id = result.certificate_id; const certificate = await getJson(page, 'certificates/' + id);
  await expect(page.getByText('Your rules ask for your OK')).toBeVisible();
  await page.getByRole('button', { name: 'Show proof' }).click();
  await expect(page.getByRole('dialog', { name: /Proof/ })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('pf-049-proof.png'), fullPage: true });
  await page.keyboard.press('Escape');
  await page.getByLabel(/I approve and authorize sending exactly this/).check();
  const approval = page.waitForResponse(r => r.url().endsWith('/api/backend/approvals'));
  const execution = page.waitForResponse(r => r.url().endsWith('/api/backend/execute'));
  await page.getByRole('button', { name: 'Approve and send', exact: true }).click();
  expect((await approval).status()).toBe(200);
  const r = await execution; expect(r.status()).toBe(200); const observed = await r.json(); expect(['PENDING', 'CONFIRMED']).toContain(observed.status);
  if (observed.status === 'PENDING') {
    // The same retained identity reconciles the one recorded attempt; it never signs/sends again.
    const reconciled = page.waitForResponse(r => r.url().endsWith('/api/backend/execute'));
    await page.getByRole('button', { name: 'Refresh', exact: true }).click();
    expect((await reconciled).status()).toBe(200);
  }
  await expect(page.getByTestId('execution-result')).toContainText('CONFIRMED');
  await page.screenshot({ path: testInfo.outputPath('pf-049-confirmed.png'), fullPage: true });
  // Replaying the identical request (what a retry would send) returns the same transaction and never a second send.
  const replay = await page.request.post('/api/backend/execute', { headers: await writeHeaders(page), data: r.request().postDataJSON() });
  expect(replay.status()).toBe(200); const confirmed = await replay.json();
  expect(confirmed.status).toBe('CONFIRMED'); expect(confirmed.tx_hash).toBe(observed.tx_hash);
  const chain = await stats(page); expect(chain.send_calls).toBe(1); expect(chain.accepted_transactions).toBe(1); expect(chain.transaction_hash).toBe(confirmed.tx_hash);
  expect(await getJson(page, 'certificates/' + id)).toEqual(certificate);
  const after = await getJson(page, 'financial-state'); expect(after.snapshot.version).toBe(before.snapshot.version + 1);
  const audit = await getJson(page, 'audit');
  for (const type of ['EXECUTION_CLAIMED', 'EXECUTION_SIGNED', 'EXECUTION_ENVELOPE_STORED', 'EXECUTION_DISPATCH_RESERVED']) expect(audit.filter((e: { event_type: string; details: { certificate_id?: string; execution_id?: string } }) => e.event_type === type && e.details.certificate_id === id && e.details.execution_id === confirmed.id)).toHaveLength(1);
  const effects = audit.filter((e: { event_type: string; details: { execution_id?: string } }) => e.event_type === 'EXECUTION_LEDGER_APPLIED' && e.details.execution_id === confirmed.id);
  expect(effects).toHaveLength(1);
  expect(effects[0].details).toMatchObject({ tx_hash: confirmed.tx_hash, before_state_id: before.id, after_state_id: after.id, amount_minor: certificate.payload.action.amount_minor });
  await page.getByRole('link', { name: 'See the full record' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Confirmed on Base Sepolia');
  await page.screenshot({ path: testInfo.outputPath('pf-049-story.png'), fullPage: true });
  await page.getByRole('link', { name: 'Activity', exact: true }).first().click();
  await expect(page.getByTestId('chain-status')).toContainText('Record intact');
  await expect(page.getByTestId('activity-row').filter({ hasText: 'Confirmed on Base Sepolia' })).toHaveCount(1);
  await page.screenshot({ path: testInfo.outputPath('pf-049-activity.png'), fullPage: true });
});

// Separate route groups retain every scan/assertion with the existing per-test budget.
// The redesign doubled route coverage; each group must finish under the same 30s limit.
for (const [group, routes] of Object.entries({
  legacy: ['/', '/constitution', '/workspace', '/time-machine', '/certificates', '/certificate-verifier', '/red-team', '/audit'],
  redesigned: ['/welcome', '/ask', '/rules', '/rules/history', '/activity', '/activity/check', '/security', '/approve'],
})) test(`AT-12 ${group}: actual backend canaries stay out of HTML/scripts/responses/cookies/storage and private repo values`, async ({ page }) => {
  const canaries = [credentials.password, credentials.api_token, credentials.signer_key, credentials.verifier_key];
  const privateValues: string[] = [];
  const envFile = path.join(ROOT, '.env');
  if (existsSync(envFile)) for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = /^(API_TOKEN|DEMO_PASSWORD_HASH|SIGNER_PRIVATE_KEY|VERIFIER_PRIVATE_KEY|LLM_API_KEY|RPC_URL)=(.+)$/.exec(line.trim());
    if (match && match[2].length >= 8 && !['https://sepolia.base.org', 'https://sepolia.base.org/'].includes(match[2])) privateValues.push(match[2]);
  }
  const secrets = [...canaries, ...privateValues]; expect(secrets.length).toBeGreaterThanOrEqual(4);
  const bodies: CapturedResponse[] = [];
  const drain = await captureActualResponses(page, bodies);
  await signIn(page);
  await page.waitForLoadState('networkidle'); await drain();
  for (const route of routes) {
    await page.goto(route); await page.waitForLoadState('networkidle'); await drain();
  }
  expect(bodies.length).toBeGreaterThan(20);
  for (const { url, body } of bodies) for (const secret of secrets) expect(body.includes(secret), 'backend value in response ' + url).toBe(false);
  const cookies = await page.context().cookies(); expect(cookies.find(c => c.name === 'prooffi_session')).toMatchObject({ httpOnly: true, sameSite: 'Strict' });
  const storage = await page.evaluate(() => ({ cookie: document.cookie, local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(storage.cookie).not.toContain('prooffi_session');
  for (const secret of secrets) expect(JSON.stringify(storage).includes(secret)).toBe(false);
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT }).toString().split('\0').filter(Boolean); expect(tracked.length).toBeGreaterThan(100);
  for (const file of tracked) for (const secret of privateValues) expect(readFileSync(path.join(ROOT, file)).includes(Buffer.from(secret)), 'private runtime value in tracked file ' + file).toBe(false);
});
