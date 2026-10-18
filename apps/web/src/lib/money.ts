import type { components } from './schema';

type State = components['schemas']['FinancialState'];
type Rules = components['schemas']['ConstitutionRules'];

const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

export type Buckets = {
  liquidMinor: number;
  highRiskMinor: number;
  totalMinor: number;
  obligationsMinor: number;
  obligationNames: string[];
  floorMinor: number | null;
  protectedMinor: number;
  livingMinor: number;
  freeMinor: number;
  livingCount: number;
};

/**
 * Splits the persisted snapshot into the buckets Home shows. Pure arithmetic on recorded values:
 * protected = protected obligations + the active emergency floor; living = every scheduled recurring payment;
 * free = liquid cash minus both. It can be negative, and is shown as such.
 */
export function buckets(state: State, rules: Rules | null): Buckets {
  const s = state.snapshot;
  const liquidMinor = sum(s.assets.filter((a) => a.liquid).map((a) => a.amount_minor));
  const highRiskMinor = sum(s.assets.filter((a) => a.high_risk).map((a) => a.amount_minor));
  const totalMinor = sum(s.assets.map((a) => a.amount_minor));
  const protectedObligations = s.obligations.filter((o) => o.protected);
  const obligationsMinor = sum(protectedObligations.map((o) => o.amount_minor));
  const floorMinor = rules ? rules.emergency_floor_minor : null;
  const protectedMinor = obligationsMinor + (floorMinor ?? 0);
  const livingMinor = sum(s.recurring_expenses.map((e) => e.amount_minor * e.due_days.length));
  const livingCount = sum(s.recurring_expenses.map((e) => e.due_days.length));
  return {
    liquidMinor, highRiskMinor, totalMinor, obligationsMinor, obligationNames: protectedObligations.map((o) => o.name), floorMinor,
    protectedMinor, livingMinor, livingCount, freeMinor: liquidMinor - protectedMinor - livingMinor,
  };
}

export function greeting(date = new Date()): string {
  const h = date.getHours();
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function clock(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** "4:12" until an ISO time, or null once it has passed. */
export function countdown(iso: string, now: number): string | null {
  const ms = Date.parse(iso) - now;
  if (!(ms > 0)) return null;
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
