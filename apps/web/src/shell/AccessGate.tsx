'use client';
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ACCESS_EVENT, SessionUnavailable, accessIdentity, activateAccess, invalidateAccess, listenAuthChange, loadAccess, notificationsAvailable, type SessionAccess } from '@/lib/access';
import { clearGuestStorage } from '@/lib/scope-storage';
import { Button } from '@/ui/Button';

const VerifiedAccess = createContext<SessionAccess | null>(null);
export function useVerifiedAccess(): SessionAccess {
  const access = useContext(VerifiedAccess);
  if (!access) throw new Error('Verified session context required');
  return access;
}

/** Hide synchronously before page snapshots; remount financial hooks only after server revalidation. */
export function AccessGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState<{ access: SessionAccess; generation: number } | null>(null);
  const [error, setError] = useState('');
  const content = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let disposed = false, held = false, suspended = false, revision = 0;
    let previous: SessionAccess | null = null;
    const hide = () => { document.documentElement.dataset.sessionBlocked = 'true'; if (content.current) content.current.hidden = true; setReady(null); revision++; };
    const block = () => { invalidateAccess(); };
    const verify = async () => {
      const id = revision;
      if (held || suspended || document.visibilityState === 'hidden' || !document.hasFocus()) return;
      try {
        if (!notificationsAvailable()) throw new Error('Enable browser storage or cross-tab notifications to use this session safely.');
        const access = await loadAccess();
        if (disposed || held || suspended || id !== revision || document.hidden || !document.hasFocus()) return;
        if (previous && accessIdentity(previous) !== accessIdentity(access)) clearGuestStorage(previous);
        previous = access; activateAccess(access); setError(''); setReady({ access, generation: id });
      } catch (e) {
        if (!disposed && id === revision) {
          if (e instanceof SessionUnavailable && e.status === 401) { clearGuestStorage(previous); window.location.replace('/login'); }
          setError(e instanceof Error ? e.message : 'Session unavailable.');
        }
      }
    };
    // Invalidation never grants authority; a fresh read must follow it.
    const invalid = () => { hide(); if (!held) void verify(); };
    const leave = () => { suspended = true; block(); };
    const resume = () => { suspended = false; block(); };
    const visible = () => { if (document.visibilityState === 'hidden') leave(); else resume(); };
    const stop = listenAuthChange(phase => { held = phase === 'begin'; block(); });
    window.addEventListener(ACCESS_EVENT, invalid);
    window.addEventListener('pagehide', leave); window.addEventListener('pageshow', resume); window.addEventListener('focus', resume); window.addEventListener('blur', leave);
    document.addEventListener('visibilitychange', visible);
    void verify();
    return () => {
      disposed = true; stop();
      window.removeEventListener(ACCESS_EVENT, invalid); window.removeEventListener('pagehide', leave); window.removeEventListener('pageshow', resume); window.removeEventListener('focus', resume); window.removeEventListener('blur', leave);
      document.removeEventListener('visibilitychange', visible);
    };
  }, []);
  useLayoutEffect(() => {
    document.documentElement.dataset.sessionBlocked = ready ? 'false' : 'true';
  }, [ready]);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(invalidateAccess, Math.max(0, Date.parse(ready.access.expires_at) - Date.now()));
    return () => window.clearTimeout(timer);
  }, [ready]);
  if (!ready) return <main style={{ maxWidth: 600, margin: '15vh auto', padding: 24 }} aria-live="polite">
    <p role="status">{error || 'Checking your session…'}</p>
    {error && <Button href="/login">Sign in or launch demo</Button>}
    <Button onClick={() => window.location.reload()}>Check session again</Button>
  </main>;
  return <VerifiedAccess.Provider value={ready.access}><div ref={content} key={ready.generation} data-access-mode={ready.access.mode}>{children}</div></VerifiedAccess.Provider>;
}
