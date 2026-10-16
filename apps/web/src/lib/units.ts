// Exact conversions between what a person types and the API's integer units (D04):
// USD cents for money, basis points for probabilities and shares (10000 bps = 100%). No floating point.

const MAX_MINOR = 9_000_000_000_000; // contract upper bound for money fields

export type Parsed = { ok: true; value: number } | { ok: false; error: string };

/** "7000", "7,000.5", "$7,000.50" -> 700050 cents. Rejects negatives, more than two decimals and out-of-range values. */
export function parseUsd(text: string): Parsed {
  const clean = text.trim().replace(/^\$/, '').replace(/,/g, '');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(clean);
  if (!match) return { ok: false, error: 'Enter a dollar amount like 7000 or 7000.50.' };
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || '0');
  if (!Number.isSafeInteger(cents) || cents > MAX_MINOR) return { ok: false, error: 'That amount is too large.' };
  return { ok: true, value: cents };
}

/** 700050 -> "7000.50", 700000 -> "7000" (an editable value, no grouping). */
export function minorToInput(minor: number): string {
  const dollars = Math.floor(minor / 100);
  const cents = minor % 100;
  return cents ? `${dollars}.${String(cents).padStart(2, '0')}` : `${dollars}`;
}

/** "5" -> 500, "2.5" -> 250, "0.01" -> 1, "5%" -> 500. Range 0% to 100%. */
export function parsePercentToBps(text: string): Parsed {
  const match = /^(\d{1,3})(?:\.(\d{1,2}))?$/.exec(text.trim().replace(/%$/, '').trim());
  if (!match) return { ok: false, error: 'Enter a percentage like 5 or 2.5.' };
  const bps = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0') || '0');
  if (bps > 10000) return { ok: false, error: 'A percentage cannot be above 100.' };
  return { ok: true, value: bps };
}

/** 500 -> "5", 250 -> "2.5", 1 -> "0.01". */
export function bpsToPercent(bps: number): string {
  const whole = Math.floor(bps / 100);
  const rest = bps % 100;
  return rest ? `${whole}.${String(rest).padStart(2, '0').replace(/0$/, '')}` : `${whole}`;
}

const ADDRESS = /^0x[0-9a-f]{40}$/;

/** One address per line (or comma separated). Lower-cases them: the contract stores lowercase hex, and case is only a checksum. */
export function parseAddresses(text: string): { ok: true; value: string[] } | { ok: false; error: string } {
  const items = text.split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const bad = items.find((item) => !ADDRESS.test(item));
  if (bad) return { ok: false, error: `"${bad.length > 20 ? bad.slice(0, 20) + '…' : bad}" is not a 0x address with 40 hex characters.` };
  return { ok: true, value: [...new Set(items)] };
}
