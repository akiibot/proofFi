 'use client';
import {useEffect,useState,useCallback} from 'react';
import {useRouter} from 'next/navigation';
import {api} from '@/lib/api';
import {writeHeaders} from '@/lib/request';
import {Page} from '@/shell/AppFrame';
import {Button} from '@/ui/Button';
import type {components} from '@/lib/schema';
export function ConnectionsScreen(){
 const router=useRouter();const [rows,setRows]=useState<components['schemas']['ExtensionConnection'][]>([]);const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);const [selected,setSelected]=useState('');
 const load=useCallback(async()=>{try{const r=await api.GET('/auth/extension/connections');if(r.response.status===401){router.replace('/login');return;}if(r.data){setRows(r.data);setMessage('');}else setMessage(r.error?.message??'Connections unavailable.');}catch{setMessage('Connections unavailable; previously loaded entries may be out of date.');}},[router]);
 useEffect(()=>{void load();},[load]);
 async function revoke(){if(!selected||busy)return;setBusy(true);try{const r=await api.POST('/auth/extension/connections/{extension_id}/revoke',{params:{path:{extension_id:selected}},headers:await writeHeaders()});if(r.data){setSelected('');await load();setMessage('Connection revoked. Its active sessions can no longer access Vallet.');}else setMessage(r.error?.message??'Revocation unavailable.');}catch{setMessage('Revocation outcome unclear. Refresh connections to check.');}finally{setBusy(false);}}
 return <Page width={760}><h1>Settings</h1><h2>Connected extensions</h2><p>Pair once from the extension. Sign-in still expires after 30 minutes. Revoking a connection ends its access immediately.</p><Button kind="secondary" onClick={()=>void load()}>Refresh connections</Button>{rows.map(row=><section key={row.extension_id} style={{padding:'24px 0',borderBottom:'1px solid var(--border)'}}><code style={{overflowWrap:'anywhere'}}>{row.extension_id}</code><p>{row.revoked_at?'Revoked':row.approved_at?'Paired':'Configured by operator'}{row.approved_at?` · Approved ${new Date(row.approved_at).toLocaleString()}`:''}</p>{!row.revoked_at&&<Button kind="secondary" disabled={busy} onClick={()=>setSelected(row.extension_id)}>Revoke connection</Button>}</section>)}{!rows.length&&!message&&<p>No connections loaded. Start pairing from your extension.</p>}{selected&&<section role="group" aria-label="Confirm revocation"><p>Revoke {selected}? A new pairing will be required.</p><Button disabled={busy} onClick={()=>void revoke()}>Confirm revocation</Button><Button kind="secondary" disabled={busy} onClick={()=>setSelected('')}>Cancel</Button></section>}{message&&<p role="status">{message}</p>}</Page>;
}
