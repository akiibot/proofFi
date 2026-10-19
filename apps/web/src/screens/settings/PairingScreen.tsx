 'use client';
import {useEffect,useState} from 'react';
import {useSearchParams,useRouter} from 'next/navigation';
import {api} from '@/lib/api';
import {writeHeaders} from '@/lib/request';
import type {components} from '@/lib/schema';
import {Button} from '@/ui/Button';
import {Logo} from '@/ui/kit';
import styles from '@/screens/auth/auth.module.css';
import pairing from './pairing.module.css';
export function PairingScreen(){
 const request=useSearchParams().get('request')??'';const router=useRouter();
 const [details,setDetails]=useState<components['schemas']['PairingDetails']|null>(null);
 const [code,setCode]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);
 useEffect(()=>{let alive=true;if(!/^pair-[0-9a-f]{32}$/.test(request)){setMessage('Invalid connection link. Start from the Vallet extension.');return;}
 void api.GET('/auth/extension/pairings/{request_id}',{params:{path:{request_id:request}}}).then(r=>{if(!alive)return;if(r.response.status===401){sessionStorage.setItem('vallet.pairing.return',request);router.replace('/login');return;}if(r.data)setDetails(r.data);else setMessage(r.error?.message??'Connection unavailable.');}).catch(()=>{if(alive)setMessage('Backend unavailable. Start your local companion, then reopen this page.');});return()=>{alive=false;};},[request,router]);
 async function approve(e:React.FormEvent){e.preventDefault();if(busy||done||code.length!==8)return;setBusy(true);setMessage('');try{const r=await api.POST('/auth/extension/pairings/{request_id}/approve',{params:{path:{request_id:request}},headers:await writeHeaders(),body:{code}});if(r.response.status===401){sessionStorage.setItem('vallet.pairing.return',request);router.replace('/login');return;}if(r.data){setDone(true);setDetails(d=>d?{...d,status:'APPROVED'}:d);setCode('');setMessage('Connected. Return to the extension and sign in.');}else setMessage(r.error?.message??'Approval unavailable.');}catch{setMessage('Approval outcome unclear. Check Connected extensions in Settings before trying again.');}finally{setBusy(false);}}
 const connected=done||details?.status==='APPROVED';
 return <main className={styles.center}><Logo/><section className={`${styles.card} ${pairing.card}`}>
  <p className={pairing.eyebrow}>{connected?'SETUP COMPLETE':'STEP 2 OF 3 · WEBSITE CONFIRMATION'}</p>
  <h1 className="t-h3">{connected?'Extension connected':'Connect your extension'}</h1>
  <p>{connected?'You can close this tab. Open Vallet from your browser toolbar and sign in with your demo password.':'Enter the code from your Vallet extension to approve this installation.'}</p>
  <ol className={pairing.steps} aria-label="Connection steps"><li>Start in extension</li><li aria-current={connected?undefined:'step'}>Confirm here</li><li aria-current={connected?'step':undefined}>Sign in to extension</li></ol>
  {details&&<>{details.status==='PENDING'&&!done?<form className={pairing.form} onSubmit={e=>void approve(e)}>
   <label className={pairing.label} htmlFor="pair-code">Code shown in your extension</label>
   <p id="pair-code-help" className={pairing.help}>Open the yellow Vallet icon in your browser toolbar. Copy its 8-character code and paste it below.</p>
   <input className={pairing.input} id="pair-code" name="pairing-code" type="text" autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="ABCD 2345" aria-describedby="pair-code-help pair-code-count" value={code} maxLength={19} disabled={busy} onChange={e=>setCode(e.target.value.toUpperCase().replace(/[\s-]/g,'').slice(0,8))}/>
   <p id="pair-code-count" className={pairing.help}>{code.length}/8 characters · Expires at {new Date(details.expires_at).toLocaleTimeString()}</p>
   <Button type="submit" kind="primary" size="lg" wide busy={busy} disabled={code.length!==8}>{busy?'Connecting…':'Allow this extension'}</Button>
  </form>:!connected&&<p role="status">This request is {details.status.toLowerCase()}. Return to the extension and start a new connection for a fresh code.</p>}
  <details className={pairing.identity}><summary>Check the requesting extension</summary><p>Only approve a request you started yourself.</p><p>Extension ID</p><code>{details.extension_id}</code><p>Status: {details.status}</p></details></>}
  {!details&&!message&&<p role="status">Loading your connection request…</p>}
  {message&&<p className={pairing.notice} role="status">{message}</p>}
  <p className={pairing.help}>This permits sign-in only. It never approves a payment or enables signing.</p>
  <a className={pairing.link} href="/settings">Manage connected extensions in Settings</a>
 </section></main>;
}
