import type { components } from '../../../apps/web/src/lib/schema';
import { parseAddresses, parseUsd } from './units';

export type CandidateAction = components['schemas']['CandidateAction'];

/** A unique, contract-valid candidate ID (1-100 chars). */
export function candidateId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

export type CandidateForm = { amount: string; token: string; recipient: string };
export type CandidateErrors = Partial<Record<keyof CandidateForm, string>>;

function oneAddress(text: string, what: string): { ok: true; value: string } | { ok: false; error: string } {
  const parsed = parseAddresses(text);
  if (!parsed.ok) return parsed;
  if (parsed.value.length !== 1) return { ok: false, error: `Enter exactly one ${what} address.` };
  return { ok: true, value: parsed.value[0] };
}

/**
 * Builds a person-entered candidate. It carries no authority: the backend reloads trusted state and policy itself.
 * `reason` is recorded as untrusted planner text.
 */
export function buildCandidate(form: CandidateForm, reason: string, prefix = 'manual'): { ok: true; action: CandidateAction } | { ok: false; errors: CandidateErrors } {
  const errors: CandidateErrors = {};
  const amount = parseUsd(form.amount);
  if (!amount.ok) errors.amount = amount.error;
  else if (amount.value === 0) errors.amount = 'Enter an amount above $0.';
  const token = oneAddress(form.token, 'token');
  if (!token.ok) errors.token = token.error;
  const recipient = oneAddress(form.recipient, 'recipient');
  if (!recipient.ok) errors.recipient = recipient.error;
  if (!amount.ok || amount.value === 0 || !token.ok || !recipient.ok) return { ok: false, errors };
  return {
    ok: true,
    action: {
      id: candidateId(prefix), action_type: 'TEST_TOKEN_ALLOCATION', amount_minor: amount.value, chain_id: 84532,
      token_address: token.value, recipient: recipient.value, funding_source: 'owned',
      planner_reason_untrusted: reason, planner_mode: 'deterministic_demo',
    },
  };
}
