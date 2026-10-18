import {allowed,sensitive,deadline,trustedSender,journalFrom,BACKEND} from './policy.mjs';
type Credential={session_token:string;csrf_token:string;expires_at:string};
type Entry={path:string;body:string;state:'sending'|'observed'|'unknown'};
type Reply={status:number;body:string};
const error=(status:number,message:string):Reply=>({status,body:JSON.stringify({code:status===401?'UNAUTHORIZED':status===409?'CONFLICT':'UNAVAILABLE',message,reasons:[]})});
let queue=Promise.resolve();
const locks=new Set<string>();
async function initialize(){await chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});}
const initialized=initialize();
async function call(message:{method:string;path:string;body:string|null}):Promise<Reply>{
 await initialized;
 const {method,path}=message;
 if(!allowed(method,path)|| (message.body!==null&&typeof message.body!=='string') || (message.body?.length??0)>65536)return error(409,'Operation not allowed');
 const auth=(await chrome.storage.session.get('credential')).credential as Credential|undefined;
 const login=path==='/auth/login';
 if(!login&&path!=='/health'&&(!auth||Date.parse(auth.expires_at)<=Date.now()))return error(401,'Sign in to the extension again.');
 const headers:Record<string,string>={'Content-Type':'application/json','X-ProofFi-Extension-Id':chrome.runtime.id};
 if(auth&&!login){headers['X-ProofFi-Extension-Session']=auth.session_token;headers['X-CSRF-Token']=auth.csrf_token;}
 const actual=path==='/auth/login'?'/auth/extension/login':path==='/auth/session'?'/auth/extension/session':path==='/auth/logout'?'/auth/extension/logout':path;
 const key=path==='/execute'?`execution:${JSON.parse(message.body??'{}').certificate_id}`:path;
 if(locks.has(key))return error(409,'An operation is already in progress.');
 locks.add(key);
 let journal:Record<string,Entry>={};
 try{
  if(sensitive(path)){
   journal=journalFrom((await chrome.storage.local.get('attempts')).attempts);
   const old=journal[key];
   if(old){
    if(path!=='/execute')return error(409,'Prior outcome requires inspection in state and audit; automatic repetition is blocked.');
    if(old.body!==message.body)return error(409,'Preserve the original execution identity. A replacement attempt is blocked.');
    const log=await fetch(BACKEND+'/audit',{headers,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(10000)});
    if(!log.ok)return error(409,'Matching audit claim could not be checked.');
    const body=JSON.parse(old.body);
    const events=await log.json();
    if(!Array.isArray(events)||!events.some(e=>e.event_type==='EXECUTION_CLAIMED'&&e.details?.certificate_id===body.certificate_id&&e.details?.action_digest===body.action_digest))return error(409,'No matching recorded claim; do not resend blindly.');
   }
   journal[key]={path,body:message.body??'',state:'sending'};
   await chrome.storage.local.set({attempts:journal});
  }
  const response=await fetch(BACKEND+actual,{method,headers,body:method==='POST'?message.body??'{}':undefined,credentials:'omit',redirect:'error',signal:AbortSignal.timeout(deadline(path))});
  const text=await response.text();
  if(text.length>2097152)throw new Error('Response bound exceeded');
  let publicBody=text;
  if(login&&response.ok){const credential=JSON.parse(text) as Credential;if(typeof credential.session_token!=='string'||typeof credential.csrf_token!=='string'||!Number.isFinite(Date.parse(credential.expires_at)))throw new Error('Invalid session');await chrome.storage.session.set({credential});publicBody=JSON.stringify({csrf_token:credential.csrf_token,expires_at:credential.expires_at});}
  if(response.status===401||path==='/auth/logout'&&response.ok)await chrome.storage.session.remove('credential');
  if(sensitive(path)){
   if(response.status>=500)journal[key].state='unknown';
   else if(path==='/execute')journal[key].state='observed';
   else delete journal[key];
   await chrome.storage.local.set({attempts:journal});
  }
  return {status:response.status,body:publicBody};
 }catch{
  if(sensitive(path)&&journal[key]){journal[key].state='unknown';await chrome.storage.local.set({attempts:journal});}
  return error(503,'Backend response unavailable. Inspect state and audit before repeating a mutation.');
 }finally{locks.delete(key);}
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
 if(!trustedSender(sender,chrome.runtime.id)){respond(error(409,'Untrusted extension sender'));return false;}
 if(message?.type==='BOOT'){initialized.then(()=>chrome.storage.local.get('attempts')).then(v=>respond({attempts:v.attempts??{}}));return true;}
 if(message?.type!=='API'){respond(error(409,'Message not allowed'));return false;}
 // Serialize credential/journal changes across popup and panel; no automatic retry.
 queue=queue.then(async()=>{respond(await call(message));}).catch(()=>respond(error(503,'Worker unavailable')));
 return true;
});
