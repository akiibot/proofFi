'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { run, writeHeaders, type Problem } from '@/lib/request';
import type { components } from '@/lib/schema';
import { CONTRACT_DEFAULTS, fromForm, type Draft, type FormValues, type Rules, type Version } from '@/components/constitution/rules';

export type Loaded = { activeId: string | null; active: Version | null; history: Version[]; pending: Draft | null; state: components['schemas']['FinancialState'] };

export function explainProblem(problem: Problem): string {
  if (problem.code === 'STALE_POLICY') return 'Your active rules changed since this draft was made. Review the current version and start a new draft.';
  if (problem.code === 'VALIDATION_ERROR') return problem.reasons.length ? `These rules were rejected: ${problem.reasons.join('; ')}` : problem.message;
  return problem.message;
}

/**
 * Loads the financial state, every confirmed version and the drafts; saves a draft; confirms a draft with the
 * fingerprint the person saw. Same calls and checks as the original Constitution screen (PF-019).
 */
export function useConstitution() {
  const router = useRouter();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState('');
  const latest = useRef(0);

  const load = useCallback(async (): Promise<Loaded | null> => {
    const request = ++latest.current;
    setLoadError('');
    const [state, history, drafts] = await Promise.all([
      run(() => api.GET('/financial-state')), run(() => api.GET('/constitutions/history')), run(() => api.GET('/constitutions/drafts')),
    ]);
    if (request !== latest.current) return null;
    for (const outcome of [state, history, drafts]) if (!outcome.ok && outcome.expired) { router.replace('/login'); return null; }
    if (!state.ok || !history.ok || !drafts.ok) {
      const failed = [state, history, drafts].find((o) => !o.ok);
      setLoadError(failed && !failed.ok ? failed.problem.message : 'Unable to load your rules.');
      return null;
    }
    const activeId = state.data.active_constitution_version;
    const active = history.data.find((v) => v.id === activeId) ?? null;
    if (activeId && !active) { setLoadError('The active rules are missing from the version history. Nothing can be edited until this is resolved.'); return null; }
    // Only drafts made against the current active version can still be confirmed; older ones are stale.
    const pending = drafts.data.filter((d) => d.base_version === activeId).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
    const next = { activeId, active, history: history.data, pending, state: state.data };
    setLoaded(next);
    return next;
  }, [router]);

  useEffect(() => { void load(); return () => { ++latest.current; }; }, [load]);

  const base = (l: Loaded | null): Rules => l?.active?.rules ?? CONTRACT_DEFAULTS;

  /** Validates and saves a draft. Never activates anything. */
  const saveDraft = useCallback(async (form: FormValues): Promise<{ draft?: Draft; errors?: Partial<Record<keyof FormValues, string>>; problem?: string }> => {
    if (!loaded) return { problem: 'Your rules are still loading.' };
    const parsed = fromForm(form, base(loaded));
    if (!parsed.ok) return { errors: parsed.errors };
    try {
      const headers = await writeHeaders();
      const outcome = await run(() => api.POST('/constitutions/drafts', { body: { base_version: loaded.activeId, rules: parsed.rules }, headers }));
      if (!outcome.ok) {
        if (outcome.expired) { router.replace('/login'); return {}; }
        if (outcome.problem.code === 'STALE_POLICY') await load();
        return { problem: explainProblem(outcome.problem) };
      }
      return { draft: outcome.data };
    } catch { return { problem: 'Your session could not be checked. Sign in again and retry.' }; }
  }, [loaded, load, router]);

  /** Confirms exactly the draft whose fingerprint the person saw. */
  const confirm = useCallback(async (draft: Draft, digest: string): Promise<{ version?: Version; problem?: string; stale?: boolean }> => {
    try {
      const headers = await writeHeaders();
      const outcome = await run(() => api.POST('/constitutions/confirm', { body: { draft_id: draft.id, confirmed: true, expected_policy_digest: digest }, headers }));
      if (!outcome.ok) {
        if (outcome.expired) { router.replace('/login'); return {}; }
        const stale = outcome.problem.code === 'STALE_POLICY';
        if (stale) await load();
        return { problem: explainProblem(outcome.problem), stale };
      }
      await load();
      return { version: outcome.data };
    } catch { return { problem: 'Your session could not be checked. Sign in again and retry.' }; }
  }, [load, router]);

  return { loaded, loadError, load, saveDraft, confirm, base: base(loaded) };
}
