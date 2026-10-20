import { scopeStorageKey } from '@/lib/scope-storage';
/**
 * The first-run tour of Home. Each step points at one element marked with `data-tour="<target>"`.
 * Steps whose element is missing or hidden (no waiting approval, a narrow screen) are left out when the tour starts,
 * so the progress count always matches what the person will actually see.
 */
export type TourStep = { target: string; eyebrow: string; title: string; body: string };

export const HOME_TOUR: TourStep[] = [
  { target: 'verdict', eyebrow: 'Start here', title: 'Is my money safe?', body: 'This line answers it first, every time you open Vallet: is everything your rules protect still untouched.' },
  { target: 'needs-you', eyebrow: 'Needs you', title: 'A payment is waiting for your OK', body: 'It shows the amount, the recipient and how long the offer lasts. Review opens the exact transfer before anything moves.' },
  { target: 'money', eyebrow: 'Your money', title: 'Protected and free', body: 'Protected money is your tuition and emergency floor. The AI can never touch it. Free is what is left to work with, before risk checks.' },
  { target: 'actions', eyebrow: 'What you do here', title: 'Ask, or record an expense', body: 'Ask Vallet in plain words, like “invest without risking my tuition”. Record an expense when something unexpected costs you money, so safe amounts stay honest.' },
  { target: 'tab-ask', eyebrow: 'Ask', title: 'Find the exact safe amount', body: 'Vallet checks your goal against your rules and 1,000 possible futures, then gets the answer signed. Nothing moves until you approve.' },
  { target: 'tab-rules', eyebrow: 'Rules', title: 'Your rules, in plain sentences', body: 'They protect your money. The AI follows them; only you can change them.' },
  { target: 'tab-activity', eyebrow: 'Activity', title: 'Everything that happened', body: 'Every step is linked to the one before and re-checked in your browser. You can download the full record.' },
  { target: 'bell', eyebrow: 'Notifications', title: 'What needs you, on every page', body: 'The bell counts approvals that are waiting for you. Click it to open the first one.' },
  { target: 'chain', eyebrow: 'Testnet', title: 'The network connection', body: 'Ready means Vallet can see the test network. It never sends anything without a signed check and your OK.' },
  { target: 'account', eyebrow: 'One more thing', title: 'Replay this tour anytime', body: 'Open your account menu and choose Take the tour.' },
];

export const TOUR_KEY = 'vallet.tour.v1';

/** True when this browser already finished or skipped the tour. Unreadable storage counts as seen, so it never nags. */
export function tourSeen(): boolean {
  try { return window.localStorage.getItem(scopeStorageKey(TOUR_KEY)) !== null; } catch { return true; }
}

export function markTourSeen(how: 'done' | 'skipped') {
  try { window.localStorage.setItem(scopeStorageKey(TOUR_KEY), how); } catch { /* nothing to remember */ }
}

export function tourTarget(target: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}
