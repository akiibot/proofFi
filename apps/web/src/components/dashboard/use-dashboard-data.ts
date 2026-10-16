'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { run, toSlice, type Slice } from '@/lib/request';
import type { components } from '@/lib/schema';

export type FinancialState = components['schemas']['FinancialState'];
export type ChainStatus = components['schemas']['ChainStatus'];
export type { Slice };

/** Loads GET /financial-state and GET /chain/status in parallel. A 401 from either calls `onExpired` (the page sends the user to /login). */
export function useDashboardData(onExpired: () => void) {
  const [state, setState] = useState<Slice<FinancialState>>({ status: 'loading' });
  const [chain, setChain] = useState<Slice<ChainStatus>>({ status: 'loading' });
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const latest = useRef(0);
  const expired = useRef(onExpired);
  useEffect(() => { expired.current = onExpired; }, [onExpired]);

  const load = useCallback(async () => {
    const id = ++latest.current;
    setState((previous) => ({ status: 'loading', data: previous.data }));
    setChain((previous) => ({ status: 'loading', data: previous.data }));
    const [financial, chainResult] = await Promise.all([run(() => api.GET('/financial-state')), run(() => api.GET('/chain/status'))]);
    if (id !== latest.current) return; // a newer refresh superseded this one
    if ((!financial.ok && financial.expired) || (!chainResult.ok && chainResult.expired)) { expired.current(); return; }
    setState((previous) => toSlice(financial, previous.data));
    setChain((previous) => toSlice(chainResult, previous.data));
    if (financial.ok || chainResult.ok) setUpdatedAt(new Date());
  }, []);

  useEffect(() => { void load(); }, [load]);
  const loading = state.status === 'loading' || chain.status === 'loading';
  return { state, chain, updatedAt, loading, refresh: load };
}
