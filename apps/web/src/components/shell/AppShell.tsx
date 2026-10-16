'use client';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { logout } from '@/lib/session';
import { NAV } from './nav';

type Props = { children: ReactNode; current: string };

/** Shared frame for every signed-in screen: brand, sign out, the screen list and the footer. */
export function AppShell({ children, current }: Props) {
  const router = useRouter();
  const [signOutError, setSignOutError] = useState('');
  async function signOut() {
    setSignOutError('');
    try { await logout(); router.replace('/login'); } catch { setSignOutError('Unable to sign out. Please try again.'); }
  }
  return <div className="shell">
    <header className="shell-header">
      <a className="brand" href="/">ProofFi<span> / financial control</span></a>
      <button type="button" onClick={signOut}>Sign out</button>
    </header>
    <nav className="shell-nav" aria-label="Screens">
      <ul>
        {NAV.map((item) => <li key={item.label}>
          {item.ready
            ? <a href={item.href} aria-current={item.href === current ? 'page' : undefined}>{item.label}</a>
            : <span title={`Not built yet (${item.issue})`}>{item.label}<small> soon</small></span>}
        </li>)}
      </ul>
    </nav>
    {signOutError && <p role="alert" className="notice">{signOutError}</p>}
    <main id="main">{children}</main>
    <footer className="shell-footer">ProofFi separates financial intelligence from financial authority.<span>Testnet demo · synthetic USD</span></footer>
  </div>;
}
