import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const python = process.platform === 'win32' ? '.venv/Scripts/python.exe' : '.venv/bin/python';
for (const [command,args] of [[python,['-m','ruff','check','.']],[python,['-m','pytest','-q']],['npm',['run','contracts']],['npm',['run','lint']],['npm',['run','typecheck']],['npm',['run','build']],['npm',['run','test:e2e']]]) {
 const result=spawnSync(command,args,{stdio:'inherit',shell:process.platform === 'win32' && command === 'npm'}); if(result.status !== 0) process.exit(result.status ?? 1);
}

if (existsSync('apps/extension/package.json')) {
 for (const args of [['run','lint','-w','@prooffi/extension'],['run','build:extension'],['run','test:extension']]) {
  const result=spawnSync('npm',args,{stdio:'inherit',shell:process.platform==='win32'});
  if(result.status!==0)process.exit(result.status??1);
 }
}
