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

const env = { ...process.env, DATABASE_URL: `sqlite:///./${database}` };
for (const args of [['-m', 'alembic', 'upgrade', 'head'], ['-m', 'app.db.seed']]) {
  const result = spawnSync(python, args, { stdio: 'inherit', env: { ...env, PYTHONPATH: 'services/api' } });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const dev = spawn(process.execPath, ['scripts/dev.mjs'], { stdio: 'inherit', env });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => dev.kill(signal));
dev.on('exit', (code) => process.exit(code ?? 0));
