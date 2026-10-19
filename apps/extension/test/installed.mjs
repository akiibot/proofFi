// Installed extension integration. Only a new disposable DB and loopback chain are used.
import {chromium,expect} from '@playwright/test';
import {createServer} from 'node:http';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startChainFixture,TOKEN,RECIPIENT,WALLET} from '../../web/e2e/chain-fixture.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const source=process.env.PROOFFI_AUTH_SOURCE??root;
const python=path.join(root,process.platform==='win32'?'.venv/Scripts/python.exe':'.venv/bin/python');
mkdirSync(path.join(root,'.local'),{recursive:true});
const temp=mkdtempSync(path.join(root,'.local','extension-fixture-'));
const dist=path.join(root,'apps/extension/dist');
let context=await chromium.launchPersistentContext(path.join(temp,'profile'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${dist}`,`--load-extension=${dist}`],viewport:{width:420,height:900}});
let backend,chain,lastPage,proxy;let loseExecutionReply=true;const errors=[];
try{
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');
 const id=new URL(worker.url()).host;
 const keys=JSON.parse(readFileSync(path.join(root,'apps/web/e2e/test-credentials.json'),'utf8'));
 const runtime=JSON.parse(execFileSync(python,[path.join(root,'apps/web/e2e/chain-crypto.py'),'runtime'],{cwd:source,env:{...process.env,PYTHONPATH:path.join(source,'services/api')},encoding:'utf8'}));
 chain=await startChainFixture();
 const env={...process.env,PYTHONPATH:path.join(source,'services/api'),DATABASE_URL:'sqlite:///'+path.join(temp,'fixture.db'),EXTENSION_IDS:JSON.stringify([id]),DEMO_PASSWORD_HASH:runtime.password_hash,PLANNER_MODE:'deterministic_demo',DEMO_MODE:'true',RPC_URL:chain.url,WALLET_ADDRESS:WALLET,TEST_TOKEN_ADDRESS:TOKEN,APPROVED_RECIPIENT:RECIPIENT,OPTIMIZER_GAS_LIMIT:'100000',OPTIMIZER_MAX_FEE_PER_GAS_WEI:'10',EXECUTION_ENABLED:'true',SIGNER_PRIVATE_KEY:keys.signer_key,VERIFIER_PRIVATE_KEY:keys.verifier_key,VERIFIER_KEY_ID:'isolated-extension-test',VERIFIER_PUBLIC_KEYS_JSON:JSON.stringify({'isolated-extension-test':runtime.verifier_public}),VERIFIER_TRANSACTION_CONFIG_JSON:JSON.stringify({wallet_address:WALLET,token_address:TOKEN,recipient:RECIPIENT,token_decimals:18,gas_limit:100000,max_fee_per_gas_wei:'10',max_priority_fee_per_gas_wei:'1'}),LLM_API_KEY:'',GOOGLE_APPLICATION_CREDENTIALS:''};
 const run=(args,input)=>execFileSync(python,args,{cwd:source,env,input,encoding:'utf8',stdio:['pipe','pipe','pipe']});
 run(['-m','alembic','upgrade','head']);run(['-m','app.db.seed']);
 run(['-c',`from app.db.session import make_engine,sessions
from app.core.settings import Settings
from app.db.state import read_state,append_state
from app.models.contracts import StateSnapshot,SimulationConfig
from app.db.models import SimulationConfigRecord
from app.core.canonical import digest
assert 'extension-fixture-' in Settings().database_url
with sessions(make_engine(Settings().database_url)).begin() as s:
 old=read_state(s)
 data=old.snapshot.model_dump();data['version']=2;data['assets'][0]['amount_minor']=1700000;data['assumptions'].append('ISOLATED EXTENSION FIXTURE: synthetic cash, not approved runtime funds')
 append_state(s,StateSnapshot.model_validate(data),1)
 config=SimulationConfig(id='extension-test-only',model_version='pf-monte-carlo-v1',daily_volatility_bps=100,income_delay_probability_bps=1000,emergency_probability_bps=1000,fee_minor=100,model_assumptions=['ISOLATED PUBLIC TEST FIXTURE'])
 s.add(SimulationConfigRecord(id=config.id,config_digest=digest(config),payload=config.model_dump(mode='json')))
`]);
 backend=spawn(python,['-m','uvicorn','app.main:app','--app-dir',path.join(source,'services/api'),'--host','127.0.0.1','--port','8010'],{cwd:source,env,stdio:['ignore','ignore','pipe']});
 await expect.poll(async()=>{try{return (await fetch('http://127.0.0.1:8010/health')).status;}catch{return 0;}},{timeout:10000}).toBe(200);
 proxy=createServer(async(req,res)=>{try{
  const chunks=[];for await(const c of req)chunks.push(c);const headers={...req.headers};delete headers.host;delete headers.connection;delete headers['content-length'];
  const response=await fetch('http://127.0.0.1:8010'+req.url,{method:req.method,headers,body:req.method==='POST'?Buffer.concat(chunks):undefined});
  const text=await response.text();
  if(req.url==='/execute'&&loseExecutionReply){loseExecutionReply=false;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({code:'UNAVAILABLE',message:'Isolated fixture discarded the original execution response',reasons:[]}));return;}
  res.writeHead(response.status,{'Content-Type':'application/json'});res.end(text);
 }catch{res.writeHead(503);res.end('{}');}});
 await new Promise(resolve=>proxy.listen(8000,'127.0.0.1',resolve));
 const panel=await context.newPage();lastPage=panel;panel.on('pageerror',e=>errors.push(e.name+': '+e.message));
 await panel.goto(`chrome-extension://${id}/panel.html#/login`);
 await panel.getByLabel('Demo password',{exact:true}).fill(keys.password);
 await panel.getByRole('button',{name:'Sign in',exact:true}).click();
 await expect(panel.getByRole('heading',{name:'Financial overview',exact:true})).toBeVisible();
 for(const [route,title] of [['/settings','Settings'],['/constitution','Constitution'],['/workspace','Workspace'],['/time-machine','Time Machine'],['/certificates','Certificates'],['/certificate-verifier','Certificate verifier'],['/red-team','Red team'],['/audit','Audit']]){
  await panel.goto(`chrome-extension://${id}/panel.html#${route}`);
  await expect(panel.getByRole('heading',{level:1})).toHaveText(title);
 }
 await panel.goto(`chrome-extension://${id}/panel.html#/settings`);await panel.getByLabel('Appearance',{exact:true}).selectOption('dark');await panel.screenshot({path:path.join(temp,'panel-dark.png'),fullPage:true});
 await panel.getByLabel('Appearance',{exact:true}).selectOption('light');
 await panel.goto(`chrome-extension://${id}/panel.html#/constitution`);
 await panel.getByLabel('Allowed tokens',{exact:true}).fill(TOKEN);await panel.getByLabel('Known recipients',{exact:true}).fill(RECIPIENT);
 await panel.getByRole('button',{name:'Save draft',exact:true}).click();
 await panel.getByLabel('I have reviewed these exact rules and want them to become my active Constitution.').check();await panel.getByRole('button',{name:'Confirm and activate',exact:true}).click();
 await expect(panel.getByRole('status').filter({hasText:'is now your active Constitution'})).toBeVisible();
 await panel.goto(`chrome-extension://${id}/panel.html#/workspace`);
 await panel.getByText('Or enter a candidate yourself',{exact:true}).click();
 await panel.getByRole('button',{name:'Find the largest safe amount',exact:true}).click();
 await expect(panel.getByTestId('optimizer-result')).toContainText('Largest safe amount');
 await panel.getByRole('button',{name:'Verify and get a certificate',exact:true}).click();
 const certificate=panel.getByRole('link').filter({hasText:/^cert-/});await expect(certificate).toBeVisible();await certificate.click();
 await expect(panel.getByTestId('certificate-status')).toContainText('needs your approval');
 await panel.getByLabel(/I approve exactly this transaction/).check();await panel.getByRole('button',{name:'Approve',exact:true}).click();
 await expect(panel.getByRole('status').filter({hasText:'Approved at'})).toBeVisible();
 await panel.getByLabel('Send this transaction to the Base Sepolia testnet. No real money is used.').check();await panel.getByRole('button',{name:'Execute on testnet',exact:true}).click();
 await expect(panel.getByRole('alert').filter({hasText:'The execution outcome is unknown.'})).toBeVisible();
 const prior=await panel.evaluate(()=>Object.keys(sessionStorage).find(k=>k.startsWith('prooffi.execute.')));
 expect(prior).toBeTruthy();
 // Terminate the service worker via CDP, preserving only the durable journal.
 const cdp=await context.newCDPSession(panel);let versions=[];
 cdp.on('ServiceWorker.workerVersionUpdated',event=>{versions=event.versions;});await cdp.send('ServiceWorker.enable');
 await expect.poll(()=>versions.some(v=>v.scriptURL.includes(id))).toBe(true);
 const version=versions.find(v=>v.scriptURL.includes(id));await cdp.send('ServiceWorker.stopWorker',{versionId:version.versionId});
 await panel.close();
 const reopened=await context.newPage();await reopened.goto(`chrome-extension://${id}/panel.html#/certificates?id=${encodeURIComponent(prior.slice('prooffi.execute.'.length))}`);
 await expect(reopened.getByRole('button',{name:'Reconcile recorded attempt',exact:true})).toBeVisible();
 await reopened.getByRole('button',{name:'Reconcile recorded attempt',exact:true}).click();
 await expect(reopened.getByTestId('execution-result')).toContainText('CONFIRMED');
 const stats=await (await fetch(chain.url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'prooffi_fixtureStats',params:[]})})).json();
 expect(stats.result.send_calls).toBe(1);expect(stats.result.accepted_transactions).toBe(1);
 const entries=await reopened.evaluate(async()=> (await chrome.storage.local.get('attempts')).attempts);
 expect(Object.values(entries).filter(x=>x.path==='/execute')).toHaveLength(1);
 await reopened.screenshot({path:path.join(temp,'panel-reopened.png'),fullPage:true});
 const popup=await context.newPage();await popup.goto(`chrome-extension://${id}/popup.html#/`);await expect(popup.getByRole('heading',{name:'Overview',exact:true})).toBeVisible();await expect(popup.locator('.popup-balance')).toBeVisible();await popup.screenshot({path:path.join(temp,'popup-light.png'),fullPage:true});
 await popup.getByRole('link',{name:'Plan',exact:true}).click();await popup.getByRole('button',{name:'Continue planning',exact:true}).click();await expect(reopened.getByRole('heading',{name:'Workspace',exact:true})).toBeVisible();await expect(popup.getByRole('alert')).toHaveCount(0);
 expect(errors).toEqual([]);
 writeFileSync(path.join(temp,'result.json'),JSON.stringify({installed_chromium:true,extension_id:id,pages:9,authentication:'real extension transport',financial_flow:'isolated SQLite and loopback chain only',popup:true,popup_handoff:true,retained_execution:true,stats:stats.result},null,2));
 // Browser restart drops session credentials but retains the exact request identity.
 await context.close();context=await chromium.launchPersistentContext(path.join(temp,'profile'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${dist}`,`--load-extension=${dist}`],viewport:{width:420,height:900}});
 const fresh=await context.newPage();await fresh.goto(`chrome-extension://${id}/panel.html#/`);
 await expect(fresh.getByLabel('Demo password',{exact:true})).toBeVisible();
 const retained=await fresh.evaluate(async()=>({credential:(await chrome.storage.session.get('credential')).credential,attempts:(await chrome.storage.local.get('attempts')).attempts}));
 expect(retained.credential).toBeUndefined();expect(Object.values(retained.attempts).filter(x=>x.path==='/execute')).toHaveLength(1);
 const evidence=JSON.parse(readFileSync(path.join(temp,'result.json'),'utf8'));Object.assign(evidence,{lost_execution_reply:true,worker_terminated:true,matching_claim_reconciled:true,browser_restart_signed_out:true});writeFileSync(path.join(temp,'result.json'),JSON.stringify(evidence,null,2));
 console.log('Installed Chromium extension checks passed. Evidence: '+temp);
}catch(e){if(lastPage){await lastPage.screenshot({path:path.join(temp,'failure.png'),fullPage:true});console.error('UI state:',await lastPage.locator('body').innerText());console.error('UI errors:',errors);}throw e;}finally{backend?.kill('SIGTERM');chain?.close();proxy?.closeAllConnections();proxy?.close();await context.close();}
