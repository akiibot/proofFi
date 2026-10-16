'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { components } from '@/lib/schema';

export type FinancialState = components['schemas']['FinancialState'];
export type ChainStatus = components['schemas']['ChainStatus'];

/** One independently loaded piece of the page. `data` is kept from the last success so a failed refresh does not blank the screen. */
export type Slice<T> = { status: 'loading' | 'ready' | 'error'; data?: T; message?: string };

type Settled<T> = { expired: boolean; slice: Slice<T> };

function errorMessage(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string') return error.message;
  return fallback;
}

async function settle<T>(call: () => Promise<{ data?: T; error?: unknown; response: Response }>): Promise<Settled<T>> {
  try {
    const { data, error, response } = await call();
    if (response.status === 401) return { expired: true, slice: { status: 'error', message: 'Your session expired.' } };
    if (error !== undefined || data === undefined) return { expired: false, slice: { status: 'error', message: errorMessage(error, 'The backend is unavailable.') } };
    return { expired: false, slice: { status: 'ready', data } };
  } catch (cause) {
    return { expired: false, slice: { status: 'error', message: errorMessage(cause, 'Unable to reach the backend.') } };
  }
}

/** Loads GET /financial-state and GET /chain/status in parallel. A 401 from either calls `onExpired` (the page sends the user to /login). */
export function useDashboardData(onExpired: () => void) {
  const [state, setState] = useState<Slice<FinancialState>>({ status: 'loading' });
  const [chain, setChain] = useState<Slice<ChainStatus>>({ status: 'loading' });
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const latest = useRef(0);
  const expired = useRef(onExpired);
  useEffect(() => { expired.current = onExpired; }, [onExpired]);

  const load = useCallback(async () => {
    const run = ++latest.current;
    setState((previous) => ({ status: 'loading', data: previous.data }));
    setChain((previous) => ({ status: 'loading', data: previous.data }));
    const [financial, chainResult] = await Promise.all([settle(() => api.GET('/financial-state')), settle(() => api.GET('/chain/status'))]);
    if (run !== latest.current) return; // a newer refresh superseded this one
    if (financial.expired || chainResult.expired) { expired.current(); return; }
    setState((previous) => ({ ...financial.slice, data: financial.slice.data ?? previous.data }));
    setChain((previous) => ({ ...chainResult.slice, data: chainResult.slice.data ?? previous.data }));
    if (financial.slice.status === 'ready' || chainResult.slice.status === 'ready') setUpdatedAt(new Date());
  }, []);

  useEffect(() => { void load(); }, [load]);
  const loading = state.status === 'loading' || chain.status === 'loading';
  return { state, chain, updatedAt, loading, refresh: load };
}
