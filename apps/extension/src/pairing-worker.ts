import {BACKEND,WEB} from './policy.mjs';
type Pending={request_id:string;code:string;polling_secret:string;expires_at:string;status?:string};
let busy=false;
function valid(value:unknown):value is Pending {if(!value||typeof value!=='object')return false;const p=value as Pending;return /^pair-[0-9a-f]{32}$/.test(p.request_id)&&/^[A-HJ-NP-Z2-9]{8}$/.test(p.code)&&/^[A-Za-z0-9_-]{43}$/.test(p.polling_secret)&&Number.isFinite(Date.parse(p.expires_at));}
async function saved(){const {pairing}=await chrome.storage.session.get('pairing');return valid(pairing)?pairing:null;}
function publicView(p:Pending){return {request_id:p.request_id,code:p.code,expires_at:p.expires_at,status:p.status??'PENDING'};}
async function call(path:string,body:unknown){const r=await fetch(BACKEND+path,{method:'POST',credentials:'omit',redirect:'error',headers:{'Content-Type':'application/json','X-ProofFi-Extension-Id':chrome.runtime.id},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});const reader=r.body?.getReader();if(!reader)throw new Error('Empty connection response');let size=0;const chunks:Uint8Array[]=[];while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>8192){await reader.cancel();throw new Error('Connection response too large');}chunks.push(part.value);}const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}const data=JSON.parse(new TextDecoder().decode(bytes));if(!r.ok)throw new Error(typeof data.message==='string'?data.message:'Connection unavailable');return data;}
export async function pairingMessage(type:string){
 if(type==='PAIRING_VIEW'){const p=await saved();return {pairing:p?publicView(p):null};}
 if(type==='PAIRING_OPEN'){const p=await saved();if(!p)throw new Error('Start a new connection first.');await chrome.tabs.create({url:WEB+'/connect-extension?request='+p.request_id});return {opened:true};}
 if(busy)throw new Error('Connection check already in progress.');busy=true;
 try{
  if(type==='PAIRING_START'){
   const old=await saved();if(old&&Date.parse(old.expires_at)>Date.now()&&(!old.status||old.status==='PENDING')){await chrome.tabs.create({url:WEB+'/connect-extension?request='+old.request_id});return {pairing:publicView(old)};}
   const data=await call('/auth/extension/pairings',{});if(!valid(data))throw new Error('Invalid connection response');await chrome.storage.session.set({pairing:data});await chrome.tabs.create({url:WEB+'/connect-extension?request='+data.request_id});return {pairing:publicView(data)};
  }
  const p=await saved();if(!p)throw new Error('Pairing ended. Start a new connection.');
  if(Date.parse(p.expires_at)<=Date.now()){p.status='EXPIRED';await chrome.storage.session.set({pairing:p});return {pairing:publicView(p)};}
  const data=await call('/auth/extension/pairings/status',{request_id:p.request_id,polling_secret:p.polling_secret});
  if(!['PENDING','APPROVED','REVOKED','EXPIRED','EXHAUSTED'].includes(data.status))throw new Error('Invalid connection status');
  p.status=data.status;await chrome.storage.session.set({pairing:p});return {pairing:publicView(p)};
 }finally{busy=false;}
}
