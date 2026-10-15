'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { logout } from '@/lib/session';
import { useRouter } from 'next/navigation';
import type { components } from '@/lib/schema';

type State = components['schemas']['FinancialState'];
const money = (minor:number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(minor/100);
export default function Home() {
  const router = useRouter();
  async function signOut() { try { await logout(); router.replace('/login'); } catch { setError('Unable to sign out; please retry.'); } }
  const [state,setState] = useState<State | null>(null);
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(true);
  async function refresh() {
    setLoading(true); setError('');
    try {
      const {data,error,response} = await api.GET('/financial-state');
      if(response.status === 401) { router.replace('/login'); return; }
      if(error || !data) throw new Error(error?.message ?? 'Backend unavailable');
      setState(data);
    } catch(error) { setError(error instanceof Error ? error.message : 'Unable to load state'); setState(null); }
    finally { setLoading(false); }
  }
  // Refresh also runs from the explicit refresh button.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(()=>{ void refresh(); },[]);
  const snapshot = state?.snapshot;
  return <main>
    <header><a className="brand" href="/">ProofFi<span> / financial control</span></a><button onClick={signOut}>Sign out</button></header>
    <section className="intro"><p className="eyebrow">INTELLIGENCE PROPOSES. YOU DEFINE AUTHORITY.</p><h1>Your goals.<br/><span>Your boundaries.</span></h1><p>A shared foundation for independently verified financial actions.</p></section>
    <div className="toolbar"><div><h2>Financial overview</h2><p>Persisted demo state · synthetic USD · no real purchasing power</p></div><button onClick={refresh} disabled={loading}>{loading ? 'Loading…' : 'Refresh state'}</button></div>
    {error && <p role="alert" className="notice">{error}</p>}
    {loading && <p role="status">Connecting to the backend…</p>}
    {snapshot && !loading && <>
      <section className="cards" aria-label="Financial state">
        <article><p>Total synthetic assets</p><strong>{money(snapshot.assets.reduce((sum,a)=>sum+a.amount_minor,0))}</strong><small>State version {snapshot.version}</small></article>
        <article><p>Tuition obligation</p><strong>{money(snapshot.obligations.filter(o=>o.protected).reduce((sum,o)=>sum+o.amount_minor,0))}</strong><small>Due on simulation day 120</small></article>
        <article><p>Monthly living costs</p><strong>{money(snapshot.recurring_expenses[0]?.amount_minor ?? 0)}</strong><small>Four scheduled payments</small></article>
      </section>
      <section className="panels"><article><p className="eyebrow">PRIMARY GOAL</p><h2>{snapshot.goal.text}</h2><p className="notice">Policy activation is pending. Planning, simulation, certificates, approvals and execution are not implemented yet.</p><p>Active constitution: <b>{state.active_constitution_version ?? 'None — draft requires confirmation'}</b></p><p>Chain execution: <b>Not configured</b></p></article><article><p className="eyebrow">VISIBLE ASSUMPTIONS</p><h2>Start with the full picture</h2><ul>{snapshot.assumptions.map(a=><li key={a}>{a}</li>)}</ul></article></section>
      <section className="integrity"><h2>State integrity</h2><p>The browser fetched this snapshot from the real backend database.</p><code>{state.snapshot_hash}</code></section>
    </>}
    <footer>ProofFi separates financial intelligence from financial authority.<span>API v1.1.0 · testnet demo</span></footer>
  </main>;
}
