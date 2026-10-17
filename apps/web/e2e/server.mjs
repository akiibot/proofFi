// Browser tests run against a fresh, separately seeded SQLite database so that journeys which write
// (confirm a Constitution, record approvals) never touch the developer's local prooffi.db, and every
// run starts from the same seed. Same backend, migrations and seed as `npm run dev`; only DATABASE_URL differs.
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
process.chdir(root);
const python = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
mkdirSync('.local', { recursive: true });
const database = '.local/e2e.db';
for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(database + suffix, { force: true });

// Exercise the real deterministic planner adapter in isolated browser tests.
// Never require a live provider key or imply that a proposal is approved/safe.
const env = { ...process.env, DATABASE_URL: `sqlite:///./${database}`, PLANNER_MODE: 'deterministic_demo', DEMO_MODE: 'true' };
// The last step adds a labeled test-only simulation config to this throwaway database (see the script header).
for (const args of [['-m', 'alembic', 'upgrade', 'head'], ['-m', 'app.db.seed'], ['apps/web/e2e/seed_e2e_simulation_config.py']]) {
  const result = spawnSync(python, args, { stdio: 'inherit', env: { ...env, PYTHONPATH: 'services/api' } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const dev = spawn(process.execPath, ['scripts/dev.mjs'], { stdio: 'inherit', env });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => dev.kill(signal));
dev.on('exit', (code) => process.exit(code ?? 0));
