import { accessGeneration, assertAccess, currentAccess, invalidateAccess, notifyAuthChange } from './access';
import { clearGuestStorage } from './scope-storage';
import { api } from './api';

export async function csrfHeaders() {
  const captured = currentAccess(), generation = accessGeneration();
  if (!captured) throw new Error('Session is being checked.');
  const {data,error} = await api.GET('/auth/session');
  await assertAccess(captured, generation);
  if(error || !data) throw new Error(error?.message ?? 'Session required');
  return {'X-CSRF-Token':data.csrf_token};
}

export async function logout() {
  const headers = await csrfHeaders();
  const previous = currentAccess();
  notifyAuthChange('begin');
  try {
    const response = await fetch('/api/backend/auth/logout', { method: 'POST', headers, cache: 'no-store' });
    if (!response.ok) throw new Error('Unable to sign out');
    clearGuestStorage(previous); invalidateAccess();
  } finally { notifyAuthChange('end'); }
}
