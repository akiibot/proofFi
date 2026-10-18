import {useEffect,useState} from 'react';
import {Brand,ThemeControl} from '@prooffi/ui';
import {api} from './api';
import {logout} from '../../web/src/lib/session';
import {navigate} from './router';
import {WEB} from './policy.mjs';
import {formatUsd} from '../../web/src/lib/format';
import type {components} from '../../web/src/lib/schema';
type FinancialState=components['schemas']['FinancialState'];
export function Popup({route}:{route:string}){
 const [windowId,setWindowId]=useState<number|undefined>(undefined);
 const [state,setState]=useState<FinancialState|null>(null);
 const [rules,setRules]=useState<components['schemas']['ConstitutionRules']|null>(null);
 const [connection,setConnection]=useState('Checking…');
 const [goal,setGoal]=useState('');
 const [events,setEvents]=useState<components['schemas']['AuditEvent'][]>([]);
 const [problem,setProblem]=useState('');
 async function panel(path:string){if(windowId===undefined){setProblem('Browser window is unavailable. Reopen the extension.');return;}try{const saved=chrome.storage.session.set({panelRoute:path});const opened=chrome.sidePanel.open({windowId});await Promise.all([saved,opened]);}catch{setProblem('The browser could not open the side panel. Reopen ProofFi or use the full workspace.');}}
 useEffect(()=>{let alive=true;void chrome.windows.getCurrent().then(w=>{if(alive)setWindowId(w.id);});async function load(){const [s,c,a,h]=await Promise.all([api.GET('/financial-state'),api.GET('/chain/status'),api.GET('/audit'),api.GET('/constitutions/history')]);if(!alive)return;if(s.response.status===401){navigate('/login');return;}if(!s.data){setProblem(s.error?.message??'Backend unavailable');return;}setState(s.data);setRules(h.data?.find(v=>v.id===s.data?.active_constitution_version)?.rules??null);setGoal(s.data.snapshot.goal.text);setConnection(c.data?.status??'Unavailable');setEvents(a.data??[]);}void load().catch(()=>setProblem('Backend unavailable'));return()=>{alive=false;};},[]);
 return <div className="extension-shell"><header><Brand/><span className="badge">Testnet</span><a href="/settings" aria-label="Settings">⚙</a></header><nav aria-label="Screens"><a href="/">Home</a><a href="/workspace">Plan</a><a href="/audit">Activity</a></nav>
 {problem&&<p role="alert">{problem}</p>}{!state&&!problem&&<p role="status">Loading your financial state…</p>}
 {route==='/'&&<><h1>Overview</h1>{state&&<><p>Total synthetic assets</p><strong className="popup-balance">{formatUsd(state.snapshot.assets.reduce((n,a)=>n+a.amount_minor,0))}</strong><p className="hint">Run a plan to calculate an available amount.</p><dl className="rule-list">{state.snapshot.obligations.filter(o=>o.protected).map(o=><div key={o.id}><dt>{o.name}</dt><dd>{formatUsd(o.amount_minor)}</dd></div>)}{rules&&<div><dt>Emergency floor</dt><dd>{formatUsd(rules.emergency_floor_minor)}</dd></div>}<div><dt>Scheduled recurring costs</dt><dd>{formatUsd(state.snapshot.recurring_expenses.reduce((n,e)=>n+e.amount_minor*e.due_days.length,0))}</dd></div></dl><p>Rules: {state.active_constitution_version?'Confirmed':'Not confirmed'}</p><p>Chain: {connection}</p><button onClick={()=>navigate('/workspace')}>Create a plan</button></>}</>}
 {route==='/workspace'&&<><h1>Create a plan</h1><label className="field">Your goal<textarea value={goal} maxLength={2000} onChange={e=>setGoal(e.target.value)}/></label><p className="hint">Proposals are untrusted until independently checked. Detailed results stay open in the side panel.</p><button disabled={!goal.trim()||windowId===undefined} onClick={()=>void panel('/workspace?goal='+encodeURIComponent(goal.trim()))}>Continue planning</button></>}
 {route==='/audit'&&<><h1>Activity</h1>{events.length?<ul className="checks">{[...events].sort((a,b)=>b.sequence-a.sequence).slice(0,6).map(e=><li key={e.id}>#{e.sequence} {e.event_type.replaceAll('_',' ').toLowerCase()}</li>)}</ul>:<p>No recorded activity.</p>}<button onClick={()=>void panel('/audit')}>View complete audit</button></>}
 {route==='/settings'&&<><h1>Settings</h1><ThemeControl/><p className="hint">Backend: {WEB.replace(':3000',':8000')}<br/>Extension ID: <code>{chrome.runtime.id}</code></p><button onClick={()=>void panel('/settings')}>Connection and maintenance</button><p className="hint">Sign-in expires and is cleared when the browser restarts.</p><button className="secondary" onClick={()=>void logout().then(()=>navigate('/login')).catch(()=>setProblem('Could not sign out. Try again.'))}>Sign out</button></>}
 {!['/','/workspace','/audit','/settings'].includes(route)&&<><h1>Continue in the side panel</h1><button onClick={()=>void panel(route)}>Open side panel</button></>}
 <footer><a href={WEB} target="_blank" rel="noreferrer">Open full workspace</a></footer></div>;
}
