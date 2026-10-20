import { currentAccess, type SessionAccess } from './access';

export function scopeStorageKey(originalKey: string, access: SessionAccess | null = currentAccess()): string {
  if (!access) throw new Error('Session must be checked before reading browser records.');
  if (access.mode === 'operator') return originalKey;
  if (!/^judge-[a-f0-9]{32}$/.test(access.scope_id ?? '')) throw new Error('Guest scope unavailable.');
  return `vallet.judge.${access.scope_id}.${originalKey}`;
}

/** Remove only the departing guest's caches; preserve all operator recovery identities. */
export function clearGuestStorage(access: SessionAccess | null): void {
  if (access?.mode !== 'judge' || !access.scope_id) return;
  const prefix = `vallet.judge.${access.scope_id}.`;
  for (const name of ['sessionStorage', 'localStorage'] as const) try {
    const storage = window[name];
    for (let i = storage.length - 1; i >= 0; i--) { const key = storage.key(i); if (key?.startsWith(prefix)) storage.removeItem(key); }
  } catch { /* no readable guest cache remains available */ }
}
