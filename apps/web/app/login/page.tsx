'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function Login() {
  const router = useRouter();
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
    <form onSubmit={submit} style={{maxWidth:440,display:'grid',gap:16}}>
      <label htmlFor="password">Demo password</label>
      <input id="password" name="password" type="password" autoComplete="current-password" required minLength={12} maxLength={200} value={password} onChange={event=>setPassword(event.target.value)} style={{padding:14,border:'1px solid #29414b',borderRadius:6,background:'#102530'}}/>
      <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      {error && <p role="alert">{error}</p>}
    </form>
  </main>;
}
