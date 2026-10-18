import type { Page } from '@playwright/test';

export type CapturedResponse = { url: string; body: string };

// AT-12 only: read each actual browser-network response while Chromium holds it
// at the response stage, before login/document replacement can retire its handle.
// Continue the original response untouched: no substitute HTTP client or fulfill.
export async function captureActualResponses(page: Page, bodies: CapturedResponse[]) {
  const session = await page.context().newCDPSession(page);
  const pending: Promise<void>[] = [];
  let failure: unknown;
  session.on('Fetch.requestPaused', event => {
    const work = (async () => {
      try {
        if (!['Document', 'Script', 'Fetch', 'XHR', 'Stylesheet'].includes(event.resourceType)) return;
        if (event.responseErrorReason) throw new Error('Actual response unavailable: ' + event.responseErrorReason);
        const metadata = JSON.stringify({ url: event.request.url, headers: event.responseHeaders });
        const status = event.responseStatusCode!;
        // Chromium explicitly provides no redirect body. Headers/Location remain scanned.
        let body = '';
        if (status < 300 || status >= 400) {
          const response = await session.send('Fetch.getResponseBody', { requestId: event.requestId });
          body = response.base64Encoded ? Buffer.from(response.body, 'base64').toString('utf8') : response.body;
        }
        bodies.push({ url: new URL(event.request.url).pathname, body: body + metadata });
      } finally {
        await session.send('Fetch.continueResponse', { requestId: event.requestId });
      }
    })();
    // Retain every failure and rethrow at the document boundary; never ignore an
    // unread response or abort the test through an unowned event-handler promise.
    pending.push(work.catch(error => { failure ??= error; }));
  });
  await session.send('Network.setCacheDisabled', { cacheDisabled: true });
  await session.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Response' }] });
  return async () => {
    await Promise.all(pending);
    if (failure) throw failure;
  };
}
