import { formatUsd } from '@/lib/format';
import { parsePercentToBps, parseUsd } from '@/lib/units';
import type { FormValues } from '@/components/constitution/rules';
import type { IconName } from '@/ui/Icon';

export type GroupKey = 'never' | 'alone' | 'risk';
export const GROUPS: { key: GroupKey; title: string; icon: IconName }[] = [
  { key: 'never', title: 'Money the AI can never touch', icon: 'lock' },
  { key: 'alone', title: 'What the AI may do on its own', icon: 'ai' },
  { key: 'risk', title: 'How much risk is acceptable', icon: 'chart' },
];

export type Line = {
  key: keyof FormValues;
  group: GroupKey;
  number: string;
  before: string;
  after: string;
  tag: 'Always' | 'Your OK' | 'Simulated';
  kind: 'usd' | 'bps' | 'addresses';
  /** Accessible name; matches the original rules form labels. */
  label: string;
  noun?: [string, string];
  change: string;
  futures?: boolean;
};

/** Each rule as a sentence, numbered I–IX in the order of the Figma "12 Rules" screen. */
export const LINES: Line[] = [
  { key: 'tuition_reserve_minor', group: 'never', number: 'I', before: 'Keep', after: 'for tuition until it is paid.', tag: 'Always', kind: 'usd', label: 'Tuition reserve (USD)', change: 'Kept for tuition' },
  { key: 'emergency_floor_minor', group: 'never', number: 'II', before: 'Always keep', after: 'in cash as an emergency floor.', tag: 'Always', kind: 'usd', label: 'Emergency floor (USD)', change: 'Emergency floor' },
  { key: 'autonomy_limit_minor', group: 'alone', number: 'III', before: 'Act alone up to', after: '. Anything bigger needs your OK.', tag: 'Your OK', kind: 'usd', label: 'Autonomy limit (USD)', change: 'AI may act alone up to' },
  { key: 'known_recipients', group: 'alone', number: 'IV', before: 'Send to', after: '. Any new address needs your OK.', tag: 'Your OK', kind: 'addresses', label: 'Known recipients', noun: ['known address', 'known addresses'], change: 'Known addresses' },
  { key: 'blocked_recipients', group: 'alone', number: 'V', before: 'Never send to', after: '.', tag: 'Always', kind: 'addresses', label: 'Blocked recipients', noun: ['blocked address', 'blocked addresses'], change: 'Blocked addresses' },
  { key: 'allowed_tokens', group: 'alone', number: 'VI', before: 'Use only', after: '.', tag: 'Always', kind: 'addresses', label: 'Allowed tokens', noun: ['approved test token', 'approved test tokens'], change: 'Approved tokens' },
  { key: 'high_risk_concentration_bps', group: 'risk', number: 'VII', before: 'Keep high-risk money under', after: 'of your free money.', tag: 'Always', kind: 'bps', label: 'High-risk concentration (%)', change: 'High-risk money under' },
  { key: 'goal_satisfaction_min_bps', group: 'risk', number: 'VIII', before: 'Tuition must be paid in at least', after: 'of simulated futures.', tag: 'Simulated', kind: 'bps', label: 'Minimum goal probability (%)', change: 'Tuition paid in at least', futures: true },
  { key: 'reserve_breach_max_bps', group: 'risk', number: 'IX', before: 'The floor may break in at most', after: 'of simulated futures.', tag: 'Simulated', kind: 'bps', label: 'Maximum reserve-breach probability (%)', change: 'Floor may break in at most', futures: true },
];

export const addressList = (text: string) => text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);

/** The value as the sentence shows it: "$7,000", "25%", "2 known addresses". Unparseable input is shown as typed. */
export function display(line: Line, text: string): string {
  if (line.kind === 'usd') { const p = parseUsd(text); return p.ok ? formatUsd(p.value) : text; }
  if (line.kind === 'bps') { const p = parsePercentToBps(text); return p.ok ? `${text.trim().replace(/%$/, '')}%` : text; }
  const n = addressList(text).length;
  return `${n} ${line.noun ? line.noun[n === 1 ? 0 : 1] : 'addresses'}`;
}

export function changeValue(line: Line, text: string): string {
  return line.futures ? `${display(line, text)} of futures` : display(line, text);
}

export function sameValue(line: Line, a: string, b: string): boolean {
  if (line.kind === 'addresses') {
    const x = [...new Set(addressList(a.toLowerCase()))].sort().join(), y = [...new Set(addressList(b.toLowerCase()))].sort().join();
    return x === y;
  }
  const parse = line.kind === 'usd' ? parseUsd : parsePercentToBps;
  const pa = parse(a), pb = parse(b);
  return pa.ok && pb.ok ? pa.value === pb.value : a.trim() === b.trim();
}
