import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(root);
if (existsSync('.env')) process.loadEnvFile('.env');
const python = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
const children = [
  spawn(python, ['-m','uvicorn','app.main:app','--app-dir','services/api','--host','127.0.0.1','--port','8000'], {stdio:'inherit'}),
  spawn('npm', ['run','dev','-w','apps/web'], {stdio:'inherit', shell:process.platform === 'win32'}),
];
let closing = false;
function close(code) { if (closing) return; closing = true; for (const child of children) child.kill('SIGTERM'); process.exitCode = code; }
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, () => close(0));
for (const child of children) { child.on('error', error => { console.error(error.message); close(1); }); child.on('exit', code => close(code ?? 1)); }
