import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fixtureResponse, TOKEN, WALLET } from './chain-fixture.mjs';

test('isolated chain fixture rejects signing, broadcasting and fabricated receipts', () => {
  for (const method of ['eth_sendRawTransaction', 'eth_sendTransaction', 'eth_sign', 'eth_getTransactionReceipt']) {
    assert.equal(fixtureResponse({ id: 1, method, params: [] }).error.code, -32601);
  }
});
test('isolated fixture preserves baseline units and binds reads to test addresses', () => {
  const response = fixtureResponse({ id: 2, method: 'eth_call', params: [{ to: TOKEN, data: '0x70a08231' + WALLET.slice(2).padStart(64, '0') }, '0x1'] });
  assert.equal(BigInt(response.result), 12000n * 10n ** 18n);
  assert.equal(fixtureResponse({ id: 3, method: 'eth_call', params: [{ to: WALLET, data: '0x313ce567' }] }).error.code, -32601);
});
