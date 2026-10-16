'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from './api';
import { run } from './request';
import type { components } from './schema';

export type ActivePolicy = {
  state: components['schemas']['FinancialState'];
  active: components['schemas']['ConstitutionVersion'] | null;
};

/** Loads the current financial state and, if one is active, the confirmed Constitution it points to. 401 goes to /login. */
export function useActivePolicy() {
  const router = useRouter();
  const [value, setValue] = useState<ActivePolicy | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    const [state, history] = await Promise.all([run(() => api.GET('/financial-state')), run(() => api.GET('/constitutions/history'))]);
    if ((!state.ok && state.expired) || (!history.ok && history.expired)) { router.replace('/login'); return; }
    if (!state.ok) { setError(state.problem.message); return; }
    if (!history.ok) { setError(history.problem.message); return; }
    const id = state.data.active_constitution_version;
    const active = history.data.find((v) => v.id === id) ?? null;
    if (id && !active) { setError('The active Constitution is missing from the version history.'); return; }
    setValue({ state: state.data, active });
  }, [router]);
  useEffect(() => { void load(); }, [load]);
  return { policy: value, error, reload: load };
}
