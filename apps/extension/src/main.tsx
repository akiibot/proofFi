import {useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {Pairing} from './Pairing';
import Login from '../../web/app/login/page';
import {HomeScreen} from '../../web/src/screens/home/HomeScreen';
import {AskScreen} from '../../web/src/screens/ask/AskScreen';
import {RulesScreen} from '../../web/src/screens/rules/RulesScreen';
import {Review} from './Review';
import {ActivityScreen} from '../../web/src/screens/activity/ActivityScreen';
import {StoryScreen} from '../../web/src/screens/activity/StoryScreen';
import {SecurityScreen} from '../../web/src/screens/security/SecurityScreen';
import {AppFrame} from './ExtensionFrame';
import {Settings} from './Settings';
import {ContextView} from './ContextView';
import {HistoryScreen} from '../../web/src/screens/rules/HistoryScreen';
import {CheckDialog} from '../../web/src/screens/activity/CheckDialog';
import {Popup} from './Popup';
import {navigate} from './router';
import '../../web/app/globals.css';
import './style.css';
const pages:Record<string,()=>React.JSX.Element>={'/':HomeScreen,'/ask':AskScreen,'/rules':RulesScreen,'/approve':Review,'/activity':ActivityScreen,'/activity/story':StoryScreen,'/security':SecurityScreen,'/welcome':HomeScreen,'/settings':Settings,'/context':ContextView,'/rules/history':HistoryScreen,'/activity/check':CheckDialog};
function ExtensionLogin(){const [revision,setRevision]=useState(0);return <Login key={revision}><Pairing onConnected={()=>setRevision(r=>r+1)}/></Login>;}
function App(){
 const [route,setRoute]=useState(window.location.hash.slice(1)||'/');
 useEffect(()=>{const change=()=>setRoute(window.location.hash.slice(1)||'/');window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
 const path=route.split('?')[0];const panel=document.body.dataset.surface==='panel';
 const Page=pages[path];
 if(path==='/login')return <ExtensionLogin/>;
 if(!panel&&path==='/context')return <div><header className="context-popup-header"><a href="#/">← Home</a><span>Vallet</span></header><ContextView/></div>;
 if(panel&&Page)return <AppFrame><header className="panel-nav"><a href="#/" className="vallet-brand">▰ Vallet</a><nav aria-label="Panel"><a href="#/context">This page</a><a href="#/ask">Plan</a><a href="#/rules">Rules</a><a href="#/activity">Activity</a><a href="#/settings" aria-label="Settings">⚙</a></nav></header><main className="panel-main"><Page/></main><footer>Controlled testnet companion · Local backend</footer></AppFrame>;
 return <Popup route={path}/>;
}
async function boot(){
 const state=await chrome.runtime.sendMessage({type:'BOOT'});
 if(!state||typeof state.attempts!=='object')throw new Error('Worker startup unavailable');
 for(const item of Object.values(state.attempts??{}) as {path:string;body:string}[]){if(item.path==='/execute'||item.path==='/approvals'){try{const body=JSON.parse(item.body);sessionStorage.setItem(`prooffi.${item.path==='/execute'?'execute':'approval'}.${body.certificate_id}`,JSON.stringify(body));}catch{/* Invalid identities are refused by worker and backend. */}}}
 if(document.body.dataset.surface==='panel'){
  chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session'&&typeof changes.panelRoute?.newValue==='string'){navigate(changes.panelRoute.newValue);void chrome.storage.session.remove('panelRoute');}});
  const {panelRoute}=await chrome.storage.session.get('panelRoute');if(typeof panelRoute==='string'){await chrome.storage.session.remove('panelRoute');navigate(panelRoute);}
 }
 createRoot(document.getElementById('root')!).render(<App/>);
}
void boot().catch(()=>{document.getElementById('root')!.textContent='Extension startup unavailable. Reopen Vallet; no request was sent.';});
