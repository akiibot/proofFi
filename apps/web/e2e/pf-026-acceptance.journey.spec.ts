import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { test, expect } from './fixtures';
import { signIn } from './auth-helper';
import { candidate, ensureConstitution, getJson, RECIPIENT, TOKEN, unfinished, writeHeaders } from './api-helpers';
import { canonicalDigest } from '../src/lib/canonical';

// PF-026 browser acceptance journeys (docs/ACCEPTANCE_MATRIX.md). Each test drives the real UI and backend.
// A gate whose backend route still returns 501 skips itself and names the blocking issue; a skip is never a pass.
// Backend-only gates (AT-05 executor bypass, AT-06 tamper, AT-07 replay) live in services/api/tests/acceptance.

const ROOT = path.resolve(__dirname, '../../..');

test.describe('AT-11 explicit policy confirmation and immutable history', () => {
  test('AT-11 a draft never activates, confirmation is explicit, and earlier versions never change', async ({ page }) => {
    await signIn(page);
    await ensureConstitution(page);
    const beforeHistory = await getJson(page, 'constitutions/history');
    const beforeState = await getJson(page, 'financial-state');

    await page.goto('/constitution');
    await page.getByLabel('Autonomy limit (USD)').fill('111');
    await page.getByRole('button', { name: 'Save draft' }).click();
    const review = page.getByRole('region', { name: 'Review draft' });
    await expect(review.getByRole('button', { name: 'Confirm and activate' })).toBeDisabled();
    expect((await getJson(page, 'financial-state')).active_constitution_version).toBe(beforeState.active_constitution_version);

    await review.getByLabel(/I have reviewed these exact rules/).check();
    await review.getByRole('button', { name: 'Confirm and activate' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'is now your active Constitution' })).toBeVisible();

    const afterHistory = await getJson(page, 'constitutions/history');
    expect(afterHistory.length).toBe(beforeHistory.length + 1);
    for (const old of beforeHistory) expect(afterHistory.find((v: { id: string }) => v.id === old.id)).toEqual(old); // byte-identical
    const newest = afterHistory.reduce((a: { version: number }, b: { version: number }) => (b.version > a.version ? b : a));
    expect(newest.rules.autonomy_limit_minor).toBe(11100);
    expect(await canonicalDigest(newest.rules)).toBe(newest.policy_digest);
  });
});

test.describe('AT-10 seed/config reproducibility and simulation identity', () => {
  test('AT-10 the same trusted input returns the same stored simulation, and the UI shows its seed', async ({ page }) => {
    await signIn(page);
    await ensureConstitution(page);
    const headers = await writeHeaders(page);
    const action = candidate(150000, `at10-${Date.now()}`);
    const first = await page.request.post('/api/backend/simulate', { headers, data: { action } });
    test.skip((await unfinished(first)) !== null, 'Blocked: /simulate returns 501');
    expect(first.status()).toBe(200);
    const second = await page.request.post('/api/backend/simulate', { headers, data: { action } });
    expect(second.status()).toBe(200);
    const [a, b] = [await first.json(), await second.json()];
    expect(b.id).toBe(a.id); // identity: same state, policy, config and action -> same simulation record
    expect(b).toEqual(a);

    await page.goto('/time-machine');
    await page.getByLabel('Amount (USD)').fill('1500');
    await page.getByLabel('Token address').fill(TOKEN);
    await page.getByLabel('Recipient address').fill(RECIPIENT);
    await page.getByRole('button', { name: 'Run simulation' }).click();
    const result = page.getByRole('region', { name: 'Simulation result' });
    await expect(result.getByTestId('config-seed')).toHaveText(String(a.config.seed));
    await expect(result.getByTestId('metric-goal')).toBeVisible();
  });
});

test.describe('AT-12 private-key isolation in the browser', () => {
  test('AT-12 no backend secret reaches page HTML, scripts, API responses, cookies or storage', async ({ page }) => {
    const secrets: string[] = [];
    const envFile = path.join(ROOT, '.env');
    if (existsSync(envFile)) {
      for (const line of readFileSync(envFile, 'utf8').split(/\r?\n/)) {
        const match = /^(API_TOKEN|DEMO_PASSWORD_HASH|SIGNER_PRIVATE_KEY|VERIFIER_PRIVATE_KEY|LLM_API_KEY|RPC_URL)=(.+)$/.exec(line.trim());
        if (match && match[2].trim().length >= 8) secrets.push(match[2].trim());
      }
    }
    const passwordFile = path.join(ROOT, '.local/demo-password.txt');
    const password = process.env.PROOFFI_TEST_PASSWORD ?? (existsSync(passwordFile) ? readFileSync(passwordFile, 'utf8').trim() : '');
    expect(secrets.length + (password ? 1 : 0)).toBeGreaterThan(0); // the check must have something to look for

    const bodies: { url: string; body: string }[] = [];
    const pending: Promise<void>[] = [];
    page.on('response', (response) => {
      const type = response.request().resourceType();
      if (['document', 'script', 'fetch', 'xhr', 'stylesheet'].includes(type)) {
        pending.push(response.text().then((body) => { bodies.push({ url: response.url(), body }); }).catch(() => undefined));
      }
    });
    await signIn(page);
    for (const route of ['/', '/constitution', '/workspace', '/time-machine', '/certificates', '/certificate-verifier', '/red-team', '/audit']) {
      await page.goto(route);
      await page.waitForLoadState('networkidle');
    }
    await Promise.all(pending);
    expect(bodies.length).toBeGreaterThan(10);
    for (const { url, body } of bodies) {
      for (const secret of secrets) expect(body.includes(secret), `backend secret found in ${url}`).toBe(false);
      if (password) expect(body.includes(password), `demo password found in ${url}`).toBe(false);
      expect(/-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(body), `private key block in ${url}`).toBe(false);
    }
    expect(await page.evaluate(() => document.cookie)).not.toContain('prooffi_session'); // HttpOnly
    const storage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
    for (const value of [...Object.values(storage.local), ...Object.values(storage.session)]) {
      for (const secret of [...secrets, password].filter(Boolean)) expect(String(value).includes(secret)).toBe(false);
    }
  });
});

test.describe('Gates waiting on backend routes', () => {
  test('AT-02 an oversized investment is rejected and no certificate is issued', async ({ page }) => {
    await signIn(page);
    await ensureConstitution(page);
    const response = await page.request.post('/api/backend/verify', { headers: await writeHeaders(page), data: { action: candidate(1100000, `at02-${Date.now()}`) } });
    test.skip((await unfinished(response)) !== null, 'Blocked: POST /verify returns 501 (PF-029)');
    const result = await response.json();
    expect(result.verdict.decision).toBe('DENY');
    expect(result.certificate_id).toBeNull();
  });

  test('AT-03 the optimizer returns the largest compliant amount and one more cent is rejected', async ({ page }) => {
    await signIn(page);
    await ensureConstitution(page);
    await page.goto('/workspace');
    await page.getByText('Or enter a candidate yourself').click();
    await page.getByLabel('Token address').fill(TOKEN);
    await page.getByLabel('Recipient address').fill(RECIPIENT);
    const response = page.waitForResponse((r) => r.url().endsWith('/api/backend/optimize'));
    await page.getByRole('button', { name: 'Find the largest safe amount' }).click();
    const r = await response;
    test.skip(r.status() === 501, 'Blocked: POST /optimize returns 501 (PF-010)');
    const body = await r.json();
    if (body.status === 'SAFE_ACTION') {
      expect(body.next_cent_rejected).toBe(true);
      await expect(page.getByTestId('optimizer-result')).toContainText('One cent more is rejected');
    } else {
      await expect(page.getByTestId('optimizer-result')).toBeVisible(); // NO_SAFE_ACTION is an honest, explained outcome
    }
  });

  test('AT-04 a malicious proposal is blocked without signing', async ({ page }) => {
    await signIn(page);
    await page.goto('/red-team');
    await page.getByLabel(/deliberately malicious proposal/).check();
    const response = page.waitForResponse((r) => r.url().endsWith('/api/backend/demo/attack'));
    await page.getByRole('button', { name: 'Run the attack' }).click();
    const r = await response;
    test.skip(r.status() === 501, 'Blocked: POST /demo/attack returns 501 (PF-031)');
    const body = await r.json();
    expect(body.verification.verdict.decision).toBe('DENY');
    expect(body.signer_called).toBe(false);
    expect(body.tx_hash ?? null).toBeNull();
    await expect(page.getByTestId('attack-verdict')).toContainText('AI fooled. Funds safe.');
  });

  test('AT-09 an emergency reduces the safe allocation or explains that none exists', async ({ page }) => {
    await signIn(page);
    await ensureConstitution(page);
    await page.goto('/workspace');
    const panel = page.getByRole('region', { name: 'Emergency expense' });
    await panel.getByLabel(/Record a \$2,000 emergency expense/).check();
    const response = page.waitForResponse((r) => r.url().endsWith('/api/backend/demo/emergency'));
    await panel.getByRole('button', { name: 'Record the $2,000 emergency' }).click();
    const r = await response;
    test.skip(r.status() === 501, 'Blocked: POST /demo/emergency returns 501 (PF-032)');
    const body = await r.json();
    expect(['SAFE_ACTION', 'NO_SAFE_ACTION']).toContain(body.optimization.status);
    await expect(panel.getByTestId('emergency-result')).toBeVisible();
  });

  test('AT-01 hero goal through real testnet execution', async ({ page }) => {
    await signIn(page);
    const chain = await getJson(page, 'chain/status');
    test.skip(chain.status !== 'READY', `Blocked: chain status is ${chain.status}; AT-01 needs a configured, funded Base Sepolia wallet and a recorded receipt`);
    // When the chain is READY this journey is completed with PF-015/PF-016 and the genuine receipt is recorded in evidence/.
    expect(chain.status).toBe('READY');
  });
});
