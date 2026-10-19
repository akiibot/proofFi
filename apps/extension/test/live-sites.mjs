// Manual, network-dependent coverage report. Restricted sites are reported, never bypassed.
import {chromium,expect} from '@playwright/test';
import {mkdtempSync,cpSync,readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {spawn,execFileSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../..');process.chdir(root);
const temp=mkdtempSync(path.join(root,'.local','live-sites-')),dist=path.join(temp,'extension');
cpSync(path.join(root,'apps/extension/dist'),dist,{recursive:true});
const cases=[['Vanguard VOO','https://investor.vanguard.com/investment-products/etfs/profile/voo','investment'],['iShares IVV','https://www.ishares.com/us/products/239726/ishares-core-sp-500-etf','investment'],['Fidelity funds','https://www.fidelity.com/mutual-funds/fidelity-funds/overview','investment'],['Spotify Premium','https://www.spotify.com/us/premium/','expense'],['Adobe plans','https://www.adobe.com/creativecloud/plans.html','expense'],['Schwab SCHX','https://www.schwabassetmanagement.com/products/schx','investment'],['Investor.gov fees','https://www.investor.gov/introduction-investing/investing-basics/glossary/mutual-fund-fees-and-expenses','investment']];
const manifest=JSON.parse(readFileSync(path.join(dist,'manifest.json'),'utf8'));manifest.host_permissions.push(...cases.map(c=>new URL(c[1]).origin+'/*'));writeFileSync(path.join(dist,'manifest.json'),JSON.stringify(manifest));
for(const name of readdirSync(dist,{recursive:true}).filter(n=>n.endsWith('.js'))){const p=path.join(dist,name);writeFileSync(p,readFileSync(p,'utf8').replaceAll('http://127.0.0.1:8000','http://127.0.0.1:8400'));}
const evidence={scope:'Actual public websites in an isolated installed Chromium profile; no signed transaction, policy or financial mutation; explicit per-page analysis only',permission_scope:'Test copy pregrants only five public origins. Production permission dialog remains separate.',results:[]};let context,backend;
try{
 context=await chromium.launchPersistentContext(path.join(temp,'profile'),{channel:'chromium',headless:true,args:[`--disable-extensions-except=${dist}`,`--load-extension=${dist}`],viewport:{width:420,height:900}});
 const worker=context.serviceWorkers()[0]??await context.waitForEvent('serviceworker');const id=new URL(worker.url()).host;
 const python=path.join(root,'.venv/bin/python');
 const env={...process.env,PYTHONPATH:path.join(root,'services/api'),DATABASE_URL:'sqlite:///'+path.join(temp,'qa.db'),EXTENSION_IDS:JSON.stringify([id]),DEMO_MODE:'true',EXECUTION_ENABLED:'false',SIGNER_PRIVATE_KEY:'',VERIFIER_PRIVATE_KEY:'',RPC_URL:'',LLM_API_KEY:'',GOOGLE_APPLICATION_CREDENTIALS:'',WIGOLO_ENABLED:'true',WIGOLO_URL:'http://127.0.0.1:3333',RESEARCH_DOMAINS:JSON.stringify(['investor.gov','vanguard.com','ishares.com','fidelity.com','spotify.com','adobe.com','schwabassetmanagement.com'])};
 const password='Vallet-Public-Site-QA-2026';env.DEMO_PASSWORD_HASH=execFileSync(python,['-c',`from app.core.auth import hash_password; print(hash_password('${password}'))`],{cwd:temp,env,encoding:'utf8'}).trim();
 const migrate=`from alembic import command; from alembic.config import Config; c=Config(); c.set_main_option('script_location',${JSON.stringify(path.join(root,'services/api/migrations'))}); command.upgrade(c,'head')`;
 execFileSync(python,['-c',migrate],{cwd:temp,env,stdio:'pipe'});execFileSync(python,['-m','app.db.seed'],{cwd:temp,env,stdio:'pipe'});
 backend=spawn(python,['-m','uvicorn','app.main:app','--host','127.0.0.1','--port','8400'],{cwd:temp,env,stdio:'ignore'});
 await expect.poll(async()=>{try{return (await fetch('http://127.0.0.1:8400/health')).status;}catch{return 0;}},{timeout:15000}).toBe(200);
 const panel=await context.newPage();await panel.goto(`chrome-extension://${id}/panel.html#/login`);await panel.getByLabel('Demo password',{exact:true}).fill(password);await panel.getByRole('button',{name:'Sign in',exact:true}).click();await expect(panel.getByRole('heading',{name:'Set your rules to protect your tuition.',exact:true})).toBeVisible();
 const api=async p=>JSON.parse((await panel.evaluate(async p=>chrome.runtime.sendMessage({type:'API',method:'GET',path:p,body:null}),p)).body);
 const before={state:await api('/financial-state'),audit:await api('/audit')};
 for(const [name,url,expected] of cases){
  const entry={name,url,expected};const site=await context.newPage();
  try{
   const response=await site.goto(url,{waitUntil:'domcontentloaded',timeout:25000});entry.http_status=response?.status();entry.final_url=site.url();entry.title=await site.title();
   const opening=(await site.locator('body').innerText({timeout:10000})).slice(0,1200);
   if(entry.http_status>=400||/access denied|verify you are human|just a moment|checking your browser/i.test(entry.title+' '+opening)){entry.status='site_access_unavailable';continue;}
   await panel.goto(`chrome-extension://${id}/panel.html#/context/advanced`);await site.bringToFront();await panel.getByRole('button',{name:'Inspect this page',exact:true}).click();
   await expect(panel.getByRole('button',{name:'Inspect this page',exact:true})).toBeEnabled({timeout:15000});await expect(panel.getByLabel('Selected information',{exact:true})).toBeVisible({timeout:12000});
   let preview=await panel.evaluate(()=>chrome.runtime.sendMessage({type:'CONTEXT_PREVIEW'}));
   if(!preview.preview){await site.bringToFront();await panel.getByRole('button',{name:'Inspect this page',exact:true}).click();await expect(panel.getByRole('button',{name:'Inspect this page',exact:true})).toBeEnabled({timeout:15000});preview=await panel.evaluate(()=>chrome.runtime.sendMessage({type:'CONTEXT_PREVIEW'}));}
   if(!preview.preview){entry.status='capture_unavailable';entry.reason=preview.error??(await panel.locator('[role=alert]').allTextContents()).join(' ');continue;}
   writeFileSync(path.join(temp,name.split(' ')[0].toLowerCase()+'-selected.txt'),preview.preview.selected_text);entry.classification=preview.preview.page_kind;entry.selected_characters=preview.preview.selected_text.length;entry.source_url=preview.preview.source_url;if(!preview.preview.selected_text.trim()){entry.status='no_readable_content';continue;}
   if(expected==='investment'){await panel.getByRole('checkbox',{name:'Also research a public product using Wigolo and approved sources.',exact:true}).check();await panel.getByLabel('Public product name sent to search providers',{exact:true}).fill(entry.title.slice(0,120));}
   await panel.getByRole('checkbox',{name:'I reviewed this information and want it analysed. It grants no financial permission.',exact:true}).check();
   await panel.getByRole('button',{name:'Analyse this page',exact:true}).click();await expect(panel.getByRole('tab',{name:'Understand',exact:true})).toBeVisible({timeout:20000});
   entry.status=entry.classification===expected?'capture_and_analysis_passed':'analysed_classification_gap';
   await panel.screenshot({path:path.join(temp,name.split(' ')[0].toLowerCase()+'-understand.png')});
   await panel.getByRole('tab',{name:'Evidence',exact:true}).click();entry.research_source_count=await panel.getByRole('link',{name:'Open source ↗',exact:true}).count();await panel.screenshot({path:path.join(temp,name.split(' ')[0].toLowerCase()+'-evidence.png')});await panel.getByRole('tab',{name:'For me',exact:true}).click();
   if(entry.classification==='expense')await expect(panel.getByRole('button',{name:'Recording commitments is not available',exact:true})).toBeDisabled();
   else await expect(panel.getByText('This product is research-only.',{exact:false})).toBeVisible();
   entry.financial_authority='none';
  }catch(e){entry.status='unavailable';entry.reason=String(e).slice(0,350);}
  finally{evidence.results.push(entry);console.log(JSON.stringify(entry));await site.close();}
 }
 const after={state:await api('/financial-state'),audit:await api('/audit')};assert.deepEqual(after,before);evidence.financial_state_and_audit_unchanged=true;
 evidence.status=evidence.results.every(x=>x.status==='capture_and_analysis_passed')?'passed':evidence.results.some(x=>x.status==='capture_and_analysis_passed')?'partial':'unavailable';
 writeFileSync(path.join(temp,'evidence.json'),JSON.stringify(evidence,null,2));console.log('EVIDENCE',temp);
}finally{await context?.close();backend?.kill('SIGTERM');}
