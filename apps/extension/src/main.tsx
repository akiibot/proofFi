import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import Home from '../../web/app/page';
import Login from '../../web/app/login/page';
import Constitution from '../../web/app/constitution/page';
import Workspace from '../../web/app/workspace/page';
import Simulation from '../../web/app/time-machine/page';
import Certificates from '../../web/app/certificates/page';
import Verifier from '../../web/app/certificate-verifier/page';
import Audit from '../../web/app/audit/page';
import Attack from '../../web/app/red-team/page';
import Settings from '../../web/app/settings/page';
import {navigate} from './router';
import {Popup} from './Popup';
import '../../web/app/globals.css';
import './style.css';
const pages:Record<string,()=>React.JSX.Element>={'/':Home,'/login':Login,'/constitution':Constitution,'/workspace':Workspace,'/time-machine':Simulation,'/certificates':Certificates,'/certificate-verifier':Verifier,'/audit':Audit,'/red-team':Attack,'/settings':Settings};
function App(){
 const [route,setRoute]=useState(window.location.hash.slice(1)||'/');
 useEffect(()=>{const change=()=>setRoute(window.location.hash.slice(1)||'/');window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
 useEffect(()=>{const click=(e:MouseEvent)=>{const a=(e.target as Element).closest('a');if(!a)return;const href=a.getAttribute('href');if(href?.startsWith('/')&&!href.startsWith('//')){e.preventDefault();navigate(href);}};document.addEventListener('click',click);return()=>document.removeEventListener('click',click);},[]);
 const path=route.split('?')[0];
 const popup=document.body.dataset.surface==='popup';
 const Page=pages[path]??Home;
 if(popup&&path!=='/login')return <Popup key={path} route={path}/>;
 return <Page key={route}/>;
}
async function boot(){
 const state=await chrome.runtime.sendMessage({type:'BOOT'});
 if(!state||typeof state.attempts!=='object')throw new Error('Worker startup unavailable');
 for(const item of Object.values(state?.attempts??{}) as {path:string;body:string}[]){if(item.path==='/execute'||item.path==='/approvals'){try{const body=JSON.parse(item.body);sessionStorage.setItem(`prooffi.${item.path==='/execute'?'execute':'approval'}.${body.certificate_id}`,JSON.stringify(body));}catch{/* Backend and worker refuse malformed authority. */}}}
 if(document.body.dataset.surface==='panel'){chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session'&&typeof changes.panelRoute?.newValue==='string'){navigate(changes.panelRoute.newValue);void chrome.storage.session.remove('panelRoute');}});const {panelRoute}=await chrome.storage.session.get('panelRoute');if(typeof panelRoute==='string'){await chrome.storage.session.remove('panelRoute');navigate(panelRoute);}}
 createRoot(document.getElementById('root')!).render(<App/>);
}
void boot().catch(()=>{document.getElementById('root')!.textContent='Extension startup unavailable. Reopen ProofFi; no request was sent.';});
