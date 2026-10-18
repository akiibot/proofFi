'use client';
import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { CandidateAction } from '@/lib/candidate';
import { run, writeHeaders, type Outcome, type Problem } from '@/lib/request';
import { rememberSafe } from '@/lib/safe-memory';
import type { OptimizerResult, ParsedIntent, PlanResponse, VerificationResult } from '@/components/workspace/explain';
import type { SimulationRun } from './explain';

const sessionProblem: Problem = { code: 'UNAUTHORIZED', message: 'Your session could not be checked. Sign in again and retry.', reasons: [], httpStatus: 0 };

export type Step<T> = { state: 'todo' | 'active' | 'done' | 'failed'; data?: T; problem?: Problem };
const todo = <T,>(): Step<T> => ({ state: 'todo' });

export type RunState = {
  goal: string;
  manual: boolean;
  intent: Step<ParsedIntent>;
  plan: Step<PlanResponse>;
  check: Step<OptimizerResult>;
  futures: Step<SimulationRun>;
  verify: Step<VerificationResult>;
};

const empty = (goal = '', manual = false): RunState => ({ goal, manual, intent: todo(), plan: todo(), check: todo(), futures: todo(), verify: todo() });

/**
 * One guided run: understand the goal and get untrusted suggestions (in parallel), then let the independent optimizer find
 * the largest amount the rules allow, then simulate exactly that amount. Each step is marked done only when its real
 * response arrives. A newer run makes older responses irrelevant.
 */
export function useAskRun(stateVersion: number | null) {
  const router = useRouter();
  const [state, setState] = useState<RunState>(empty());
  const current = useRef(0);

  const post = useCallback(async <T,>(call: (headers: Record<string, string>) => Promise<Outcome<T>>): Promise<Outcome<T> | null> => {
    try {
      const outcome = await call(await writeHeaders());
      if (!outcome.ok && outcome.expired) { router.replace('/login'); return null; }
      return outcome;
    } catch { return { ok: false, expired: false, problem: sessionProblem }; }
  }, [router]);

  const patch = useCallback((id: number, update: (s: RunState) => RunState) => { if (id === current.current) setState(update); }, []);

  const checkAction = useCallback(async (id: number, action: CandidateAction) => {
    patch(id, (s) => ({ ...s, check: { state: 'active' } }));
    const optimized = await post((h) => run(() => api.POST('/optimize', { body: { action }, headers: h })));
    if (!optimized) return;
    if (!optimized.ok) { patch(id, (s) => ({ ...s, check: { state: 'failed', problem: optimized.problem } })); return; }
    const result = optimized.data;
    if (stateVersion !== null) rememberSafe({ amountMinor: result.status === 'SAFE_ACTION' ? result.max_amount_minor : null, stateVersion });
    if (result.status !== 'SAFE_ACTION' || !result.action) { patch(id, (s) => ({ ...s, check: { state: 'done', data: result } })); return; }
    patch(id, (s) => ({ ...s, futures: { state: 'active' } }));
    const safe = result.action;
    const simulated = await post((h) => run(() => api.POST('/simulate', { body: { action: safe }, headers: h })));
    if (!simulated) return;
    patch(id, (s) => ({ ...s, check: { state: 'done', data: result }, futures: simulated.ok ? { state: 'done', data: simulated.data } : { state: 'failed', problem: simulated.problem } }));
  }, [patch, post, stateVersion]);

  /** Goal in plain words: the planner suggests, the optimizer decides the limit. */
  const start = useCallback(async (goal: string) => {
    const id = ++current.current;
    setState({ ...empty(goal), intent: { state: 'active' }, plan: { state: 'active' } });
    const [parsed, planned] = await Promise.all([
      post((h) => run(() => api.POST('/intent/parse', { body: { goal }, headers: h }))),
      post((h) => run(() => api.POST('/plans/generate', { body: { goal }, headers: h }))),
    ]);
    if (!parsed || !planned) return;
    patch(id, (s) => ({
      ...s,
      intent: parsed.ok ? { state: 'done', data: parsed.data } : { state: 'failed', problem: parsed.problem },
      plan: planned.ok ? { state: 'done', data: planned.data } : { state: 'failed', problem: planned.problem },
    }));
    if (!planned.ok || planned.data.clarification.length > 0 || planned.data.candidates.length === 0) return;
    await checkAction(id, planned.data.candidates[0]);
  }, [checkAction, patch, post]);

  /** An exact amount the person typed: no planner, straight to the independent check. */
  const startManual = useCallback(async (action: CandidateAction, goal: string) => {
    const id = ++current.current;
    setState({ ...empty(goal, true), intent: { state: 'done' }, plan: { state: 'done' } });
    await checkAction(id, action);
  }, [checkAction]);

  /** Ask the independent verifier to sign exactly the safe action. Returns the certificate ID when one is issued. */
  const certify = useCallback(async (): Promise<string | null> => {
    const id = current.current;
    const action = state.check.data?.action;
    if (!action) return null;
    patch(id, (s) => ({ ...s, verify: { state: 'active' } }));
    const verified = await post((h) => run(() => api.POST('/verify', { body: { action }, headers: h })));
    if (!verified) return null;
    if (!verified.ok) { patch(id, (s) => ({ ...s, verify: { state: 'failed', problem: verified.problem } })); return null; }
    patch(id, (s) => ({ ...s, verify: { state: 'done', data: verified.data } }));
    return verified.data.certificate_id;
  }, [patch, post, state.check.data]);

  const reset = useCallback(() => { ++current.current; setState(empty()); }, []);

  return { state, start, startManual, certify, reset };
}
