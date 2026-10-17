import type { components } from '@/lib/schema';
import { formatUsd } from '@/lib/format';

export type OptimizerResult = components['schemas']['OptimizerResult'];
export type PlanResponse = components['schemas']['PlanResponse'];
export type ParsedIntent = components['schemas']['ParsedIntent'];
export type VerificationResult = components['schemas']['VerificationResult'];

type Tone = 'ok' | 'warn' | 'bad';

/** What an optimizer answer means for the person. The amount always comes from the backend; nothing is estimated here. */
export function explainOptimizer(result: OptimizerResult): { title: string; body: string; tone: Tone } {
  const checks = result.limiting_checks.length ? ` Limited by: ${result.limiting_checks.map((c) => c.replace(/_/g, ' ')).join(', ')}.` : '';
  if (result.status === 'SAFE_ACTION') {
    const edge = result.next_cent_rejected ? ' One cent more is rejected, so this is the exact limit.' : '';
    return { title: `Largest safe amount: ${formatUsd(result.max_amount_minor)}`, body: `Found after ${result.verifier_calls} independent verifier checks.${edge}${checks}`, tone: 'ok' };
  }
  if (result.status === 'NO_SAFE_ACTION') {
    return { title: 'No safe amount exists', body: `Even the smallest allocation breaks your Constitution, so ProofFi will not propose one.${checks}`, tone: 'warn' };
  }
  return { title: 'No single safe limit can be trusted', body: `Safety did not change steadily with the amount (a larger amount passed where a smaller one failed), so ProofFi refuses to pick one.${checks}`, tone: 'bad' };
}

export const MODE_LABEL: Record<PlanResponse['mode'], string> = { live_llm: 'Live AI planner', deterministic_demo: 'Deterministic demo planner' };

/** Query string for opening the Time Machine with a candidate already filled in. */
export function timeMachineLink(action: components['schemas']['CandidateAction'], amountMinor = action.amount_minor): string {
  const dollars = amountMinor % 100 ? (amountMinor / 100).toFixed(2) : String(amountMinor / 100);
  const query = new URLSearchParams({ amount: dollars, token: action.token_address, recipient: action.recipient });
  return `/time-machine?${query.toString()}`;
}
