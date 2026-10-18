import { test, expect } from './fixtures';
import { signIn } from './auth-helper';
import { canonicalDigest } from '../src/lib/canonical';
import { ensureConstitution, getJson, writeHeaders, TOKEN, RECIPIENT } from './api-helpers';

test('PF-026 explicit fixture setup handles an existing restrictive policy without rewriting history', async ({ page }) => {
  await signIn(page);
  const before = await getJson(page, 'financial-state');
  const headers = await writeHeaders(page);
  const draft = await page.request.post('/api/backend/constitutions/drafts', { headers, data: {
    base_version: before.active_constitution_version, rules: { allowed_tokens: [], known_recipients: [], autonomy_limit_minor: 12345 },
  } });
  expect(draft.status()).toBe(200);
  const body = await draft.json();
  const confirmed = await page.request.post('/api/backend/constitutions/confirm', { headers, data: {
    draft_id: body.id, confirmed: true, expected_policy_digest: await canonicalDigest(body.rules),
  } });
  expect(confirmed.status()).toBe(200);
  const old = await confirmed.json();
  const id = await ensureConstitution(page);
  const history = await getJson(page, 'constitutions/history');
  const active = history.find((version: { id: string }) => version.id === id);
  expect(active.rules.allowed_tokens).toContain(TOKEN);
  expect(active.rules.known_recipients).toContain(RECIPIENT);
  expect(active.rules.autonomy_limit_minor).toBe(12345);
  expect(history.find((version: { id: string }) => version.id === old.id)).toEqual(old);
});
