import {observedSender,pageIdentity,redact,safePageUrl,validPreview,type Preview} from './context-policy.mjs';
const ORIGINS=['http://*/*','https://*/*'];
const registration={id:'vallet-context',matches:ORIGINS,js:['observer.js'],runAt:'document_idle' as const,allFrames:false,persistAcrossSessions:true};
export async function refreshPagePermission(clearOnRevocation=false){
 const enabled=await chrome.permissions.contains({origins:ORIGINS});
 await chrome.scripting.unregisterContentScripts({ids:[registration.id]}).catch(()=>{});
 if(enabled)await chrome.scripting.registerContentScripts([registration]);
 else if(clearOnRevocation){
  const values=await chrome.storage.session.get(null);
  await chrome.storage.session.remove(Object.keys(values).filter(key=>key.startsWith('page:')||key==='pagePreview'));
  await chrome.action.setBadgeText({text:''});
 }
 return enabled;
}
export async function observePage(message:{page_kind?:unknown},sender:chrome.runtime.MessageSender){
 if(!observedSender(sender,chrome.runtime.id)||!['investment','expense','unknown'].includes(String(message.page_kind)))return {error:'Untrusted page observation'};
 const tabId=sender.tab!.id!;
 await chrome.storage.session.set({['page:'+tabId]:{page_kind:message.page_kind,source_url:safePageUrl(sender.url)}});
 await chrome.action.setBadgeBackgroundColor({color:'#FFEE6C',tabId});
 await chrome.action.setBadgeText({text:message.page_kind==='unknown'?'':'•',tabId});
 return {observed:true};
}
export async function capturePage(){
 const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
 if(tab?.id===undefined||!safePageUrl(tab.url))return {error:'Open a regular investment or bill page, then click Vallet in that tab.'};
 try{
  const navigation_key=await pageIdentity(tab.url);
  if(!navigation_key)return {error:'The page location is unavailable.'};
  await chrome.scripting.executeScript({target:{tabId:tab.id},files:['observer.js']});
  const data=await chrome.tabs.sendMessage(tab.id,{type:'VALLET_CAPTURE'});
  if(await pageIdentity((await chrome.tabs.get(tab.id)).url)!==navigation_key)return {error:'The source page changed. Capture and review it again.'};
  const preview:Preview={tabId:tab.id,navigation_key,captured_at:new Date().toISOString(),source_url:safePageUrl(tab.url)!,title:redact(data?.title).slice(0,240)||'Selected page',selected_text:redact(data?.selected_text),page_kind:['investment','expense'].includes(data?.page_kind)?data.page_kind:'unknown'};
  if(!validPreview(preview))return {error:'The page observation could not be validated.'};
  await chrome.storage.session.set({pagePreview:preview});
  return {preview};
 }catch{return {error:'Page access is unavailable. Enable access from this panel or open Vallet using the toolbar on that page.'};}
}
export async function currentPreview(){
 const value=(await chrome.storage.session.get('pagePreview')).pagePreview;
 if(!validPreview(value))return {preview:null};
 const tab=await chrome.tabs.get(value.tabId).catch(()=>null);
 if(!tab||safePageUrl(tab.url)!==value.source_url||await pageIdentity(tab.url)!==value.navigation_key){await chrome.storage.session.remove('pagePreview');return {preview:null,error:'The source page changed. Capture and review it again.'};}
 return {preview:value};
}
export async function validateAnalysis(raw:string|null){
 try{
  const body=JSON.parse(raw??'null');const current=await currentPreview();
  if(!current.preview||body?.source_url!==current.preview.source_url||body?.research_consent!==true)return false;
  return typeof body.selected_text==='string'&&body.selected_text===redact(body.selected_text)&&body.selected_text.length<=6000&&typeof body.title==='string'&&body.title.length<=240;
 }catch{return false;}
}
chrome.permissions.onAdded.addListener(()=>{void refreshPagePermission();});
chrome.permissions.onRemoved.addListener(()=>{void refreshPagePermission(true);});
chrome.tabs.onRemoved.addListener(id=>{void chrome.storage.session.remove('page:'+id);});
chrome.tabs.onUpdated.addListener((id,change)=>{if(change.status==='loading'){void chrome.action.setBadgeText({tabId:id,text:''});void chrome.storage.session.remove('page:'+id);}});
