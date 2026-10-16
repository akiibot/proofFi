import type { ReactNode } from 'react';
import { NAV } from './nav';

type Props = { children: ReactNode; onSignOut: () => void; signOutError?: string };

export function AppShell({ children, onSignOut, signOutError }: Props) {
  return <div className="shell">
    <header className="shell-header">
      <a className="brand" href="/">ProofFi<span> / financial control</span></a>
      <button type="button" onClick={onSignOut}>Sign out</button>
    </header>
    <nav className="shell-nav" aria-label="Screens">
      <ul>
        {NAV.map((item) => <li key={item.label}>
          {item.ready
            ? <a href={item.href} aria-current={item.href === '/' ? 'page' : undefined}>{item.label}</a>
            : <span title={`Not built yet (${item.issue})`}>{item.label}<small> soon</small></span>}
        </li>)}
      </ul>
    </nav>
    {signOutError && <p role="alert" className="notice">{signOutError}</p>}
    <main id="main">{children}</main>
    <footer className="shell-footer">ProofFi separates financial intelligence from financial authority.<span>Testnet demo · synthetic USD</span></footer>
  </div>;
}
