// Browser tests run against a fresh, separately seeded SQLite database so that journeys which write
// (confirm a Constitution, record approvals) never touch the developer's local prooffi.db, and every
// run starts from the same seed. Same backend, migrations and seed as `npm run dev`; only DATABASE_URL differs.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startChainFixture, TOKEN, RECIPIENT, WALLET } from './chain-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(root);
const python = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
mkdirSync('.local', { recursive: true });
const database = '.local/e2e.db';
for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(database + suffix, { force: true });

// Public test-only keys/password, an exact loopback RPC and a throwaway database.
// Never fall back to the developer's signer, provider or login credential.
const credentials = JSON.parse(readFileSync('apps/web/e2e/test-credentials.json', 'utf8'));
const prepared = spawnSync(python, ['apps/web/e2e/chain-crypto.py', 'runtime'], { encoding: 'utf8', env: { ...process.env, PYTHONPATH: 'services/api' } });
if (prepared.status !== 0) throw new Error('Isolated crypto setup failed');
const runtime = JSON.parse(prepared.stdout);
if (runtime.wallet !== WALLET) throw new Error('Public fixture wallet mismatch');
const checks = spawnSync(process.execPath, ['--test', 'apps/web/e2e/chain-fixture.check.mjs'], { stdio: 'inherit' });
if (checks.status !== 0) process.exit(checks.status ?? 1);
const chain = await startChainFixture();
if (new URL(chain.url).hostname !== '127.0.0.1') throw new Error('Fixture must be loopback');
writeFileSync('.local/e2e-chain.json', JSON.stringify({ url: chain.url }));
const env = {
  ...process.env, DATABASE_URL: `sqlite:///./${database}`, PLANNER_MODE: 'deterministic_demo', DEMO_MODE: 'true',
  API_TOKEN: credentials.api_token, DEMO_PASSWORD_HASH: runtime.password_hash,
  RPC_URL: chain.url, WALLET_ADDRESS: WALLET, TEST_TOKEN_ADDRESS: TOKEN, APPROVED_RECIPIENT: RECIPIENT,
  OPTIMIZER_GAS_LIMIT: '100000', OPTIMIZER_MAX_FEE_PER_GAS_WEI: '10',
  EXECUTION_ENABLED: 'true', SIGNER_PRIVATE_KEY: credentials.signer_key,
  VERIFIER_PRIVATE_KEY: credentials.verifier_key, VERIFIER_KEY_ID: 'isolated-browser-test',
  VERIFIER_PUBLIC_KEYS_JSON: JSON.stringify({ 'isolated-browser-test': runtime.verifier_public }),
  VERIFIER_TRANSACTION_CONFIG_JSON: JSON.stringify({ wallet_address: WALLET, token_address: TOKEN, recipient: RECIPIENT, token_decimals: 18, gas_limit: 100000, max_fee_per_gas_wei: '10', max_priority_fee_per_gas_wei: '1' }),
  LLM_API_KEY: '', GOOGLE_APPLICATION_CREDENTIALS: '',
  TRUSTED_ORIGINS: JSON.stringify(['http://127.0.0.1:3000', 'http://localhost:3000']),
  COOKIE_SECURE: 'false', DEPLOYMENT_MODE: 'local', API_BASE_URL: 'http://127.0.0.1:8000',
};
// The last step adds a labeled test-only simulation config to this throwaway database (see the script header).
for (const args of [['-m', 'alembic', 'upgrade', 'head'], ['-m', 'app.db.seed'], ['apps/web/e2e/seed_e2e_simulation_config.py']]) {
  const result = spawnSync(python, args, { stdio: 'inherit', env: { ...env, PYTHONPATH: 'services/api' } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const dev = spawn(process.execPath, ['scripts/dev.mjs'], { stdio: 'inherit', env });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { chain.close(); dev.kill(signal); });
dev.on('exit', (code) => { chain.close(); process.exit(code ?? 0); });
