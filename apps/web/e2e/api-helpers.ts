import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { canonicalDigest } from '../src/lib/canonical';

export const ORIGIN = 'http://127.0.0.1:3000';
export const TOKEN = '0x' + '1'.repeat(40);
export const RECIPIENT = '0x' + '2'.repeat(40);

/** Headers for a protected POST made by the test itself: the page's own session plus Origin and CSRF. */
export async function writeHeaders(page: Page) {
  const session = await (await page.request.get('/api/backend/auth/session')).json();
  return { Origin: ORIGIN, 'X-CSRF-Token': session.csrf_token as string };
}

export async function getJson(page: Page, path: string) {
  return (await page.request.get(`/api/backend/${path}`)).json();
}

/** Explicit isolated-test policy setup through the real draft/confirmation API.
 * Preserves current rules/history; adds only the fixture token/known recipient.
 * Never removes an explicit block or activates any runtime financial assumption.
 */
export async function ensureConstitution(page: Page) {
  const state = await getJson(page, 'financial-state');
  const history = await getJson(page, 'constitutions/history');
  const active = history.find((version: { id: string }) => version.id === state.active_constitution_version);
  const rules = active?.rules;
  if (state.active_constitution_version) expect(active).toBeDefined();
  if (rules) {
    expect(rules.blocked_recipients).not.toContain(RECIPIENT);
    if (rules.allowed_tokens.includes(TOKEN) && rules.known_recipients.includes(RECIPIENT)) return active.id as string;
  }
  const headers = await writeHeaders(page);
  const response = await page.request.post('/api/backend/constitutions/drafts', { headers, data: {
    base_version: state.active_constitution_version,
    rules: { ...rules, allowed_tokens: [...new Set([...(rules?.allowed_tokens ?? []), TOKEN])], known_recipients: [...new Set([...(rules?.known_recipients ?? []), RECIPIENT])] },
  } });
  expect(response.status()).toBe(200);
  const draft = await response.json();
  const confirmed = await page.request.post('/api/backend/constitutions/confirm', { headers, data: { draft_id: draft.id, confirmed: true, expected_policy_digest: await canonicalDigest(draft.rules) } });
  expect(confirmed.status()).toBe(200);
  return (await confirmed.json()).id as string;
}

export function candidate(amountMinor: number, id: string) {
  return { id, action_type: 'TEST_TOKEN_ALLOCATION', amount_minor: amountMinor, chain_id: 84532, token_address: TOKEN, recipient: RECIPIENT, funding_source: 'owned', planner_reason_untrusted: 'acceptance test', planner_mode: 'deterministic_demo' };
}
