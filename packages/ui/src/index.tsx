'use client';
import { useEffect, useState, type ReactNode } from 'react';
export type Theme = 'system' | 'light' | 'dark';
export const THEME_KEY = 'prooffi.theme';

export function ThemeControl() {
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => { const value=localStorage.getItem(THEME_KEY); if(value==='dark'||value==='light') setTheme(value); }, []);
  function change(value: Theme) { setTheme(value); document.documentElement.dataset.theme=value; try { localStorage.setItem(THEME_KEY,value); } catch { /* Appearance still applies for this document. */ } }
  return <label className="theme-control">Appearance<select aria-label="Appearance" value={theme} onChange={e=>change(e.target.value as Theme)}><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select></label>;
}
export function Brand() { return <span className="brand-lockup"><svg width="29" height="31" viewBox="0 0 29 31" fill="none" aria-hidden="true"><path d="M14.5 2 26 7v9c0 6-7 11-11.5 13C10 27 3 22 3 16V7L14.5 2Z" stroke="currentColor" strokeWidth="2.5"/><path d="m9 15 4 4 8-9" stroke="currentColor" strokeWidth="2.5"/></svg><span>ProofFi</span></span>; }
export function Panel({title,children}:{title:string;children:ReactNode}) { return <section className="editor"><h2>{title}</h2>{children}</section>; }
