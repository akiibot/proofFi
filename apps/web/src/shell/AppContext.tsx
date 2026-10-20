'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { type SessionAccess } from '@/lib/access';
import { api } from '@/lib/api';
import { run, type Problem } from '@/lib/request';
import { logout } from '@/lib/session';
import type { components } from '@/lib/schema';
import { useVerifiedAccess } from './AccessGate';
import { loadNeedsYou, type NeedsYou } from '@/lib/needs-you';

export type ChainStatus = components['schemas']['ChainStatus'];

type AppState = {
  access: SessionAccess;
  chain: ChainStatus | null;
  chainProblem: Problem | null;
  checkedAt: Date | null;
  needsYou: NeedsYou[];
  refreshChain: () => Promise<void>;
  refreshNeedsYou: () => Promise<void>;
  chainOpen: boolean;
  setChainOpen: (open: boolean) => void;
  signOut: () => Promise<void>;
  signOutError: string;
  /** Set by the account menu; Home starts the tour and clears it. */
  tourPending: boolean;
  requestTour: () => void;
  clearTourPending: () => void;
};

const Context = createContext<AppState | null>(null);

/** Shared, signed-in state that every screen and the top nav read: chain readiness and what needs the person. */
export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const access = useVerifiedAccess();
  const [chain, setChain] = useState<ChainStatus | null>(null);
  const [chainProblem, setChainProblem] = useState<Problem | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [needsYou, setNeedsYou] = useState<NeedsYou[]>([]);
  const [chainOpen, setChainOpen] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const [tourPending, setTourPending] = useState(false);
  const requestTour = useCallback(() => setTourPending(true), []);
  const clearTourPending = useCallback(() => setTourPending(false), []);
  const latest = useRef(0);

  const refreshChain = useCallback(async () => {
    const id = ++latest.current;
    const outcome = await run(() => api.GET('/chain/status'));
    if (id !== latest.current) return;
    if (!outcome.ok) { if (outcome.expired) { router.replace('/login'); return; } setChainProblem(outcome.problem); return; }
    setChain(outcome.data); setChainProblem(null); setCheckedAt(new Date());
  }, [router]);

  const refreshNeedsYou = useCallback(async () => {
    if (!access.capabilities.includes('approve')) { setNeedsYou([]); return; }
    const found = await loadNeedsYou();
    if (found === 'expired') { router.replace('/login'); return; }
    if (found) setNeedsYou(found);
  }, [router, access]);

  useEffect(() => { void refreshChain(); void refreshNeedsYou(); }, [refreshChain, refreshNeedsYou]);

  const signOut = useCallback(async () => {
    setSignOutError('');
    try { await logout(); window.location.replace('/login'); } catch { setSignOutError('Unable to sign out. Please try again.'); }
  }, []);

  const value = useMemo(() => ({ access, chain, chainProblem, checkedAt, needsYou, refreshChain, refreshNeedsYou, chainOpen, setChainOpen, signOut, signOutError, tourPending, requestTour, clearTourPending }),
    [access, chain, chainProblem, checkedAt, needsYou, refreshChain, refreshNeedsYou, chainOpen, signOut, signOutError, tourPending, requestTour, clearTourPending]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useApp(): AppState {
  const value = useContext(Context);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
