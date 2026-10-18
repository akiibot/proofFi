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

/**
 * What the person typed and what the planner suggested for one certificate, kept in this tab only. The audit log does not
 * record either, so the payment story shows those two steps only when this record exists. Display only; never trusted.
 */
export type AskMemory = { goal: string; suggestionsMinor: number[]; at: string };

export function rememberAsk(certificateId: string, value: AskMemory): void {
  try { sessionStorage.setItem(`prooffi.ask.${certificateId}`, JSON.stringify(value)); } catch { /* nothing to show later */ }
}

export function recallAsk(certificateId: string): AskMemory | null {
  try {
    const raw = sessionStorage.getItem(`prooffi.ask.${certificateId}`);
    if (!raw) return null;
    const v = JSON.parse(raw);
    if (typeof v?.goal !== 'string' || typeof v?.at !== 'string' || !Array.isArray(v?.suggestionsMinor) || !v.suggestionsMinor.every((n: unknown) => Number.isSafeInteger(n))) return null;
    return v;
  } catch { return null; }
}
