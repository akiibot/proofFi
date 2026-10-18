import { request, type FullConfig } from '@playwright/test';

export default async function ready(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (typeof baseURL !== 'string') throw new Error('Browser base URL is required');
  const client = await request.newContext({ baseURL });
  try {
    const response = await client.get('/api/backend/health');
    if (!response.ok()) throw new Error(`Proxy/API startup health check failed: HTTP ${response.status()}`);
    const health = await response.json();
    if (health.status !== 'ok') throw new Error('Proxy/API startup health response is invalid');
  } finally { await client.dispose(); }
}
