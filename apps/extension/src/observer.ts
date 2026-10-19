import {classify,redact} from './context-policy.mjs';
// Isolated world only. No page scripts, form values, credentials or API calls.
const marker='data-vallet-observer';
if(!document.documentElement.hasAttribute(marker)){
 document.documentElement.setAttribute(marker,'1');
 const EXCLUDE='form,input,textarea,select,[contenteditable],[role="textbox"],[data-private],[data-sensitive],script,style,nav,header,footer';
 function excerpt(){
  const nodes=[...document.querySelectorAll('main h1,main h2,main p,main li,main dt,main dd,article h1,article h2,article p,article li,main th,main td,article th,article td,[role="main"] h1,[role="main"] h2,[role="main"] p,[role="main"] li,[role="main"] dt,[role="main"] dd,[role="main"] th,[role="main"] td,h1')].slice(0,180);
  const lines=nodes.filter(node=>!node.closest(EXCLUDE)&&node.getClientRects().length>0)
   .map(node=>node.textContent?.trim()??'').filter(line=>line.length>0&&line.length<900);
  return redact([...new Set(lines)].join('\n'));
 }
 let prior='',timer:ReturnType<typeof setTimeout>|undefined;
 function detect(){const page_kind=classify(excerpt());const key=location.pathname+':'+page_kind;if(key===prior)return;prior=key;void chrome.runtime.sendMessage({type:'PAGE_OBSERVED',page_kind}).catch(()=>{});}
 const observer=new MutationObserver(()=>{clearTimeout(timer);timer=setTimeout(detect,700);});
 observer.observe(document.body??document.documentElement,{childList:true,subtree:true,characterData:true});
 window.addEventListener('popstate',detect);window.addEventListener('hashchange',detect);
 // pushState does not always mutate the DOM; compare only local route identity.
 const interval=setInterval(detect,2000);
 window.addEventListener('pagehide',()=>{observer.disconnect();clearInterval(interval);clearTimeout(timer);},{once:true});
 chrome.runtime.onMessage.addListener((message,_sender,respond)=>{
  if(message?.type==='VALLET_CAPTURE'){const text=excerpt();respond({title:redact(document.title).slice(0,240),selected_text:text,page_kind:classify(text)});}
  return false;
 });
 detect();
}
