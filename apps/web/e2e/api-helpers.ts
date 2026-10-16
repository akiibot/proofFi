import type { APIResponse, Page } from '@playwright/test';
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

/** Confirms a Constitution through the real API when none is active (used only to give a journey its precondition). */
export async function ensureConstitution(page: Page) {
  const state = await getJson(page, 'financial-state');
  if (state.active_constitution_version) return state.active_constitution_version as string;
  const headers = await writeHeaders(page);
  const draft = await (await page.request.post('/api/backend/constitutions/drafts', { headers, data: { base_version: null, rules: { allowed_tokens: [TOKEN], known_recipients: [RECIPIENT] } } })).json();
  const confirmed = await page.request.post('/api/backend/constitutions/confirm', { headers, data: { draft_id: draft.id, confirmed: true, expected_policy_digest: await canonicalDigest(draft.rules) } });
  expect(confirmed.status()).toBe(200);
  return (await confirmed.json()).id as string;
}

/** Whether a backend route is still the documented 501 placeholder, and which issue it names. */
export async function unfinished(response: APIResponse): Promise<string | null> {
  if (response.status() !== 501) return null;
  const body = await response.json().catch(() => ({}));
  return typeof body.message === 'string' ? body.message : 'NOT_IMPLEMENTED';
}

export function candidate(amountMinor: number, id: string) {
  return { id, action_type: 'TEST_TOKEN_ALLOCATION', amount_minor: amountMinor, chain_id: 84532, token_address: TOKEN, recipient: RECIPIENT, funding_source: 'owned', planner_reason_untrusted: 'acceptance test', planner_mode: 'deterministic_demo' };
}
