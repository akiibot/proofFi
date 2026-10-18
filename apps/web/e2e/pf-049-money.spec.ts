import { test, expect } from '@playwright/test';
import { buckets } from '../src/lib/money';
import type { components } from '../src/lib/schema';

type State = components['schemas']['FinancialState'];
// Isolated display inputs. Real policy semantics are independently covered by the backend suite.
const state = {
  snapshot: { goal: { obligation_id: 'tuition' }, assets: [{ id: 'cash', amount_minor: 1700000, liquid: true, high_risk: false }],
    obligations: [{ id: 'tuition', name: 'Tuition', amount_minor: 700000, protected: true }], recurring_expenses: [{ amount_minor: 80000, due_days: [30, 60, 90, 120] }] },
} as State;
const policy = { tuition_reserve_minor: 700000, emergency_floor_minor: 200000 } as components['schemas']['ConstitutionRules'];

test('PF-049 normal profile protects tuition and floor and subtracts scheduled living costs', () => {
  expect(buckets(state, policy)).toMatchObject({ liquidMinor: 1700000, obligationsMinor: 700000, protectedMinor: 900000, livingMinor: 320000, freeMinor: 480000 });
});
test('PF-049 higher active reserve requires $18,000 protection against $17,000 cash', () => {
  const result = buckets(state, { ...policy, tuition_reserve_minor: 1600000 });
  expect(result.protectedMinor).toBe(1800000);
  expect(result.liquidMinor).toBeLessThan(result.protectedMinor);
  expect(result.freeMinor).toBe(-420000);
});
test('PF-049 excludes liquid high-risk and illiquid assets and retains other protected obligations', () => {
  const changed = structuredClone(state);
  changed.snapshot.assets.push({ id: 'risky', asset: 'risk', source: 'synthetic', amount_minor: 500000, liquid: true, high_risk: true }, { id: 'illiquid', asset: 'locked', source: 'synthetic', amount_minor: 900000, liquid: false, high_risk: false });
  changed.snapshot.obligations.push({ id: 'other', name: 'Other', amount_minor: 100000, protected: true, due_day: 10 });
  expect(buckets(changed, policy)).toMatchObject({ liquidMinor: 1700000, highRiskMinor: 500000, protectedMinor: 1000000, freeMinor: 380000 });
  expect(buckets(state, null)).toMatchObject({ protectedMinor: 700000, floorMinor: null });
});
