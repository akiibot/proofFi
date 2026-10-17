// ISOLATED BROWSER TEST DATA ONLY. No wallet, deployed contract or live receipt.
// Read-only JSON-RPC fixture for the production optimizer adapter; signing/send
// methods are rejected. The $12,000 synthetic balance does not repair the $200
// baseline planning shortfall or constitute an approved financial configuration.
import { createServer } from 'node:http';

export const TOKEN = '0x' + '1'.repeat(40);
export const RECIPIENT = '0x' + '2'.repeat(40);
export const WALLET = '0x' + '3'.repeat(40);
const word = value => BigInt(value).toString(16).padStart(64, '0');
export function fixtureResponse(request) {
  const { id, method, params = [] } = request;
  let result;
  if (method === 'eth_chainId') result = '0x14a34';
  else if (method === 'eth_blockNumber') result = '0x1';
  else if (method === 'eth_getCode' && params[0]?.toLowerCase() === TOKEN) result = '0x6000';
  else if (method === 'eth_getBalance' && params[0]?.toLowerCase() === WALLET) result = '0x2386f26fc10000';
  else if (method === 'eth_getBlockByNumber' && params[0] === '0x1') {
    result = { number: '0x1', hash: '0x' + 'a'.repeat(64), baseFeePerGas: '0x1', timestamp: '0x1' };
  } else if (method === 'eth_call' && params[0]?.to?.toLowerCase() === TOKEN) {
    const data = (params[0].data ?? params[0].input ?? '').toLowerCase();
    if (data === '0x313ce567') result = '0x' + word(18);
    else if (data === '0x70a08231' + WALLET.slice(2).padStart(64, '0')) result = '0x' + word(12000n * 10n ** 18n);
  }
  return result === undefined
    ? { jsonrpc: '2.0', id, error: { code: -32601, message: 'Unsupported isolated read-only fixture request' } }
    : { jsonrpc: '2.0', id, result };
}

export async function startChainFixture() {
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += chunk; if (body.length > 65536) request.destroy(); });
    request.on('end', () => {
      try {
        const payload = JSON.parse(body);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(Array.isArray(payload) ? payload.map(fixtureResponse) : fixtureResponse(payload)));
      } catch { response.writeHead(400); response.end(); }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}
