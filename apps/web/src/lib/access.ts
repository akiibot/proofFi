import type { components } from './schema';

export type SessionAccess = components['schemas']['SessionAccess'];
let active: SessionAccess | null = null;
let generation = 0;
let pending: { generation: number; promise: Promise<SessionAccess> } | null = null;
let channel: BroadcastChannel | null = null;
let switchingId: string | null = null;
let guestQueue: Promise<unknown> = Promise.resolve();
const SIGNAL = 'vallet.auth-change';
export const ACCESS_EVENT = 'vallet:access-invalid';
export const AUTH_EVENT = 'vallet:auth-change';
export class SessionUnavailable extends Error { constructor(public status: number, message: string) { super(message); } }
export const currentAccess = () => active;
export const accessGeneration = () => generation;
export const accessIdentity = (a: SessionAccess) => JSON.stringify([a.mode, a.scope_id, a.expires_at, a.capabilities, a.execution_enabled]);

export function invalidateAccess(): void {
  active = null; generation++; guestQueue = Promise.resolve();
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(ACCESS_EVENT));
}

/** Read fresh server authority; notification/storage payloads never provide access. */
export function loadAccess(): Promise<SessionAccess> {
  if (!pending || pending.generation !== generation) {
    const request = fetch('/api/backend/auth/access', { cache: 'no-store', credentials: 'same-origin', signal: AbortSignal.timeout(15000) }).then(async response => {
    if (!response.ok) {
      throw new SessionUnavailable(response.status, response.status === 401 ? 'Your session expired. Sign in or launch a new demo.' : 'Session unavailable. Try again.');
    }
    const a: SessionAccess = await response.json();
    if (!['operator', 'judge'].includes(a.mode) || !Array.isArray(a.capabilities) || !Number.isFinite(Date.parse(a.expires_at)) ||
        Date.parse(a.expires_at) <= Date.now() || (a.mode === 'judge' && (!/^judge-[a-f0-9]{32}$/.test(a.scope_id ?? '') || a.execution_enabled !== false))) throw new Error('Session unavailable. Try again.');
    return a;
  }).finally(() => { if (pending?.promise === request) pending = null; });
    pending = { generation, promise: request };
  }
  return pending.promise;
}

export function activateAccess(a: SessionAccess): void { active = a; }

/** Check after JSON/body consumption too, before a caller publishes data or uses CSRF. */
export async function assertAccess(captured: SessionAccess, id: number): Promise<void> {
  try {
    const fresh = await loadAccess();
    if (id !== generation || !active || accessIdentity(fresh) !== accessIdentity(captured)) throw new Error('Session changed.');
  } catch (error) {
    if (id === generation) invalidateAccess();
    throw error;
  }
}

/** Local generation admission here; fresh server checks follow parsed responses and CSRF retrieval. */
export async function scopedFetch(request: Request): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path.endsWith('/auth/login') || path.endsWith('/auth/judge')) return fetch(request);
  const captured = active;
  const id = generation;
  if (!captured) throw new Error('Session is being checked.');
  const perform = async () => {
    if (id !== generation || !active) throw new Error('Session changed.');
    const response = await fetch(request);
    if (captured.mode !== 'judge') return response;
    // Release guest admission only after the bounded response has been consumed.
    const body = await response.arrayBuffer();
    return new Response(body, { status: response.status, statusText: response.statusText, headers: response.headers });
  };
  if (captured.mode !== 'judge') return perform();
  const result = guestQueue.then(perform, perform);
  guestQueue = result.catch(() => undefined);
  return result;
}

function getChannel() {
  if (!channel && typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(SIGNAL);
      channel.onmessage = event => {
        window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: event.data }));
      };
    } catch { /* storage event may still be available */ }
  }
  return channel;
}

export function notificationsAvailable(): boolean {
  let storage = false;
  try { localStorage.setItem(`${SIGNAL}.probe`, '1'); localStorage.removeItem(`${SIGNAL}.probe`); storage = true; } catch { /* fail closed if both transports are unavailable */ }
  return Boolean(getChannel()) || storage;
}

export function notifyAuthChange(phase: 'begin' | 'end'): void {
  if (!notificationsAvailable()) throw new Error('Enable browser storage or cross-tab notifications to switch sessions safely.');
  if (phase === 'begin') switchingId = crypto.randomUUID();
  const signal = { phase, id: switchingId ?? crypto.randomUUID() };
  if (phase === 'end') switchingId = null;
  getChannel()?.postMessage(signal);
  try { localStorage.setItem(SIGNAL, JSON.stringify(signal)); } catch { /* BroadcastChannel is the other transport */ }
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: signal }));
}

export function listenAuthChange(listener: (phase: 'begin' | 'end') => void): () => void {
  getChannel();
  const inflight = new Set<string>(), completed = new Set<string>();
  const receive = (value: unknown) => {
    if (!value || typeof value !== 'object') return;
    const { phase, id } = value as { phase?: unknown; id?: unknown };
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id) || !['begin', 'end'].includes(String(phase)) || completed.has(id)) return;
    if (phase === 'begin') { if (inflight.has(id)) return; inflight.add(id); }
    else { inflight.delete(id); completed.add(id); if (completed.size > 128) completed.delete(completed.values().next().value!); }
    listener(inflight.size ? 'begin' : 'end');
  };
  const local = (event: Event) => receive((event as CustomEvent).detail);
  const stored = (event: StorageEvent) => {
    if (event.key !== SIGNAL || !event.newValue) return;
    try { receive(JSON.parse(event.newValue)); } catch { /* malformed notification grants nothing */ }
  };
  window.addEventListener(AUTH_EVENT, local); window.addEventListener('storage', stored);
  return () => { window.removeEventListener(AUTH_EVENT, local); window.removeEventListener('storage', stored); };
}
