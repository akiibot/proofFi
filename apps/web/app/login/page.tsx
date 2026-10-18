'use client';
import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

const subscribeToHydration = () => () => undefined;
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export default function Login() {
  const router = useRouter();
  // SSR controls stay disabled until React has installed the submit handler.
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const [password,setPassword] = useState('');
  const [error,setError] = useState('');
  const [busy,setBusy] = useState(false);
  async function submit(event:React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const {data,error} = await api.POST('/auth/login',{body:{password}});
      if(error || !data) throw new Error(error?.message ?? 'Unable to sign in');
      setPassword(''); router.replace('/');
    } catch(error) { setError(error instanceof Error ? error.message : 'Unable to sign in'); }
    finally { setBusy(false); }
  }
  return <main><header><a className="brand" href="/">ProofFi</a><span className="badge">DEMO ACCESS</span></header>
    <section className="intro"><p className="eyebrow">YOUR FINANCIAL WORKSPACE</p><h1>Sign in to<br/><span>ProofFi.</span></h1><p>Use the demo password provided by your project lead.</p></section>
    <form method="post" onSubmit={submit} style={{maxWidth:440,display:'grid',gap:16}}>
      <label htmlFor="password">Demo password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required minLength={12} maxLength={200} disabled={!hydrated} value={password} onChange={event=>setPassword(event.target.value)} style={{padding:14,border:'1px solid var(--line)' ,borderRadius:6,background:'var(--card)' }}/>
      <button type="submit" disabled={!hydrated || busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      <noscript>Enable JavaScript to sign in.</noscript>
      {error && <p role="alert">{error}</p>}
    </form>
  </main>;
}
