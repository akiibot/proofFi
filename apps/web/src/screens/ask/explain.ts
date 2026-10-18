import { formatUsd } from '@/lib/format';
import type { components } from '@/lib/schema';
import { bpsToPercent } from '@/lib/units';

type Rules = components['schemas']['ConstitutionRules'];
export type SimulationRun = components['schemas']['SimulationRun'];
export type OptimizerResult = components['schemas']['OptimizerResult'];

const pct = (bps: number) => `${bpsToPercent(bps)}%`;

/** Rule numbers as the Rules screen shows them (I–IX). */
export const RULE_NUMBER: Record<string, string> = {
  tuition_reserve: 'I', emergency_floor: 'II', autonomy_limit: 'III', counterparty: 'IV', blocked_recipient: 'V',
  asset_chain_allowlist: 'VI', high_risk_concentration: 'VII', goal_satisfaction_probability: 'VIII', reserve_breach_probability: 'IX',
};

/** Plain-language reason for one optimizer/policy reason code. Unknown codes are shown in words, never hidden. */
export function reasonText(code: string, rules: Rules | null): string {
  const r = rules;
  switch (code) {
    case 'HIGH_RISK_CONCENTRATION_EXCEEDED': return `more would put over ${r ? pct(r.high_risk_concentration_bps) : 'the allowed share'} of your free money in high-risk assets (your Rule VII)`;
    case 'TUITION_RESERVE_VIOLATION': return `more would dip into your ${r ? formatUsd(r.tuition_reserve_minor) : ''} tuition (your Rule I)`.replace('  ', ' ');
    case 'EMERGENCY_FLOOR_VIOLATION': return `more would break your ${r ? formatUsd(r.emergency_floor_minor) : ''} emergency floor (your Rule II)`.replace('  ', ' ');
    case 'GOAL_PROBABILITY_BELOW_MINIMUM': return `more would leave tuition paid in fewer than ${r ? pct(r.goal_satisfaction_min_bps) : 'the required share'} of simulated futures (your Rule VIII)`;
    case 'RESERVE_BREACH_RISK_EXCEEDED': return `more would let your floor break in over ${r ? pct(r.reserve_breach_max_bps) : 'the allowed share'} of simulated futures (your Rule IX)`;
    case 'BLOCKED_RECIPIENT': return 'the recipient is on your blocked list (your Rule V)';
    case 'TOKEN_NOT_ALLOWED': return 'that token is not on your approved list (your Rule VI)';
    case 'CHAIN_NOT_ALLOWED': return 'only Base Sepolia testnet is allowed';
    case 'BORROWED_FUNDING_FORBIDDEN': return 'borrowed money is never used';
    case 'STRESS_MARKET_SHOCK': return 'a market crash would leave tuition unpaid';
    case 'STRESS_INCOME_DELAY': return 'late income would leave tuition unpaid';
    case 'STRESS_EMERGENCY_EXPENSE': return 'a surprise bill would leave tuition unpaid';
    case 'STRESS_FEE_SHOCK': return 'higher fees would leave tuition unpaid';
    case 'CHAIN_TOKEN_BALANCE': return 'the testnet wallet does not hold enough test tokens';
    case 'CHAIN_GAS_BALANCE': return 'the testnet wallet does not hold enough gas for fees';
    case 'NO_SPENDABLE_BALANCE': return 'there is no money free to use after what your rules protect';
    case 'AMOUNT_CONTRACT_LIMIT': return 'the amount is above what the system accepts';
    case 'BOUNDARY_NOT_ESTABLISHED': return 'safety did not change steadily with the amount, so no single limit can be trusted';
    case 'VERIFIER_DENIED': return 'the independent checker refused it';
    default: return code.toLowerCase().replace(/_/g, ' ');
  }
}

export function limitSentence(result: OptimizerResult, rules: Rules | null): string {
  const reasons = result.limiting_checks.map((c) => reasonText(c, rules));
  if (result.status === 'SAFE_ACTION') {
    const why = reasons.length ? `It stops here because ${reasons.join('; and ')}.` : 'It stops here.';
    return `${why}${result.next_cent_rejected ? ' One cent more is refused.' : ''}`;
  }
  if (result.status === 'NO_SAFE_ACTION') return `Even $1 would break your rules: ${reasons.join('; ') || 'no amount passes'}.`;
  return 'Safety did not rise and fall steadily with the amount, so ProofFi will not pick a number.';
}

const STRESS_LABEL: Record<string, string> = { market_shock: 'Market crash', income_delay: 'Income late', emergency_expense: 'Surprise bill', fee_shock: 'Fees rise' };

function stressParameter(s: SimulationRun['stress_results'][number]): string {
  const p = s.parameters;
  // Parameter names from services/api/app/simulation/stress.py.
  if (s.name === 'market_shock' && typeof p.market_loss_bps === 'number') return `${STRESS_LABEL[s.name]}, −${bpsToPercent(p.market_loss_bps)}%`;
  if (s.name === 'income_delay' && typeof p.income_delay_days === 'number') return `Income ${p.income_delay_days} days late`;
  if (s.name === 'emergency_expense' && typeof p.emergency_expense_minor === 'number') return `Surprise ${formatUsd(p.emergency_expense_minor)} bill`;
  if (s.name === 'fee_shock' && typeof p.fee_multiplier === 'number') return p.fee_multiplier === 3 ? 'Fees triple' : `Fees ×${p.fee_multiplier}`;
  return STRESS_LABEL[s.name] ?? s.name.replace(/_/g, ' ');
}

export function stressRows(run: SimulationRun) {
  return run.stress_results.map((s) => ({ key: s.name, label: stressParameter(s), passed: s.passed && s.goal_funded, lowest: s.minimum_liquidity_minor }));
}

/** The three plain facts under the answer, each read from the simulation of exactly that amount. */
export function facts(run: SimulationRun, rules: Rules | null, obligation: string): { text: string; ok: boolean }[] {
  const m = run.metrics;
  const paths = run.config.path_count.toLocaleString('en-US');
  const goal = m.goal_satisfaction_probability_bps;
  const out = [{ text: goal >= 10000 ? `${obligation} is paid in all ${paths} simulated futures` : `${obligation} is paid in ${pct(goal)} of ${paths} simulated futures`, ok: rules ? goal >= rules.goal_satisfaction_min_bps : goal >= 10000 }];
  const breach = m.reserve_breach_probability_bps;
  const floor = rules ? formatUsd(rules.emergency_floor_minor) : 'emergency';
  out.push({ text: breach === 0 ? `Your ${floor} emergency floor is never broken` : `Your ${floor} floor breaks in ${pct(breach)} of futures`, ok: rules ? breach <= rules.reserve_breach_max_bps : breach === 0 });
  const failing = run.stress_results.filter((s) => !s.passed || !s.goal_funded);
  out.push(failing.length === 0
    ? { text: 'Survives a market crash, late income, a surprise bill and fee spikes', ok: true }
    : { text: `Fails ${failing.length} bad-luck test${failing.length === 1 ? '' : 's'}: ${failing.map((s) => STRESS_LABEL[s.name] ?? s.name).join(', ').toLowerCase()}`, ok: false });
  return out;
}

export function capitalise(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
