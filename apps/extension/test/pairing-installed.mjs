// Installed Chromium, real local web/API and SQLite. No RPC or financial mutations.
import {chromium,expect} from '@playwright/test';
import {spawn,execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,cpSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');
const webRoot=process.env.VALLET_PAIRING_WEB_ROOT??root;
const python=path.join(root,'.venv/bin/python');
mkdirSync(path.join(root,'.local'),{recursive:true});
const temp=mkdtempSync(path.join(root,'.local/pairing-installed-'));
const dist=path.join(temp,'first/extension'),dist2=path.join(temp,'second/extension');
cpSync(path.join(root,'apps/extension/dist'),dist,{recursive:true});
for(const name of readdirSync(dist,{recursive:true}).filter(n=>n.endsWith('.js'))){const f=path.join(dist,name);writeFileSync(f,readFileSync(f,'utf8').replaceAll('http://127.0.0.1:8000','http://127.0.0.1:8500').replaceAll('http://127.0.0.1:3000','http://127.0.0.1:3500'));}
cpSync(dist,dist2,{recursive:true});
const password='pairing-installed-disposable-2026';
const hash=execFileSync(python,['-c',`from app.core.auth import hash_password;print(hash_password('${password}'))`],{cwd:root,env:{...process.env,PYTHONPATH:'services/api'},encoding:'utf8'}).trim();
const env={...process.env,PYTHONPATH:path.join(root,'services/api'),DATABASE_URL:'sqlite:///'+path.join(temp,'fixture.db'),DEMO_PASSWORD_HASH:hash,DEPLOYMENT_MODE:'local',COOKIE_SECURE:'false',TRUSTED_ORIGINS:JSON.stringify(['http://127.0.0.1:3500']),EXTENSION_IDS:'[]',EXECUTION_ENABLED:'false',SIGNER_PRIVATE_KEY:'',VERIFIER_PRIVATE_KEY:'',RPC_URL:'',WALLET_ADDRESS:'',TEST_TOKEN_ADDRESS:'',APPROVED_RECIPIENT:'',LLM_API_KEY:'',GOOGLE_APPLICATION_CREDENTIALS:'',WIGOLO_ENABLED:'false',RESEARCH_DOMAINS:'[]',PLANNER_MODE:'deterministic_demo',API_BASE_URL:'http://127.0.0.1:8500'};
const run=args=>execFileSync(python,args,{cwd:root,env,encoding:'utf8'});
run(['-m','alembic','upgrade','head']);run(['-m','app.db.seed']);
let api,web,context;const evidence={scope:'Disposable local SQLite, no RPC, signing disabled',checks:[],extension_id:'',errors:[]};
const check=s=>{evidence.checks.push(s);console.log('PASS',s);};
const launch=dir=>chromium.launchPersistentContext(path.join(temp,dir===dist?'profile':'profile2'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${dir}`,`--load-extension=${dir}`],viewport:{width:380,height:800}});
async function ready(url){await expect.poll(async()=>{try{return(await fetch(url)).status;}catch{return 0;}},{timeout:90000}).toBe(200);}
function startApi(){return spawn(python,['-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8500'],{cwd:temp,env,stdio:['ignore','ignore','pipe']});}
async function stop(child){if(!child||child.exitCode!==null)return;const exited=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await exited;}
try{
 api=startApi();await ready('http://127.0.0.1:8500/health');
 web=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port','3500'],{cwd:path.join(webRoot,'apps/web'),env,stdio:['ignore','ignore','pipe']});await ready('http://127.0.0.1:3500/login');
 // Snapshot only financial records; connection rows are the intended mutable authentication state.
 const snapshot=()=>run(['-c',`import sqlite3,json; c=sqlite3.connect('${path.join(temp,'fixture.db')}'); print(json.dumps({t:c.execute('SELECT * FROM '+t).fetchall() for t in ['financial_states','user_heads','constitution_versions','certificates','approvals','executions','audit_events']},default=str,sort_keys=True))`]);
 const before=snapshot();
 context=await launch(dist);
 let worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');const id=new URL(worker.url()).host;evidence.extension_id=id;
 let panel=await context.newPage();panel.on('pageerror',e=>evidence.errors.push(e.message));
 const goto=()=>panel.goto(`chrome-extension://${id}/popup.html#/login`);
 await goto();await panel.getByLabel('Demo password',{exact:true}).fill(password);await panel.getByRole('button',{name:'Sign in',exact:true}).click();await expect(panel.getByText('Connect this extension in local Vallet first',{exact:true})).toBeVisible();check('unpaired installation cannot log in');
 const approvalPage=context.waitForEvent('page');await panel.getByRole('button',{name:'Connect to local Vallet',exact:true}).click();let page=await approvalPage;
 await expect(page).toHaveURL(/\/login$/);await expect(panel.locator('strong')).toHaveText(/^[A-HJ-NP-Z2-9]{8}$/);let code=await panel.locator('strong').textContent();
 await page.setViewportSize({width:1100,height:850});await page.getByLabel('Demo password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page.getByRole('heading',{name:'Connect your extension',exact:true})).toBeVisible();
 assert.match(new URL(page.url()).search,/^\?request=pair-[0-9a-f]{32}$/);assert.ok(!page.url().includes(code));check('website sign-in returns to non-secret pairing link');
 await page.getByLabel('Code shown in your extension',{exact:true}).fill(code);await page.getByRole('button',{name:'Allow this extension',exact:true}).click();await expect(page.getByText('Connected. Return to the extension and sign in.',{exact:true})).toBeVisible();
 await expect(panel.getByText('Connected—sign in to continue.',{exact:true})).toBeVisible({timeout:10000});
 await panel.screenshot({path:path.join(temp,'paired-popup.png')});await page.screenshot({path:path.join(temp,'website-approval.png')});check('explicit website approval enables installation without environment edits');
 const stores=await worker.evaluate(async()=>({local:await chrome.storage.local.get(null),session:await chrome.storage.session.get(null)}));assert.equal(stores.local.pairing,undefined);assert.equal(stores.session.credential,undefined);assert.equal(stores.session.pairing.polling_secret.length,43);check('pairing never logs in; polling credential is session-only');
 await panel.close();const control=await context.newCDPSession(page);await control.send('ServiceWorker.enable');await control.send('ServiceWorker.stopAllWorkers');panel=await context.newPage();await goto();await expect(panel.getByText('Connected—sign in to continue.',{exact:true})).toBeVisible();check('popup closure and worker restart restore pairing without starting a new request');
 await panel.getByLabel('Demo password',{exact:true}).fill(password);await panel.getByRole('button',{name:'Sign in',exact:true}).click();await expect(panel.getByText('Synthetic planning balance',{exact:true})).toBeVisible();check('paired installation uses ordinary password session');
 // Website management requires separate explicit revocation consent.
 await page.goto('http://127.0.0.1:3500/settings');await page.getByRole('button',{name:'Revoke connection',exact:true}).click();await page.getByRole('button',{name:'Confirm revocation',exact:true}).click();await expect(page.getByText('Connection revoked. Its active sessions can no longer access Vallet.',{exact:true})).toBeVisible();
 const refused=await panel.evaluate(()=>chrome.runtime.sendMessage({type:'API',method:'GET',path:'/financial-state',body:null}));assert.equal(refused.status,401);check('website revocation immediately blocks active extension session');
 await goto();await panel.evaluate(()=>chrome.runtime.sendMessage({type:'PAIRING_STATUS'}));await panel.reload();const nextPage=context.waitForEvent('page');await panel.getByRole('button',{name:'Connect to local Vallet',exact:true}).click();page=await nextPage;await expect(page.getByRole('heading',{name:'Connect your extension',exact:true})).toBeVisible();code=await panel.locator('strong').textContent();await page.getByLabel('Code shown in your extension',{exact:true}).fill(code);await page.getByRole('button',{name:'Allow this extension',exact:true}).click();await expect(panel.getByText('Connected—sign in to continue.',{exact:true})).toBeVisible({timeout:10000});check('revoked installation needs fresh explicit pairing');
 await stop(api);api=startApi();await ready('http://127.0.0.1:8500/health');await panel.getByLabel('Demo password',{exact:true}).fill(password);await panel.getByRole('button',{name:'Sign in',exact:true}).click();await expect(panel.getByText('Synthetic planning balance',{exact:true})).toBeVisible();check('approved installation survives backend restart while authentication is recreated');
 assert.equal(before,snapshot());check('all financial state, certificates, execution and audit rows unchanged');
 await context.close();context=null;
 context=await launch(dist2);worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');assert.equal(new URL(worker.url()).host,id);const empty=await worker.evaluate(()=>chrome.storage.session.get(null));assert.equal(empty.credential,undefined);assert.equal(empty.pairing,undefined);check('second installation folder keeps stable ID; browser profile starts unauthenticated');
 await context.close();context=null;context=await launch(dist);worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');const restarted=await worker.evaluate(()=>chrome.storage.session.get(null));assert.equal(restarted.credential,undefined);assert.equal(restarted.pairing,undefined);assert.equal(before,snapshot());check('same-profile browser restart clears credentials and pairing secrets without financial effects');
 assert.deepEqual(evidence.errors,[]);
} catch(e){evidence.failure=String(e.stack??e);throw e;} finally {
 if(context)await context.close();await stop(web);await stop(api);writeFileSync(path.join(temp,'evidence.json'),JSON.stringify(evidence,null,2));console.log('Evidence',path.join(temp,'evidence.json'));
}
