import type { components } from '@/lib/schema';
import { formatUsd } from '@/lib/format';
import { bpsToPercent, minorToInput, parseAddresses, parsePercentToBps, parseUsd } from '@/lib/units';

export type Rules = components['schemas']['ConstitutionRules'];
export type Draft = components['schemas']['ConstitutionDraft'];
export type Version = components['schemas']['ConstitutionVersion'];

type Kind = 'usd' | 'bps' | 'addresses';
type EditableKey = 'tuition_reserve_minor' | 'emergency_floor_minor' | 'autonomy_limit_minor' | 'high_risk_concentration_bps'
  | 'goal_satisfaction_min_bps' | 'reserve_breach_max_bps' | 'allowed_tokens' | 'known_recipients' | 'blocked_recipients';
type FixedKey = 'allowed_chain_id' | 'new_recipient_requires_approval' | 'borrowed_funding_forbidden';

export type Field = { key: EditableKey; label: string; kind: Kind; help: string };

/** The rules a person may change, in the order they read best. Labels match the backend's change log (policy/service.py). */
export const FIELDS: Field[] = [
  { key: 'tuition_reserve_minor', label: 'Tuition reserve', kind: 'usd', help: 'Money that must stay set aside for tuition.' },
  { key: 'emergency_floor_minor', label: 'Emergency floor', kind: 'usd', help: 'Liquid cash that must remain after any action.' },
  { key: 'autonomy_limit_minor', label: 'Autonomy limit', kind: 'usd', help: 'Actions above this amount need your approval.' },
  { key: 'high_risk_concentration_bps', label: 'High-risk concentration', kind: 'bps', help: 'Largest share of available assets allowed in high-risk positions.' },
  { key: 'goal_satisfaction_min_bps', label: 'Minimum goal probability', kind: 'bps', help: 'Share of simulated futures in which the goal must still be met.' },
  { key: 'reserve_breach_max_bps', label: 'Maximum reserve-breach probability', kind: 'bps', help: 'Largest share of simulated futures allowed to fall below the reserves.' },
  { key: 'allowed_tokens', label: 'Allowed tokens', kind: 'addresses', help: 'Token contract addresses an action may use. One per line.' },
  { key: 'known_recipients', label: 'Known recipients', kind: 'addresses', help: 'Addresses treated as known. One per line.' },
  { key: 'blocked_recipients', label: 'Blocked recipients', kind: 'addresses', help: 'Addresses that are never allowed. One per line.' },
];

/** Rules ProofFi fixes for everyone; shown so the person knows they exist, never editable. */
export const FIXED: { key: FixedKey; label: string; describe: (rules: Rules) => string }[] = [
  { key: 'allowed_chain_id', label: 'Allowed chain', describe: (r) => `Base Sepolia testnet (${r.allowed_chain_id})` },
  { key: 'new_recipient_requires_approval', label: 'New recipient approval', describe: () => 'Always required' },
  { key: 'borrowed_funding_forbidden', label: 'Borrowed funding', describe: () => 'Never allowed' },
];

/** Values from the contract's documented defaults, used only when no draft or version exists to start from. */
export const CONTRACT_DEFAULTS: Rules = {
  tuition_reserve_minor: 700000, emergency_floor_minor: 200000, autonomy_limit_minor: 15000, new_recipient_requires_approval: true,
  allowed_chain_id: 84532, allowed_tokens: [], known_recipients: [], blocked_recipients: [], high_risk_concentration_bps: 2500,
  goal_satisfaction_min_bps: 9500, reserve_breach_max_bps: 500, borrowed_funding_forbidden: true,
};

export type FormValues = Record<EditableKey, string>;

export function toForm(rules: Rules): FormValues {
  const out = {} as FormValues;
  for (const field of FIELDS) {
    const value = rules[field.key];
    out[field.key] = field.kind === 'usd' ? minorToInput(value as number) : field.kind === 'bps' ? bpsToPercent(value as number) : (value as string[]).join('\n');
  }
  return out;
}

/** Parses every field; returns either complete rules or one message per bad field. Fixed rules are always copied unchanged. */
export function fromForm(form: FormValues, base: Rules): { ok: true; rules: Rules } | { ok: false; errors: Partial<Record<EditableKey, string>> } {
  const errors: Partial<Record<EditableKey, string>> = {};
  const rules: Rules = { ...base };
  for (const field of FIELDS) {
    const text = form[field.key];
    const parsed = field.kind === 'usd' ? parseUsd(text) : field.kind === 'bps' ? parsePercentToBps(text) : parseAddresses(text);
    if (!parsed.ok) errors[field.key] = parsed.error;
    else (rules as Record<string, unknown>)[field.key] = parsed.value;
  }
  const overlap = rules.known_recipients.filter((a) => rules.blocked_recipients.includes(a));
  if (!errors.blocked_recipients && overlap.length) errors.blocked_recipients = 'An address cannot be both known and blocked.';
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, rules };
}

export function describe(field: Field, rules: Rules): string {
  const value = rules[field.key];
  if (field.kind === 'usd') return formatUsd(value as number);
  if (field.kind === 'bps') return `${bpsToPercent(value as number)}%`;
  const list = value as string[];
  return list.length ? list.join(', ') : 'None';
}

export type Change = { label: string; before: string; after: string; changed: boolean };

/** Field-by-field comparison of a draft against the active version (or "Not set" when nothing is active). */
export function diff(next: Rules, active: Rules | null): Change[] {
  return [
    ...FIELDS.map((field) => {
      const after = describe(field, next);
      const before = active ? describe(field, active) : 'Not set';
      return { label: field.label, before, after, changed: before !== after };
    }),
    ...FIXED.map((fixed) => {
      const after = fixed.describe(next);
      const before = active ? fixed.describe(active) : 'Not set';
      return { label: fixed.label, before, after, changed: before !== after };
    }),
  ];
}
