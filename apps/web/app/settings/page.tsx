'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeControl, Panel } from '@prooffi/ui';
import { AppShell } from '@/components/shell/AppShell';
import { api } from '@/lib/api';
import { run, writeHeaders } from '@/lib/request';

export default function SettingsPage() {
 const router=useRouter();
 const [health,setHealth]=useState('Checking…');
 const [chain,setChain]=useState('Checking…');
 const [agreed,setAgreed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [uncertain,setUncertain]=useState(false);
 const [message,setMessage]=useState('');
 const inFlight=useRef(false);
 const inspect=useCallback(async () => {
  const [h,c]=await Promise.all([run(()=>api.GET('/health')),run(()=>api.GET('/chain/status'))]);
  if(!c.ok&&c.expired) {router.replace('/login');return;}
  setHealth(h.ok?'Backend and migrations available':h.problem.message);
  setChain(c.ok?`${c.data.status}: ${c.data.reason}`:c.problem.message);
 },[router]);
 useEffect(()=>{void inspect();},[inspect]); // Read-only observations; no runtime settings activated.
 async function reset() {
  if(!agreed||inFlight.current||uncertain)return;
  inFlight.current=true;setBusy(true);setAgreed(false);setMessage('');
  try {
   let headers:Record<string,string>;
   try {headers=await writeHeaders();} catch {setMessage('Session unavailable. Reset was not sent.');return;}
   const out=await run(()=>api.POST('/demo/reset',{headers}));
   if(out.ok)setMessage(`Recorded funded selection restored as state version ${out.data.snapshot.version}. Policy and history retained.`);
   else {if(out.expired)router.replace('/login');setUncertain(out.problem.httpStatus===0||out.problem.httpStatus>=500);setMessage(out.problem.message);}
  } finally {setBusy(false);inFlight.current=false;}
 }
 return <AppShell current="/settings"><section className="page-head"><p className="eyebrow">YOUR WORKSPACE</p><h1>Settings</h1><p>Appearance, connection observations and deliberate demo maintenance.</p></section>
 <Panel title="Appearance"><ThemeControl /></Panel>
 <Panel title="Connection readiness"><dl className="rule-list"><div><dt>Backend</dt><dd>{health}</dd></div><div><dt>Base Sepolia</dt><dd>{chain}</dd></div></dl><button type="button" className="secondary" onClick={()=>void inspect()}>Check connection</button><p className="hint">Connectivity is separate from policy, approval and execution authorization. Private keys and provider credentials stay on the backend.</p></Panel>
 <section className="editor danger-zone" aria-label="Demo maintenance"><h2>Demo maintenance</h2><p>Restore only the recorded funded selection as a new state version. The backend refuses after any execution history. This does not erase history, change policy or recover chain funds.</p><label className="check"><input type="checkbox" checked={agreed} disabled={busy||uncertain} onChange={e=>setAgreed(e.target.checked)}/>I want to restore the recorded funded demo selection.</label><button type="button" disabled={!agreed||busy||uncertain} onClick={()=>void reset()}>{busy?'Restoring…':'Restore recorded demo'}</button>{message&&<p role="status" className="notice">{message}</p>}{uncertain&&<p role="alert">The outcome is unknown. Check state and audit; another submission is disabled to prevent a blind repeat.</p>}</section>
 </AppShell>;
}
