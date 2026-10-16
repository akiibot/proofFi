import { test, expect } from './fixtures';
import { canonicalDigest, canonicalJson } from '../src/lib/canonical';
import { bpsToPercent, minorToInput, parseAddresses, parsePercentToBps, parseUsd } from '../src/lib/units';
import { CONTRACT_DEFAULTS, diff, fromForm, toForm } from '../src/components/constitution/rules';

// Reference values printed by the backend's own services/api/app/core/canonical.py for the same input.
const PYTHON_RULES_JSON = '{"allowed_chain_id":84532,"allowed_tokens":["0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"],"autonomy_limit_minor":15000,"blocked_recipients":[],"borrowed_funding_forbidden":true,"emergency_floor_minor":200000,"goal_satisfaction_min_bps":9500,"high_risk_concentration_bps":2500,"known_recipients":["0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"],"new_recipient_requires_approval":true,"reserve_breach_max_bps":500,"tuition_reserve_minor":700000}';
const PYTHON_RULES_DIGEST = 'ca5d38eb9e4b41372bd90cf3bf163a60f8f8021a91687a9abdf7a7816aac5eca';
const PYTHON_MIXED_DIGEST = '4dd40fbb69e83a49fd34b75a63d55acf94cfc88cfaca4b31c799797b7a5282b5';

test('PF-019 browser policy fingerprint matches the backend canonical digest byte for byte', async () => {
  const rules = { ...CONTRACT_DEFAULTS, allowed_tokens: ['0x' + 'a'.repeat(40)], known_recipients: ['0x' + 'b'.repeat(40)] };
  expect(canonicalJson(rules)).toBe(PYTHON_RULES_JSON);
  expect(await canonicalDigest(rules)).toBe(PYTHON_RULES_DIGEST);
  expect(await canonicalDigest({ b: [1, { d: true, c: null }], a: 'héllo "q" \\ \n' })).toBe(PYTHON_MIXED_DIGEST);
  expect(() => canonicalJson({ amount: 1.5 })).toThrow();
});

test('PF-019 converts typed money and percentages to exact integer units', () => {
  expect(parseUsd('7000')).toEqual({ ok: true, value: 700000 });
  expect(parseUsd('$7,000.5')).toEqual({ ok: true, value: 700050 });
  expect(parseUsd('0.07')).toEqual({ ok: true, value: 7 });
  for (const bad of ['', '-1', '1.234', 'abc', '1e5']) expect(parseUsd(bad).ok).toBe(false);
  expect(minorToInput(700050)).toBe('7000.50');
  expect(minorToInput(700000)).toBe('7000');
  expect(parsePercentToBps('5')).toEqual({ ok: true, value: 500 });
  expect(parsePercentToBps('2.5%')).toEqual({ ok: true, value: 250 });
  expect(parsePercentToBps('0.01')).toEqual({ ok: true, value: 1 });
  for (const bad of ['101', '-1', '1.234', 'x']) expect(parsePercentToBps(bad).ok).toBe(false);
  for (const bps of [0, 1, 5, 10, 250, 500, 9500, 10000]) expect(parsePercentToBps(bpsToPercent(bps))).toEqual({ ok: true, value: bps });
});

test('PF-019 address lists are validated, lower-cased and de-duplicated', () => {
  const a = '0x' + 'A'.repeat(40);
  expect(parseAddresses(`${a}\n${a.toLowerCase()}`)).toEqual({ ok: true, value: ['0x' + 'a'.repeat(40)] });
  expect(parseAddresses('')).toEqual({ ok: true, value: [] });
  expect(parseAddresses('0x1234').ok).toBe(false);
});

test('PF-019 form round-trips every rule and refuses an address that is both known and blocked', () => {
  const rules = { ...CONTRACT_DEFAULTS, known_recipients: ['0x' + 'c'.repeat(40)] };
  expect(fromForm(toForm(rules), rules)).toEqual({ ok: true, rules });
  const form = { ...toForm(rules), blocked_recipients: '0x' + 'c'.repeat(40) };
  const result = fromForm(form, rules);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.blocked_recipients).toContain('both known and blocked');
});

test('PF-019 diff marks exactly the changed rules', () => {
  const next = { ...CONTRACT_DEFAULTS, autonomy_limit_minor: 12000 };
  const changes = diff(next, CONTRACT_DEFAULTS).filter((c) => c.changed);
  expect(changes).toEqual([{ label: 'Autonomy limit', before: '$150', after: '$120', changed: true }]);
  expect(diff(next, null).every((c) => c.before === 'Not set')).toBe(true);
});
