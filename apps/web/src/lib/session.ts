import { api } from './api';

export async function csrfHeaders() {
  const {data,error} = await api.GET('/auth/session');
  if(error || !data) throw new Error(error?.message ?? 'Session required');
  return {'X-CSRF-Token':data.csrf_token};
}

export async function logout() {
  const headers = await csrfHeaders();
  const {error} = await api.POST('/auth/logout',{headers});
  if(error) throw new Error(error.message);
}
