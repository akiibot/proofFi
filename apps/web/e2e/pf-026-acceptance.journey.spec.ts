import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { test, expect, type Page } from './fixtures';
import { signIn } from './auth-helper';
import { candidate, ensureConstitution, getJson, RECIPIENT, TOKEN, writeHeaders } from './api-helpers';
import { canonicalDigest } from '../src/lib/canonical';
import credentials from './test-credentials.json';

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
  await page.goto('/workspace');
  if (fromGoal) {
    await page.getByLabel('What should ProofFi do?').fill('Invest as much as possible while protecting tuition.');
    const planned = page.waitForResponse(r => r.url().endsWith('/api/backend/plans/generate'));
    await page.getByRole('button', { name: 'Propose candidates', exact: true }).click();
    const plan = await planned;
    expect(plan.status()).toBe(200);
    expect((await plan.json()).mode).toBe('deterministic_demo');
  } else {
    await page.getByText('Or enter a candidate yourself', { exact: true }).click();
    await page.getByLabel('Token address').fill(TOKEN);
    await page.getByLabel('Recipient address').fill(RECIPIENT);
  }
  const optimized = page.waitForResponse(r => r.url().endsWith('/api/backend/optimize'));
  await page.getByRole('button', { name: 'Find the largest safe amount', exact: true }).click();
  const r = await optimized;
  expect(r.status()).toBe(200);
  const result = await r.json();
  expect(result.status).toBe('SAFE_ACTION');
  expect(result.max_amount_minor).toBeGreaterThan(0);
  expect(result.next_cent_rejected).toBe(true);
  await expect(page.getByTestId('optimizer-result')).toContainText('One cent more is rejected');
  return result;
}
async function issue(page: Page) {
  const issued = page.waitForResponse(r => r.url().endsWith('/api/backend/verify'));
  await page.getByRole('button', { name: 'Verify and get a certificate', exact: true }).click();
  const r = await issued;
  expect(r.status()).toBe(200);
  const result = await r.json();
  expect(result.certificate_id).toBeTruthy();
  return result;
}

test('AT-11 draft stays inactive, confirmation is explicit and prior policy history is immutable', async ({ page }) => {
  await signIn(page); await ensureConstitution(page);
  const history = await getJson(page, 'constitutions/history');
  const state = await getJson(page, 'financial-state');
  await page.goto('/constitution');
  await page.getByLabel('Autonomy limit (USD)').fill('111');
  await page.getByRole('button', { name: 'Save draft' }).click();
  const review = page.getByRole('region', { name: 'Review draft' });
  await expect(review.getByRole('button', { name: 'Confirm and activate' })).toBeDisabled();
  expect((await getJson(page, 'financial-state')).active_constitution_version).toBe(state.active_constitution_version);
  await review.getByLabel(/I have reviewed these exact rules/).check();
  await review.getByRole('button', { name: 'Confirm and activate' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'is now your active Constitution' })).toBeVisible();
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
  await page.goto('/time-machine');
  await page.getByLabel('Amount (USD)').fill('1500'); await page.getByLabel('Token address').fill(TOKEN); await page.getByLabel('Recipient address').fill(RECIPIENT);
  await page.getByRole('button', { name: 'Run simulation' }).click();
  await expect(page.getByTestId('config-seed')).toHaveText(String(first.config.seed));
  await expect(page.getByTestId('metric-goal')).toBeVisible();
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
  await signIn(page); const before = await stats(page); await page.goto('/red-team');
  await page.getByLabel(/Run the controlled \$4,000 borrowed-funding proposal/).check();
  const response = page.waitForResponse(r => r.url().endsWith('/api/backend/demo/attack'));
  await page.getByRole('button', { name: 'Run controlled attack', exact: true }).click();
  const r = await response; expect(r.status()).toBe(200); const body = await r.json();
  expect(body.verification.verdict.decision).toBe('DENY'); expect(body.verification.certificate_id).toBeNull(); expect(body.signer_called).toBe(false); expect(body.tx_hash ?? null).toBeNull(); expect(await stats(page)).toEqual(before);
  await expect(page.getByTestId('attack-verdict')).toContainText('Controlled proposal blocked');
});

test('AT-08/AT-09 one acknowledged expense reduces the maximum and invalidates the unchanged certificate', async ({ page }) => {
  await signIn(page); await ensureConstitution(page); const before = await getJson(page, 'financial-state');
  const optimized = await safe(page); const verified = await issue(page); const id = verified.certificate_id;
  const certificate = await getJson(page, 'certificates/' + id); const chainBefore = await stats(page);
  const panel = page.getByRole('region', { name: 'Emergency expense' });
  await panel.getByLabel(/Record a \$2,000 emergency expense/).check();
  const response = page.waitForResponse(r => r.url().endsWith('/api/backend/demo/emergency'));
  await panel.getByRole('button', { name: 'Record the $2,000 emergency', exact: true }).click();
  const r = await response; expect(r.request().postDataJSON()).toEqual({ expected_state_version: before.snapshot.version, amount_minor: 200000 });
  expect(r.status()).toBe(200); const outcome = await r.json();
  expect(outcome.state.snapshot.version).toBe(before.snapshot.version + 1);
  expect(outcome.state.snapshot.realized_expense_minor).toBe(before.snapshot.realized_expense_minor + 200000);
  expect(outcome.optimization.max_amount_minor).toBeLessThan(optimized.max_amount_minor);
  expect(['SAFE_ACTION', 'NO_SAFE_ACTION']).toContain(outcome.optimization.status);
  expect(outcome.state.active_constitution_version).toBe(before.active_constitution_version);
  const total = (assets: { amount_minor: number }[]) => assets.reduce((sum, a) => sum + a.amount_minor, 0);
  expect(total(before.snapshot.assets) - total(outcome.state.snapshot.assets)).toBe(200000);
  await expect(panel.getByTestId('emergency-result')).toContainText('SIGNED_BUT_STALE');
  expect(await getJson(page, 'certificates/' + id)).toEqual(certificate);
  const status = await page.request.post('/api/backend/certificates/' + id + '/verify', { headers: await writeHeaders(page) });
  expect(status.status()).toBe(200); expect(await status.json()).toMatchObject({ status: 'SIGNED_BUT_STALE', signature_valid: true });
  const audit = await getJson(page, 'audit'); expect(audit.filter((e: { event_type: string }) => e.event_type === 'EMERGENCY_EXPENSE_RECORDED')).toHaveLength(1);
  expect(await stats(page)).toEqual(chainBefore);
});

test('AT-01 goal -> proposal -> safe amount -> certificate -> exact approval -> one dispatch -> confirmed audit', async ({ page }) => {
  await signIn(page); await ensureConstitution(page); const before = await getJson(page, 'financial-state'); const initial = await stats(page); expect(initial.send_calls).toBe(0);
  await safe(page, true); const result = await issue(page); const id = result.certificate_id; const certificate = await getJson(page, 'certificates/' + id);
  await page.getByRole('link', { name: id, exact: true }).click();
  await expect(page.getByTestId('certificate-status')).toContainText('Valid, needs your approval');
  await page.getByLabel(/I approve exactly this transaction:/).check();
  const approval = page.waitForResponse(r => r.url().endsWith('/api/backend/approvals'));
  await page.getByRole('button', { name: 'Approve', exact: true }).click(); expect((await approval).status()).toBe(200);
  await page.getByLabel('Send this transaction to the Base Sepolia testnet. No real money is used.').check();
  const execution = page.waitForResponse(r => r.url().endsWith('/api/backend/execute'));
  await page.getByRole('button', { name: 'Execute on testnet', exact: true }).click();
  const r = await execution; expect(r.status()).toBe(200); const observed = await r.json(); expect(['PENDING', 'CONFIRMED']).toContain(observed.status);
  // Same retained identity reconciles the one recorded attempt; it never signs/sends again.
  await expect(page.getByRole('button', { name: 'Reconcile recorded attempt', exact: true })).toBeEnabled();
  const reconciled = page.waitForResponse(r => r.url().endsWith('/api/backend/execute'));
  await page.getByRole('button', { name: 'Reconcile recorded attempt', exact: true }).click();
  const rr = await reconciled; expect(rr.status()).toBe(200); const confirmed = await rr.json();
  expect(rr.request().postDataJSON()).toEqual(r.request().postDataJSON());
  expect(confirmed.status).toBe('CONFIRMED'); expect(confirmed.tx_hash).toBe(observed.tx_hash);
  await expect(page.getByTestId('execution-result')).toContainText('CONFIRMED');
  const chain = await stats(page); expect(chain.send_calls).toBe(1); expect(chain.accepted_transactions).toBe(1); expect(chain.transaction_hash).toBe(confirmed.tx_hash);
  expect(await getJson(page, 'certificates/' + id)).toEqual(certificate);
  const after = await getJson(page, 'financial-state'); expect(after.snapshot.version).toBe(before.snapshot.version + 1);
  const audit = await getJson(page, 'audit');
  for (const type of ['EXECUTION_CLAIMED', 'EXECUTION_SIGNED', 'EXECUTION_ENVELOPE_STORED', 'EXECUTION_DISPATCH_RESERVED']) expect(audit.filter((e: { event_type: string; details: { certificate_id?: string; execution_id?: string } }) => e.event_type === type && e.details.certificate_id === id && e.details.execution_id === confirmed.id)).toHaveLength(1);
  const effects = audit.filter((e: { event_type: string; details: { execution_id?: string } }) => e.event_type === 'EXECUTION_LEDGER_APPLIED' && e.details.execution_id === confirmed.id);
  expect(effects).toHaveLength(1);
  expect(effects[0].details).toMatchObject({ tx_hash: confirmed.tx_hash, before_state_id: before.id, after_state_id: after.id, amount_minor: certificate.payload.action.amount_minor });
  await page.goto('/audit'); await expect(page.getByTestId('chain-status')).toContainText('Hash chain intact');
});

test('AT-12 actual backend canaries stay out of HTML/scripts/responses/cookies/storage and private repo values', async ({ page }) => {
  const canaries = [credentials.password, credentials.api_token, credentials.signer_key, credentials.verifier_key];
  const privateValues: string[] = [];
  const envFile = path.join(ROOT, '.env');
  if (existsSync(envFile)) for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = /^(API_TOKEN|DEMO_PASSWORD_HASH|SIGNER_PRIVATE_KEY|VERIFIER_PRIVATE_KEY|LLM_API_KEY|RPC_URL)=(.+)$/.exec(line.trim());
    if (match && match[2].length >= 8 && !['https://sepolia.base.org', 'https://sepolia.base.org/'].includes(match[2])) privateValues.push(match[2]);
  }
  const secrets = [...canaries, ...privateValues]; expect(secrets.length).toBeGreaterThanOrEqual(4);
  const bodies: { url: string; body: string }[] = []; const pending: Promise<void>[] = [];
  page.on('response', response => {
    if (!['document', 'script', 'fetch', 'xhr', 'stylesheet'].includes(response.request().resourceType())) return;
    const url = new URL(response.url()).pathname;
    const metadata = JSON.stringify({ url: response.url(), headers: response.headers() });
    // Playwright cannot expose redirect bodies. Scan their headers/Location too;
    // failures reading a substantive response still fail this test.
    if (response.status() >= 300 && response.status() < 400) bodies.push({ url, body: metadata });
    else pending.push(response.text().then(body => { bodies.push({ url, body: body + metadata }); }));
  });
  await signIn(page);
  // Drain the current document before navigating: Chromium can retire a prior
  // response handle when another document replaces it. Never discard unread bytes.
  await page.waitForLoadState('networkidle'); await Promise.all(pending);
  for (const route of ['/', '/constitution', '/workspace', '/time-machine', '/certificates', '/certificate-verifier', '/red-team', '/audit']) {
    await page.goto(route); await page.waitForLoadState('networkidle'); await Promise.all(pending);
  }
  await Promise.all(pending); expect(bodies.length).toBeGreaterThan(20);
  for (const { url, body } of bodies) for (const secret of secrets) expect(body.includes(secret), 'backend value in response ' + url).toBe(false);
  const cookies = await page.context().cookies(); expect(cookies.find(c => c.name === 'prooffi_session')).toMatchObject({ httpOnly: true, sameSite: 'Strict' });
  const storage = await page.evaluate(() => ({ cookie: document.cookie, local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(storage.cookie).not.toContain('prooffi_session');
  for (const secret of secrets) expect(JSON.stringify(storage).includes(secret)).toBe(false);
  const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT }).toString().split('\0').filter(Boolean); expect(tracked.length).toBeGreaterThan(100);
  for (const file of tracked) for (const secret of privateValues) expect(readFileSync(path.join(ROOT, file)).includes(Buffer.from(secret)), 'private runtime value in tracked file ' + file).toBe(false);
});
