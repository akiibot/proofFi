import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { test, expect } from '@playwright/test';
import { captureActualResponses, type CapturedResponse } from './actual-response-capture';

test('PF-035 actual response bytes and headers survive retirement of the browser handle', async ({ page }) => {
  const text = '<!doctype html><p>PUBLIC-CAPTURE-CANARY: tuition €</p>';
  const server = createServer((_request, response) => {
    response.writeHead(409, { 'Content-Type': 'text/html; charset=utf-8', 'X-Capture-Control': 'PUBLIC-HEADER-CANARY' });
    response.end(text);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const bodies: CapturedResponse[] = [];
    const drain = await captureActualResponses(page, bodies);
    const response = await page.goto(`http://127.0.0.1:${(server.address() as AddressInfo).port}/actual`);
    expect(response?.status()).toBe(409);
    await expect(page.locator('p')).toHaveText('PUBLIC-CAPTURE-CANARY: tuition €');
    await drain();
    await page.close();
    // The prior CDP reader cannot recover after browser target retirement.
    await expect(response!.text()).rejects.toThrow();
    // Capture still has the actual delivered body, including a detectable canary.
    expect(bodies).toHaveLength(1);
    expect(bodies[0].body).toContain(text);
    expect(bodies[0].body).toContain('PUBLIC-HEADER-CANARY');
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('PF-035 actual forwarding preserves POST, redirect, cookie and error response without retries', async ({ page }) => {
  const requests: { method: string; url: string; body: string }[] = [];
  const server = createServer(async (request, response) => {
    let body = '';
    for await (const chunk of request) body += chunk;
    requests.push({ method: request.method!, url: request.url!, body });
    if (request.url === '/form') {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<form method="post" action="/submit"><input name="intent" value="public-control"><button>Send</button></form>');
    } else if (request.url === '/submit') {
      response.writeHead(303, { Location: '/destination', 'Set-Cookie': 'capture=public-control; HttpOnly; SameSite=Strict; Path=/' });
      response.end('actual redirect body');
    } else {
      response.writeHead(503, { 'Content-Type': 'text/html', 'X-Observed-Cookie': request.headers.cookie ?? '' });
      response.end('<p>actual upstream refusal</p>');
    }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const bodies: CapturedResponse[] = [];
    const drain = await captureActualResponses(page, bodies);
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    // A real browser form, not APIRequestContext: exercise original POST/redirect semantics.
    await page.goto(base + '/form');
    await Promise.all([page.waitForURL(base + '/destination'), page.getByRole('button', { name: 'Send' }).click()]);
    await expect(page.locator('p')).toHaveText('actual upstream refusal');
    expect(requests).toEqual([
      { method: 'GET', url: '/form', body: '' },
      { method: 'POST', url: '/submit', body: 'intent=public-control' },
      { method: 'GET', url: '/destination', body: '' },
    ]);
    await drain();
    expect(bodies.map(r => r.url)).toEqual(['/form', '/submit', '/destination']);
    expect(bodies[1].body).toContain('/destination');
    expect(bodies[2].body).toContain('actual upstream refusal');
    expect(bodies[2].body).toContain('capture=public-control');
    expect((await page.context().cookies()).find(c => c.name === 'capture')).toMatchObject({ httpOnly: true, sameSite: 'Strict' });
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('PF-035 a response-body read failure is rethrown at the scan boundary', async ({ page }) => {
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'text/html' });
    response.end('<p>actual response remains available to the browser</p>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const context = page.context();
  const originalSession = context.newCDPSession.bind(context);
  context.newCDPSession = async target => {
    const session = await originalSession(target);
    const originalSend = session.send.bind(session);
    session.send = async (method, params) => {
      // Isolated failure injection only; the HTTP response is still actual.
      if (method === 'Fetch.getResponseBody') throw new Error('isolated CDP body-read failure');
      return originalSend(method, params);
    };
    return session;
  };
  try {
    const drain = await captureActualResponses(page, []);
    await page.goto(`http://127.0.0.1:${(server.address() as AddressInfo).port}/actual`);
    await expect(page.locator('p')).toHaveText('actual response remains available to the browser');
    await expect(drain()).rejects.toThrow('isolated CDP body-read failure');
  } finally {
    context.newCDPSession = originalSession;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
