'use client';
import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { logout } from '@/lib/session';
import { AppShell } from '@/components/shell/AppShell';
import { StateNotice } from '@/components/dashboard/StateNotice';
import { Overview } from '@/components/dashboard/Overview';
import { ChainPanel } from '@/components/dashboard/ChainPanel';
import { useDashboardData } from '@/components/dashboard/use-dashboard-data';

export default function Home() {
  const router = useRouter();
  const [signOutError, setSignOutError] = useState('');
  const toLogin = useCallback(() => router.replace('/login'), [router]);
  const { state, chain, updatedAt, loading, refresh } = useDashboardData(toLogin);

  async function signOut() {
    setSignOutError('');
    try { await logout(); router.replace('/login'); } catch { setSignOutError('Unable to sign out. Please try again.'); }
  }

  return <AppShell onSignOut={signOut} signOutError={signOutError}>
    <section className="intro">
      <p className="eyebrow">INTELLIGENCE PROPOSES. YOU DEFINE AUTHORITY.</p>
      <h1>Your goals.<br /><span>Your boundaries.</span></h1>
      <p>A shared foundation for independently verified financial actions.</p>
    </section>

    <div className="toolbar">
      <div>
        <h2>Financial overview</h2>
        <p>Persisted demo state · synthetic USD · no real purchasing power{updatedAt && <> · <span aria-live="polite">Updated {updatedAt.toLocaleTimeString('en-GB')}</span></>}</p>
      </div>
      <button type="button" onClick={refresh} disabled={loading}>{loading ? 'Loading…' : 'Refresh state'}</button>
    </div>

    <StateNotice label="financial state" status={state.status} message={state.message} hasData={Boolean(state.data)} onRetry={refresh} />
    {state.data && <Overview state={state.data} />}

    <StateNotice label="chain status" status={chain.status} message={chain.message} hasData={Boolean(chain.data)} onRetry={refresh} />
    {chain.data && <ChainPanel chain={chain.data} />}
  </AppShell>;
}
