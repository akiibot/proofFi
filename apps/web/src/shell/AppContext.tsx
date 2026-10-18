'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { run, type Problem } from '@/lib/request';
import { logout } from '@/lib/session';
import type { components } from '@/lib/schema';
import { loadNeedsYou, type NeedsYou } from '@/lib/needs-you';

export type ChainStatus = components['schemas']['ChainStatus'];

type AppState = {
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
};

const Context = createContext<AppState | null>(null);

/** Shared, signed-in state that every screen and the top nav read: chain readiness and what needs the person. */
export function AppProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [chain, setChain] = useState<ChainStatus | null>(null);
  const [chainProblem, setChainProblem] = useState<Problem | null>(null);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [needsYou, setNeedsYou] = useState<NeedsYou[]>([]);
  const [chainOpen, setChainOpen] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const latest = useRef(0);

  const refreshChain = useCallback(async () => {
    const id = ++latest.current;
    const outcome = await run(() => api.GET('/chain/status'));
    if (id !== latest.current) return;
    if (!outcome.ok) { if (outcome.expired) { router.replace('/login'); return; } setChainProblem(outcome.problem); return; }
    setChain(outcome.data); setChainProblem(null); setCheckedAt(new Date());
  }, [router]);

  const refreshNeedsYou = useCallback(async () => {
    const found = await loadNeedsYou();
    if (found === 'expired') { router.replace('/login'); return; }
    if (found) setNeedsYou(found);
  }, [router]);

  useEffect(() => { void refreshChain(); void refreshNeedsYou(); }, [refreshChain, refreshNeedsYou]);

  const signOut = useCallback(async () => {
    setSignOutError('');
    try { await logout(); router.replace('/login'); } catch { setSignOutError('Unable to sign out. Please try again.'); }
  }, [router]);

  const value = useMemo(() => ({ chain, chainProblem, checkedAt, needsYou, refreshChain, refreshNeedsYou, chainOpen, setChainOpen, signOut, signOutError }),
    [chain, chainProblem, checkedAt, needsYou, refreshChain, refreshNeedsYou, chainOpen, signOut, signOutError]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useApp(): AppState {
  const value = useContext(Context);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}
