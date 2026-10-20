import { scopeStorageKey } from '@/lib/scope-storage';
/**
 * The first-run tour of Home. Each step points at one element marked with `data-tour="<target>"`.
 * Steps whose element is missing or hidden (no waiting approval, a narrow screen) are left out when the tour starts,
 * so the progress count always matches what the person will actually see.
 */
export type TourStep = { target: string; eyebrow: string; title: string; body: string };
/** The welcome card before step 1. `{steps}` is replaced with the number of steps shown. */
export type TourIntro = { eyebrow: string; title: string; body: string };

export const HOME_TOUR: TourStep[] = [
  { target: 'verdict', eyebrow: 'Start here', title: 'Is my money safe?', body: 'This line answers it first, every time you open Vallet: is everything your rules protect still untouched.' },
  { target: 'needs-you', eyebrow: 'Needs you', title: 'A payment is waiting for your OK', body: 'It shows the amount, the recipient and how long the offer lasts. Review opens the exact transfer before anything moves.' },
  { target: 'money', eyebrow: 'Your money', title: 'Protected and free', body: 'Protected money is your tuition and emergency floor. The AI can never touch it. Free is what is left to work with, before risk checks.' },
  { target: 'actions', eyebrow: 'What you do here', title: 'Ask, or record an expense', body: 'Ask Vallet in plain words, like “invest without risking my tuition”. Record an expense when something unexpected costs you money, so safe amounts stay honest.' },
  { target: 'tab-ask', eyebrow: 'Ask', title: 'Find the exact safe amount', body: 'Vallet checks your goal against your rules and 1,000 possible futures, then gets the answer signed. Nothing moves until you approve.' },
  { target: 'tab-simulate', eyebrow: 'Simulate', title: 'Play out a decision first', body: 'Test an amount before you act. Vallet uses configured futures of your money to show how often your goal and floor survive.' },
  { target: 'tab-rules', eyebrow: 'Rules', title: 'Your rules, in plain sentences', body: 'They protect your money. The AI follows them; only you can change them.' },
  { target: 'tab-activity', eyebrow: 'Activity', title: 'Everything that happened', body: 'Every step is linked to the one before and re-checked in your browser. You can download the full record.' },
  { target: 'bell', eyebrow: 'Notifications', title: 'What needs you, on every page', body: 'The bell counts approvals that are waiting for you. Click it to open the first one.' },
  { target: 'chain', eyebrow: 'Testnet', title: 'The network connection', body: 'Ready means Vallet can see the test network. It never sends anything without a signed check and your OK.' },
  { target: 'account', eyebrow: 'One more thing', title: 'Replay this tour anytime', body: 'Open your account menu and choose Take the tour.' },
];

export const HOME_INTRO: TourIntro = { eyebrow: 'Welcome to Vallet', title: 'Your AI suggests. Your rules decide.', body: 'A one-minute tour of where everything is, in {steps} short steps. Skip it now and replay it anytime from your account menu.' };

/** The Simulate page: what the stage shows, where to type, and how to follow a run. */
export const SIMULATE_TOUR: TourStep[] = [
  { target: 'sim-stage', eyebrow: 'The screen', title: 'Your possible futures appear here', body: 'Each line is one way your cash could move over the coming months, drawn against your emergency floor. Hover it to read any day.' },
  { target: 'sim-composer', eyebrow: 'Ask', title: 'Type a decision to test', body: 'For example “What if I invest $2,000?”. Include a dollar amount, or let the AI suggest one. Press Run simulation.' },
  { target: 'sim-suggestions', eyebrow: 'Examples', title: 'Or start from one of these', body: 'Tap an example to run it straight away.' },
  { target: 'sim-status', eyebrow: 'Progress', title: 'Follow each step', body: 'This line shows request status and elapsed time, including display pacing. Results appear under the screen when it finishes.' },
];

export const SIMULATE_INTRO: TourIntro = { eyebrow: 'Simulate', title: 'Test a decision before you make it', body: 'A short tour of this page in {steps} steps. Nothing you test here is approved or sent.' };

export const TOUR_KEY = 'vallet.tour.v1';
export const SIMULATE_TOUR_KEY = 'vallet.tour.simulate.v1';

/** True when this browser already finished or skipped that tour. Unreadable storage counts as seen, so it never nags. */
export function tourSeen(key = TOUR_KEY): boolean {
  try { return window.localStorage.getItem(scopeStorageKey(key)) !== null; } catch { return true; }
}

export function markTourSeen(how: 'done' | 'skipped', key = TOUR_KEY) {
  try { window.localStorage.setItem(scopeStorageKey(key), how); } catch { /* nothing to remember */ }
}

export function tourTarget(target: string): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? el : null;
}
