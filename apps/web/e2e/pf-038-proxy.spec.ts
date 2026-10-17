import { test, expect } from '@playwright/test';
import { NextRequest } from 'next/server';
import { GET, POST } from '../app/api/backend/[...path]/route';

// Isolated upstream transport; exercise the actual proxy and its real abort signal.
for (const route of ['intent/parse', 'plans/generate']) {
  test(`PF-038 ${route} forwards a planner reply beyond the old ten-second limit`, async () => {
    const originalFetch = globalThis.fetch;
    const payload = route === 'intent/parse'
      ? { objective: 'maximize_investment_subject_to_policies', obligation_id: null, ambiguities: ['Synthetic delayed reply'] }
      : { mode: 'live_llm', candidates: [], clarification: ['Synthetic delayed reply'] };
    globalThis.fetch = async (_input, init) => new Promise<Response>((resolve, reject) => {
      const signal = init?.signal;
      if (!signal) throw new Error('Upstream request must be bounded');
      const timer = setTimeout(() => resolve(Response.json(payload)), 11000);
      signal.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(signal.reason);
      }, { once: true });
    });
    try {
      const response = await POST(new NextRequest(`http://localhost/api/backend/${route}`, {
        method: 'POST', body: JSON.stringify({ goal: 'Protect tuition' }),
      }), { params: Promise.resolve({ path: route.split('/') }) });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual(payload);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
}

test('PF-038 ordinary read and execution proxy budgets remain ten seconds', async () => {
  const originalFetch = globalThis.fetch;
  const originalTimeout = AbortSignal.timeout;
  const budgets: number[] = [];
  AbortSignal.timeout = milliseconds => {
    budgets.push(milliseconds);
    return originalTimeout.call(AbortSignal, milliseconds);
  };
  globalThis.fetch = async () => Response.json({ probe: 'isolated upstream' });
  try {
    await GET(new NextRequest('http://localhost/api/backend/financial-state'), {
      params: Promise.resolve({ path: ['financial-state'] }),
    });
    await POST(new NextRequest('http://localhost/api/backend/execute', { method: 'POST', body: '{}' }), {
      params: Promise.resolve({ path: ['execute'] }),
    });
    expect(budgets).toEqual([10000, 10000]);
  } finally {
    globalThis.fetch = originalFetch;
    AbortSignal.timeout = originalTimeout;
  }
});
