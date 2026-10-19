'use client';
import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { buildCandidate, type CandidateAction } from '@/lib/candidate';
import { run, writeHeaders, type Outcome, type Problem } from '@/lib/request';
import type { components } from '@/lib/schema';
import type { SimulationRun } from '@/screens/ask/explain';

type Rules = components['schemas']['ConstitutionRules'];

export type Phase = 'idle' | 'reading' | 'simulating' | 'done' | 'failed' | 'clarify';
export type Simulation = {
  phase: Phase;
  question: string;
  /** Where the tested amount came from: typed in the question, or suggested by the AI planner (untrusted). */
  source: 'typed' | 'ai' | null;
  amountMinor: number | null;
  result: SimulationRun | null;
  problem: string | null;
  clarification: string[];
  startedAt: number | null;
  finishedAt: number | null;
};

/**
 * The server finishes a run in well under a second. The result is held back until this much time has passed, so the
 * steps on screen can be read. This is deliberate display pacing, not computation time.
 */
export const MIN_RUN_MS = 4000;

const idle: Simulation = { phase: 'idle', question: '', source: null, amountMinor: null, result: null, problem: null, clarification: [], startedAt: null, finishedAt: null };
const sessionProblem: Problem = { code: 'UNAUTHORIZED', message: 'Your session could not be checked. Sign in again and retry.', reasons: [], httpStatus: 0 };

/** "$3,000", "3000 dollars", "$2.5k" → minor units. Plain numbers without a money cue are not taken as amounts. */
export function amountFrom(text: string): number | null {
  const m = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s?(k\b)?|\b(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s?(k\b|dollars?\b|usd\b)/i.exec(text);
  if (!m) return null;
  const whole = Number((m[1] ?? m[4]).replace(/,/g, ''));
  const cents = Number(((m[2] ?? m[5]) ?? '').padEnd(2, '0') || 0);
  const k = /^k$/i.test((m[3] ?? m[6]) ?? '');
  const minor = k ? Math.round((whole + cents / 100) * 100_000) : whole * 100 + cents;
  return minor > 0 && minor <= 9_000_000_000_000 ? minor : null;
}

/**
 * One simulation run. A typed amount is tested as-is; otherwise the AI planner suggests one (its text stays untrusted).
 * The simulation only plays the amount out across seeded futures. It never verifies, approves or sends anything.
 */
export function useSimulation(rules: Rules | null) {
  const router = useRouter();
  const [state, setState] = useState<Simulation>(idle);
  const latest = useRef(0);
  const runStart = useRef(0);

  const post = useCallback(async <T,>(call: (headers: Record<string, string>) => Promise<Outcome<T>>): Promise<Outcome<T> | null> => {
    try {
      const outcome = await call(await writeHeaders());
      if (!outcome.ok && outcome.expired) { router.replace('/login'); return null; }
      return outcome;
    } catch { return { ok: false, expired: false, problem: sessionProblem }; }
  }, [router]);

  const simulate = useCallback(async (id: number, action: CandidateAction) => {
    const simulated = await post((h) => run(() => api.POST('/simulate', { body: { action }, headers: h })));
    if (!simulated || id !== latest.current) return;
    const wait = runStart.current + MIN_RUN_MS - Date.now();
    if (wait > 0) await new Promise((resolve) => window.setTimeout(resolve, wait));
    if (id !== latest.current) return;
    setState((s) => simulated.ok
      ? { ...s, phase: 'done', result: simulated.data, finishedAt: Date.now() }
      : { ...s, phase: 'failed', problem: simulated.problem.message, finishedAt: Date.now() });
  }, [post]);

  const start = useCallback(async (question: string) => {
    const id = ++latest.current;
    runStart.current = Date.now();
    const typed = amountFrom(question);
    const base = { ...idle, question, startedAt: Date.now() };
    if (typed !== null) {
      const token = rules?.allowed_tokens[0] ?? '', recipient = rules?.known_recipients[0] ?? '';
      const built = buildCandidate({ amount: (typed / 100).toFixed(2), token, recipient }, `Simulation: ${question}`, 'simulate');
      if (!built.ok) { setState({ ...base, phase: 'failed', problem: 'Save your rules first, with an approved token and a known recipient. Open Rules, then try again.', finishedAt: Date.now() }); return; }
      setState({ ...base, phase: 'simulating', source: 'typed', amountMinor: typed });
      await simulate(id, built.action);
      return;
    }
    setState({ ...base, phase: 'reading' });
    const planned = await post((h) => run(() => api.POST('/plans/generate', { body: { goal: question }, headers: h })));
    if (!planned || id !== latest.current) return;
    if (!planned.ok) { setState((s) => ({ ...s, phase: 'failed', problem: planned.problem.message, finishedAt: Date.now() })); return; }
    if (planned.data.clarification.length) { setState((s) => ({ ...s, phase: 'clarify', clarification: planned.data.clarification, finishedAt: Date.now() })); return; }
    const first = planned.data.candidates[0];
    if (!first) { setState((s) => ({ ...s, phase: 'failed', problem: 'The AI did not suggest an amount. Try a question with a dollar amount, like “What if I invest $2,000?”.', finishedAt: Date.now() })); return; }
    setState((s) => ({ ...s, phase: 'simulating', source: 'ai', amountMinor: first.amount_minor }));
    await simulate(id, first);
  }, [post, rules, simulate]);

  const reset = useCallback(() => { ++latest.current; setState(idle); }, []);
  return { state, start, reset };
}
