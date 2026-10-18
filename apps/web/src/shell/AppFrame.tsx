'use client';
import type { ReactNode } from 'react';
import { AppProvider } from './AppContext';
import { ChainDrawer } from './ChainDrawer';
import { TopNav } from './TopNav';
import styles from './shell.module.css';

/** Signed-in frame shared by every screen in the (app) route group, so the nav and its sliding pill persist. */
export function AppFrame({ children }: { children: ReactNode }) {
  return <AppProvider>
    <a href="#main" className={styles.skip}>Skip to content</a>
    <TopNav />
    <main id="main" className={styles.main}>{children}</main>
    <ChainDrawer />
  </AppProvider>;
}

/** The centred content column. Figma uses 1040 (Home), 880 and 760 (reading screens). */
export function Page({ width = 1040, children, className }: { width?: 1040 | 880 | 760 | 720; children: ReactNode; className?: string }) {
  return <div className={[styles.page, className].filter(Boolean).join(' ')} style={{ maxWidth: width }}>{children}</div>;
}
