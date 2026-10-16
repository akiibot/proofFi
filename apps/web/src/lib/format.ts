// Display helpers. Money arrives as integer USD cents and chain amounts as decimal strings (docs/DECISIONS.md D04).
// These only format what the API returned; they never estimate or convert with an invented rate.

export function formatUsd(minor: number): string {
  // Whole dollars stay compact ($12,000); any cents are always shown with two digits ($12,000.50), never $12,000.5.
  const digits = minor % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(minor / 100);
}

const WEI_PER_ETH = 10n ** 18n;

/** Exact wei -> ETH using BigInt. Returns null when the string is not a plain non-negative integer. */
export function formatWeiAsEth(wei: string): string | null {
  if (!/^\d+$/.test(wei)) return null;
  const value = BigInt(wei);
  const whole = value / WEI_PER_ETH;
  const fraction = (value % WEI_PER_ETH).toString().padStart(18, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : `${whole}`;
}

/** 0x1234…abcd for long addresses; shorter values are returned unchanged. */
export function shortAddress(address: string): string {
  return address.length > 14 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address;
}

export function formatUtc(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : `${date.toISOString().replace('T', ' ').slice(0, 16)} UTC`;
}

// Labels for the values GET /chain/status can return. An unknown value is shown verbatim instead of being guessed.
const CHAIN_LABELS: Record<string, string> = { CHAIN_NOT_CONFIGURED: 'Not configured', UNAVAILABLE: 'Unavailable', READY: 'Ready' };
export function chainStatusLabel(status: string): string {
  return CHAIN_LABELS[status] ?? status;
}
