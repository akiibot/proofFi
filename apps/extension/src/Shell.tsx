import {useState,type ReactNode} from 'react';
import {Brand} from '@prooffi/ui';
import {logout} from '@/lib/session';
import {navigate} from './router';
import {WEB} from './policy.mjs';
export function AppShell({children,current}:{children:ReactNode;current:string}){
 const [error,setError]=useState('');
 const popup=document.body.dataset.surface==='popup';
 async function signOut(){try{await logout();navigate('/login');}catch{setError('Could not sign out. Try again.');}}
 async function panel(){const currentWindow=await chrome.windows.getCurrent();if(currentWindow.id!==undefined)await chrome.sidePanel.open({windowId:currentWindow.id});}
 return <div className="extension-shell"><header><a className="brand" href="/"><Brand/></a><span className="badge">Base Sepolia</span><a href="/settings" aria-label="Settings">⚙</a></header>
 <nav aria-label="Screens"><a href="/" aria-current={current==='/'?'page':undefined}>Home</a><a href="/workspace" aria-current={current==='/workspace'?'page':undefined}>Plan</a><a href="/audit" aria-current={current==='/audit'?'page':undefined}>Activity</a></nav>
 {error&&<p role="alert">{error}</p>}{popup&&<div className="actions"><button onClick={()=>void panel()}>Open side panel</button></div>}
 <main>{children}</main><details><summary>All tools</summary><div className="tool-links">{[['/constitution','Constitution'],['/time-machine','Time Machine'],['/certificates','Certificates'],['/certificate-verifier','Certificate verifier'],['/red-team','Red team'],['/settings','Settings']].map(([href,label])=><a key={href} href={href}>{label}</a>)}</div></details>
 <footer><a href={WEB} target="_blank" rel="noreferrer">Open full workspace</a><button className="secondary" onClick={()=>void signOut()}>Sign out</button></footer></div>;
}
