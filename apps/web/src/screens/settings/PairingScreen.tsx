 'use client';
import {useEffect,useState} from 'react';
import {useSearchParams,useRouter} from 'next/navigation';
import {api} from '@/lib/api';
import {writeHeaders} from '@/lib/request';
import type {components} from '@/lib/schema';
import {Button} from '@/ui/Button';
import {Logo} from '@/ui/kit';
import styles from '@/screens/auth/auth.module.css';
export function PairingScreen(){
 const request=useSearchParams().get('request')??'';const router=useRouter();
 const [details,setDetails]=useState<components['schemas']['PairingDetails']|null>(null);
 const [code,setCode]=useState('');const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [done,setDone]=useState(false);
 useEffect(()=>{let alive=true;if(!/^pair-[0-9a-f]{32}$/.test(request)){setMessage('Invalid connection link. Start from the Vallet extension.');return;}
 void api.GET('/auth/extension/pairings/{request_id}',{params:{path:{request_id:request}}}).then(r=>{if(!alive)return;if(r.response.status===401){sessionStorage.setItem('vallet.pairing.return',request);router.replace('/login');return;}if(r.data)setDetails(r.data);else setMessage(r.error?.message??'Connection unavailable.');}).catch(()=>{if(alive)setMessage('Backend unavailable. Reopen this page to check the connection.');});return()=>{alive=false;};},[request,router]);
 async function approve(e:React.FormEvent){e.preventDefault();if(busy||done)return;setBusy(true);setMessage('');try{const r=await api.POST('/auth/extension/pairings/{request_id}/approve',{params:{path:{request_id:request}},headers:await writeHeaders(),body:{code}});if(r.response.status===401){sessionStorage.setItem('vallet.pairing.return',request);router.replace('/login');return;}if(r.data){setDone(true);setDetails(d=>d?{...d,status:'APPROVED'}:d);setCode('');setMessage('Connected. Return to the extension and sign in.');}else setMessage(r.error?.message??'Approval unavailable.');}catch{setMessage('Approval outcome unclear. Check Connected extensions in Settings before trying again.');}finally{setBusy(false);}}
 return <main className={styles.center}><Logo/><section className={styles.card}><h1 className="t-h3">Connect your extension</h1><p>Only approve a connection you started from Vallet in your browser.</p>{details&&<><p>Extension ID</p><code style={{overflowWrap:'anywhere'}}>{details.extension_id}</code><p>Status: {details.status} · Expires {new Date(details.expires_at).toLocaleTimeString()}</p><p>This permits sign-in only. It never approves a payment or enables signing.</p>{details.status==='PENDING'&&!done&&<form onSubmit={e=>void approve(e)}><label htmlFor="pair-code">Code shown in your extension</label><input id="pair-code" autoComplete="off" spellCheck={false} value={code} maxLength={8} onChange={e=>setCode(e.target.value.toUpperCase())}/><Button type="submit" disabled={busy||code.length!==8}>Allow this extension</Button></form>}</>}{message&&<p role="status">{message}</p>}<a href="/settings">Connected extensions in Settings</a></section></main>;
}
