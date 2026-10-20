'use client';
import type { ReactNode } from 'react';
import { AccessGate } from './AccessGate';
import { AppProvider, useApp } from './AppContext';
import { ChainDrawer } from './ChainDrawer';
import { TopNav } from './TopNav';
import styles from './shell.module.css';

/** Signed-in frame shared by every screen in the (app) route group, so the nav and its sliding pill persist. */
export function AppFrame({ children }: { children: ReactNode }) {
  return <AccessGate><AppProvider>
    <a href="#main" className={styles.skip}>Skip to content</a>
    <TopNav />
    <DemoBanner />
    <main id="main" className={styles.main}>{children}</main>
    <ChainDrawer />
  </AppProvider></AccessGate>;
}

/** The centred content column. Figma uses 1040 (Home), 880 and 760 (reading screens). */
export function Page({ width = 1040, children, className }: { width?: 1040 | 880 | 760 | 720 | 680; children: ReactNode; className?: string }) {
  return <div className={[styles.page, className].filter(Boolean).join(' ')} style={{ maxWidth: width }}>{children}</div>;
}

function DemoBanner() {
  const { access } = useApp();
  return access.mode === "judge" ? <aside role="note" className={styles.judgeBanner}><strong>Judge demo</strong><span>Sending disabled</span><span>Synthetic data · disposable 30-minute session</span></aside> : null;
}
