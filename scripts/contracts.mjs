import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('..', import.meta.url)));
const python = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
for (const [command, args] of [
  [python, ['scripts/export_contracts.py']],
  [process.execPath, ['node_modules/openapi-typescript/bin/cli.js', 'contracts/openapi.json', '-o', 'apps/web/src/lib/schema.d.ts']],
]) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.error) console.error(result.error.message);
  if (result.status !== 0) process.exit(result.status ?? 1);
}
