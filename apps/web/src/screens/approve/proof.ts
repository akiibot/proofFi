import { formatUsd, formatUtc } from '@/lib/format';
import { bpsToPercent } from '@/lib/units';
import type { ActionCertificate } from '@/components/certificates/status';

type Check = ActionCertificate['payload']['verdict']['checks'][number];

const num = (m: Check['measured'], key: string): number | null => (typeof m[key] === 'number' ? (m[key] as number) : null);
const pct = (bps: number) => `${bpsToPercent(bps)}%`;
const pct2 = (bps: number) => `${(bps / 100).toFixed(2)}%`;

/** Token units shown to a person: 2000000000 base units at 6 decimals is "2,000". Exact, using BigInt. */
export function tokenAmount(baseUnits: string, decimals: number): string {
  if (!/^\d+$/.test(baseUnits)) return baseUnits;
  const unit = 10n ** BigInt(decimals);
  const value = BigInt(baseUnits);
  const whole = (value / unit).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const fraction = (value % unit).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole;
}

export function groupedUnits(baseUnits: string): string {
  return /^\d+$/.test(baseUnits) ? baseUnits.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : baseUnits;
}

export type ProofRow = { key: string; label: string; value: string; kind: 'pass' | 'ok' | 'fail' };

const NUMBER: Record<string, string> = {
  tuition_reserve: 'I', emergency_floor: 'II', autonomy_limit: 'III', counterparty: 'IV', high_risk_concentration: 'VII',
  goal_satisfaction_probability: 'VIII', reserve_breach_probability: 'IX',
};

/** One readable line per policy check, built only from the signed verdict. The checks never shown separately are folded into "N more". */
export function proofRows(cert: ActionCertificate): { rows: ProofRow[]; passed: number; needOk: number; folded: { count: number; allPass: boolean } } {
  const checks = cert.payload.verdict.checks;
  const rows: ProofRow[] = [];
  const foldedChecks: Check[] = [];
  for (const c of checks) {
    const n = NUMBER[c.rule];
    const tag = n ? ` (${n})` : '';
    const needs = c.status === 'REQUIRES_APPROVAL';
    const fail = c.status === 'FAIL';
    const value = needs ? 'Needs your OK' : fail ? 'Failed' : '✓';
    const kind: ProofRow['kind'] = needs ? 'ok' : fail ? 'fail' : 'pass';
    const m = c.measured;
    switch (c.rule) {
      case 'autonomy_limit': { const lim = num(m, 'autonomy_limit_minor'); rows.push({ key: c.rule, label: needs ? `Above ${lim !== null ? formatUsd(lim) : 'the limit'} alone${tag}` : `Within ${lim !== null ? formatUsd(lim) : 'the limit'} alone${tag}`, value, kind }); break; }
      case 'counterparty': rows.push({ key: c.rule, label: needs ? `New recipient${tag}` : fail ? `Blocked recipient${tag}` : `Known recipient${tag}`, value, kind }); break;
      case 'tuition_reserve': { const req = num(m, 'protected_required_minor'); rows.push({ key: c.rule, label: `${req !== null ? `Tuition ${formatUsd(req)} kept` : 'Tuition kept'}${tag}`, value, kind }); break; }
      case 'emergency_floor': rows.push({ key: c.rule, label: `Emergency floor kept${tag}`, value, kind }); break;
      case 'high_risk_concentration': { const a = num(m, 'concentration_bps'), l = num(m, 'concentration_limit_bps'); rows.push({ key: c.rule, label: `High-risk ${a !== null ? pct2(a) : ''} of ${l !== null ? pct(l) : 'the limit'}${tag}`, value, kind }); break; }
      case 'goal_satisfaction_probability': { const a = num(m, 'goal_satisfaction_probability_bps'), l = num(m, 'required_minimum_bps'); rows.push({ key: c.rule, label: `Goal survival ${a !== null ? pct(a) : ''} of ${l !== null ? pct(l) : 'the minimum'}${tag}`, value, kind }); break; }
      case 'reserve_breach_probability': { const a = num(m, 'reserve_breach_probability_bps'), l = num(m, 'allowed_maximum_bps'); rows.push({ key: c.rule, label: `Reserve breach ${a !== null ? pct(a) : ''} of ${l !== null ? pct(l) : 'the maximum'}${tag}`, value, kind }); break; }
      default: foldedChecks.push(c);
    }
  }
  // Display order follows the Figma proof drawer: what needs the person first, then what passed.
  rows.sort((a, b) => Number(b.kind === 'ok') - Number(a.kind === 'ok'));
  return {
    rows, passed: checks.filter((c) => c.status === 'PASS').length, needOk: checks.filter((c) => c.status === 'REQUIRES_APPROVAL').length,
    folded: { count: foldedChecks.length, allPass: foldedChecks.every((c) => c.status === 'PASS') },
  };
}

export const FOLDED_LABEL = 'Network, token, funding, stresses';

/** The reasons an approval is asked for, in the person's words. */
export function approvalSentence(cert: ActionCertificate): string {
  const reasons = cert.payload.approval.reasons;
  const autonomy = cert.payload.verdict.checks.find((c) => c.rule === 'autonomy_limit');
  const limit = autonomy ? num(autonomy.measured, 'autonomy_limit_minor') : null;
  const parts = reasons.map((r) => {
    if (r === 'ABOVE_AUTONOMY_LIMIT') return `it is more than the ${limit !== null ? formatUsd(limit) : 'amount'} the AI may move alone`;
    if (r === 'NEW_RECIPIENT_APPROVAL_REQUIRED') return 'you have not sent to this address before';
    return r.toLowerCase().replace(/_/g, ' ');
  });
  if (!parts.length) return 'Your rules ask for your OK before this can be sent.';
  return `Your rules ask for your OK: ${parts.join(', and ')}.`;
}

export const validUntil = (cert: ActionCertificate) => formatUtc(cert.payload.expires_at).replace(/^\d{4}-\d{2}-\d{2} /, '');
