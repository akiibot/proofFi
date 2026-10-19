import {classify,redact} from './context-policy.mjs';
// Isolated world only. No page scripts, form values, credentials or API calls.
const marker='data-vallet-observer';
if(!document.documentElement.hasAttribute(marker)){
 document.documentElement.setAttribute(marker,'1');
 const EXCLUDE='form,input,textarea,select,[contenteditable],[role="textbox"],[data-private],[data-sensitive],script,style,nav,header,footer,aside,[hidden],[aria-hidden="true"]';
 function excluded(node:Element){
  let current:Element|null=node;
  while(current){if(current.closest(EXCLUDE))return true;const root=current.getRootNode();current=root instanceof ShadowRoot?root.host:null;}
  return false;
 }
 function excerpt(){
  const roots:ParentNode[]=[document];
  for(let i=0;i<roots.length&&roots.length<12;i++){
   for(const host of [...roots[i].querySelectorAll('*')].slice(0,2000))if(host.shadowRoot&&!excluded(host)&&roots.length<12)roots.push(host.shadowRoot);
  }
  const lines:string[]=[];
  for(const root of roots){
   const regions=[...root.querySelectorAll('main,[role="main"],article')].filter(node=>!excluded(node)&&node.getClientRects().length>0);
   for(const region of regions.length?regions:[root]){
    const nodes=[...region.querySelectorAll('h1,h2,h3,p,li,dt,dd,th,td,span,div')].slice(0,2000);
    for(const node of nodes){
     if(excluded(node)||!node.getClientRects().length||(['SPAN','DIV'].includes(node.tagName)&&node.childElementCount))continue;
     if(node.querySelector('form,input,textarea,select,[contenteditable],[data-private],[data-sensitive]'))continue;
     const line=(node as HTMLElement).innerText?.trim()??'';
     if(line.length>0&&line.length<900&&!lines.includes(line))lines.push(line);
     if(lines.length>=240)break;
    }
    if(lines.length>=240)break;
   }
   if(lines.length>=240)break;
  }
  return redact(lines.join('\n'));
 }
 let prior='',timer:ReturnType<typeof setTimeout>|undefined;
 function detect(){const page_kind=classify(redact(document.title)+'\n'+excerpt());const key=location.pathname+':'+page_kind;if(key===prior)return;prior=key;void chrome.runtime.sendMessage({type:'PAGE_OBSERVED',page_kind}).catch(()=>{});}
 const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(detect,700);});
 observer.observe(document.body??document.documentElement,{childList:true,subtree:true,characterData:true});
 window.addEventListener('popstate',detect);window.addEventListener('hashchange',detect);
 // pushState does not always mutate the DOM; compare only local route identity.
 const interval=setInterval(detect,2000);
 window.addEventListener('pagehide',()=>{observer.disconnect();clearInterval(interval);clearTimeout(timer);},{once:true});
 chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
  if(message?.type==='VALLET_CAPTURE'){const text=excerpt();respond({title:redact(document.title).slice(0,240),selected_text:text,page_kind:classify(redact(document.title)+'\n'+text)});}
  return false;
 });
 detect();
}
