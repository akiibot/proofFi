// ISOLATED loopback chain fixture only. No live node, funded account or live receipt.
// Real executor bytes are recovered/hashed with Ethereum crypto before a simulated receipt is produced.
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';

export const TOKEN = '0x' + '1'.repeat(40);
export const RECIPIENT = '0x' + '2'.repeat(40);
export const WALLET = '0x7564105e977516c53be337314c7e53838967bdac'; // PUBLIC 0x44*32 test key
const python = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
const word = value => BigInt(value).toString(16).padStart(64, '0');
const blockHash = '0x' + 'a'.repeat(64);
const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

export function createFixtureResponse() {
  let accepted = null;
  let sends = 0;
  return request => {
    const { id, method, params = [] } = request;
    let result;
    if (method === 'eth_chainId') result = '0x14a34';
    else if (method === 'eth_blockNumber') result = '0x65';
    else if (method === 'eth_getCode' && params[0]?.toLowerCase() === TOKEN) result = '0x6000';
    else if (method === 'eth_getBalance' && params[0]?.toLowerCase() === WALLET) result = '0x2386f26fc10000';
    else if (method === 'eth_getTransactionCount' && params[0]?.toLowerCase() === WALLET) result = accepted ? '0x1' : '0x0';
    else if (method === 'eth_estimateGas' && params[0]?.to?.toLowerCase() === TOKEN) result = '0xc350';
    else if (method === 'eth_getBlockByNumber') result = { number: params[0] === '0x64' ? '0x64' : '0x65', hash: blockHash, baseFeePerGas: '0x1', timestamp: '0x1' };
    else if (method === 'eth_call' && params[0]?.to?.toLowerCase() === TOKEN) {
      const data = (params[0].data ?? params[0].input ?? '').toLowerCase();
      if (data === '0x313ce567') result = '0x' + word(18);
      else if (data === '0x70a08231' + WALLET.slice(2).padStart(64, '0')) result = '0x' + word(12000n * 10n ** 18n - (accepted ? BigInt('0x' + accepted.data.slice(74)) : 0n));
    } else if (method === 'eth_sendRawTransaction' && typeof params[0] === 'string') {
      sends++;
      const decoded = spawnSync(python, ['apps/web/e2e/chain-crypto.py'], { input: params[0], encoding: 'utf8', env: { ...process.env, PYTHONPATH: 'services/api' } });
      try {
        if (decoded.status !== 0) throw Error();
        const tx = JSON.parse(decoded.stdout);
        if (accepted || tx.sender !== WALLET || tx.to !== TOKEN || tx.chain_id !== 84532 || tx.nonce !== 0 || tx.value !== 0 || tx.access_list.length || tx.data.length !== 138 || tx.data.slice(0, 10) !== '0xa9059cbb' || tx.data.slice(10, 74) !== RECIPIENT.slice(2).padStart(64, '0') || BigInt('0x' + tx.data.slice(74)) <= 0n) throw Error();
        accepted = tx;
        result = tx.hash;
      } catch { return { jsonrpc: '2.0', id, error: { code: -32602, message: 'Invalid isolated fixture transaction; no live fallback' } }; }
    } else if (method === 'eth_getTransactionReceipt' && /^0x[0-9a-f]{64}$/.test(params[0] ?? '')) {
      result = !accepted || accepted.hash !== params[0] ? null : {
        transactionHash: accepted.hash, blockHash, blockNumber: '0x64', transactionIndex: '0x0', status: '0x1',
        from: WALLET, to: TOKEN, gasUsed: '0xc350', cumulativeGasUsed: '0xc350', effectiveGasPrice: '0x2', type: '0x2',
        logs: [{ address: TOKEN, topics: [transferTopic, '0x' + WALLET.slice(2).padStart(64, '0'), '0x' + RECIPIENT.slice(2).padStart(64, '0')], data: '0x' + accepted.data.slice(74), transactionHash: accepted.hash, blockHash, blockNumber: '0x64', transactionIndex: '0x0', logIndex: '0x0', removed: false }],
      };
    } else if (method === 'vallet_fixtureStats') result = { scope: 'isolated fixture only', send_calls: sends, accepted_transactions: accepted ? 1 : 0, transaction_hash: accepted?.hash ?? null };
    return result === undefined
      ? { jsonrpc: '2.0', id, error: { code: -32601, message: 'Unsupported isolated fixture request; no live fallback' } }
      : { jsonrpc: '2.0', id, result };
  };
}
export const fixtureResponse = createFixtureResponse();

export async function startChainFixture() {
  const respond = createFixtureResponse();
  const server = createServer((request, response) => {
    let body = '';
    request.on('data', chunk => { body += chunk; if (body.length > 65536) request.destroy(); });
    request.on('end', () => {
      try {
        const payload = JSON.parse(body);
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify(Array.isArray(payload) ? payload.map(respond) : respond(payload)));
      } catch { response.writeHead(400); response.end(); }
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}
