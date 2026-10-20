export const BACKEND='http://127.0.0.1:8000';
export const WEB='http://127.0.0.1:3000';
const reads=new Set(['/health','/financial-state','/chain/status','/audit','/constitutions/drafts','/constitutions/history','/auth/session']);
const writes=new Set(['/auth/login','/auth/logout','/intent/parse','/plans/generate','/simulate','/optimize','/verify','/workflows/goal','/context/analyse','/context/brief','/context/chat','/constitutions/drafts','/constitutions/confirm','/approvals','/execute','/demo/attack','/demo/emergency','/demo/reset']);
export function allowed(method,path){return typeof path==='string'&&(method==='GET'?reads.has(path)||/^\/executions\/[A-Za-z0-9_-]{1,100}$/.test(path)||/^\/certificates\/[A-Za-z0-9_-]{1,100}$/.test(path):method==='POST'&&(writes.has(path)||/^\/certificates\/[A-Za-z0-9_-]{1,100}\/verify$/.test(path)));}
export function sensitive(path){return ['/approvals','/execute','/demo/attack','/demo/emergency','/demo/reset','/constitutions/confirm'].includes(path);}
export function operationKey(path,body){
 if(path==='/approvals'||path==='/execute'){
  let value;try{value=JSON.parse(body??'{}');}catch{throw new Error('Invalid operation identity');}
  if(typeof value?.certificate_id!=='string'||!value.certificate_id||value.certificate_id.length>128)throw new Error('Invalid operation identity');
  return `${path==='/execute'?'execution':'approval'}:${value.certificate_id}`;
 }
 return path;
}
export function deadline(path){if(path==='/context/chat')return 50000;return ['/intent/parse','/plans/generate','/optimize','/context/analyse','/context/brief','/context/chat'].includes(path)?35000:10000;}
export function trustedSender(sender,id){return sender?.id===id&&typeof sender.url==='string'&&['popup.html','panel.html'].some(p=>sender.url.split(/[?#]/)[0]===`chrome-extension://${id}/${p}`);}
export function journalFrom(value){
 if(value===undefined)return {};
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid operation journal');
 for(const [key,entry] of Object.entries(value)){
  if(!entry||typeof entry!=='object'||!sensitive(entry.path)||typeof entry.body!=='string'||!bodyAllowed(entry.body)||!['sending','observed','unknown'].includes(entry.state)||key.length>140)throw new Error('Invalid operation journal');
 }
 return value;
}
export function bodyAllowed(body){return body===null||typeof body==='string'&&new TextEncoder().encode(body).byteLength<=65536;}
