/**
 * The last safe amount the optimizer returned in this browser tab, tied to the state version it was computed for.
 * Display only: it lets Home show "safe before → safe now" after an expense. It is never sent anywhere or trusted.
 */
export type LastSafe = { amountMinor: number | null; stateVersion: number };

const KEY = 'prooffi.lastSafe';

export function rememberSafe(value: LastSafe): void {
  try { sessionStorage.setItem(KEY, JSON.stringify(value)); } catch { /* storage unavailable: nothing to show later */ }
}

export function recallSafe(): LastSafe | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.stateVersion !== 'number' || !(v.amountMinor === null || Number.isSafeInteger(v.amountMinor))) return null;
    return v;
  } catch { return null; }
}
