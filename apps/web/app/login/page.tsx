'use client';
import { useState, useSyncExternalStore } from 'react';
import { api } from '@/lib/api';
import { invalidateAccess, loadAccess, notifyAuthChange } from '@/lib/access';
import { clearGuestStorage } from '@/lib/scope-storage';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/form';
import { Logo } from '@/ui/kit';
import styles from '@/screens/auth/auth.module.css';

const subscribeToHydration = () => () => undefined;
const clientSnapshot = () => true;
const serverSnapshot = () => false;

export default function Login() {
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const [password,setPassword] = useState('');
  const [error,setError] = useState('');
  const [demoError,setDemoError] = useState('');
  const [busy,setBusy] = useState<'operator' | 'judge' | null>(null);
  async function enter(mode: 'operator' | 'judge') {
    if (busy) return;
    setBusy(mode); setError(''); setDemoError('');
    let previous = null;
    let switching = false;
    try {
      previous = await loadAccess().catch(() => null);
      notifyAuthChange('begin'); switching = true; invalidateAccess();
      const result = mode === 'judge'
        ? await api.POST('/auth/judge', { body: { profile_id: 'synthetic-funded-demo-v1', accept_synthetic_assumptions: true } })
        : await api.POST('/auth/login', { body: { password } });
      if (result.error || !result.data) throw new Error(result.error?.message ?? 'Unable to enter');
      clearGuestStorage(previous); setPassword('');
      let target = '/';
      if (mode === 'operator') {
        const response = await fetch('/api/backend/financial-state', { cache: 'no-store' });
        if (response.ok && !(await response.json()).active_constitution_version) target = '/welcome';
      }
      notifyAuthChange('end'); switching = false;
      window.location.replace(target);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Unable to enter';
      if (mode === 'judge') setDemoError(message); else setError(message);
    } finally {
      if (switching) notifyAuthChange('end');
      setBusy(null);
    }
  }
  return <main className={styles.center}>
    <Logo />
    <section className={styles.card} aria-labelledby="demo-title">
      <h1 id="demo-title" className="t-h3">Try Vallet</h1>
      <p>Explore with $17,000 synthetic cash in your own disposable sandbox. Real planning and verification; sending is disabled.</p>
      <p>Your demo lasts 30 minutes. Rules need your explicit confirmation. Your changes stay in this demo.</p>
      <details><summary>Demo assumptions</summary><p>No income; $7,000 tuition and $3,200 living obligations. 1,000 paths over 120 days, seed 18421, 2% daily volatility, a 20% chance of an additional $2,000 emergency, and a $1 synthetic planning fee. These are demonstration inputs, not predictions or live fees.</p></details>
      <p>By launching, you accept these synthetic assumptions.</p>
      {demoError && <p role="alert">{demoError}</p>}
      <Button kind="primary" size="lg" wide disabled={!hydrated || busy !== null} busy={busy === 'judge'} onClick={() => void enter('judge')}>{busy === 'judge' ? 'Launching…' : 'Launch demo'}</Button>
    </section>
    <form method="post" onSubmit={event => { event.preventDefault(); void enter('operator'); }} className={styles.card} aria-labelledby="sign-in-title">
      <h2 id="sign-in-title" className="t-h3">Sign in</h2>
      <p>Operator access with your private demo password.</p>
      <Field id="password" name="password" type="password" label="Demo password" autoComplete="current-password" required minLength={12} maxLength={200}
        disabled={!hydrated || busy !== null} value={password} onChange={event=>setPassword(event.target.value)} error={error || undefined} />
      <Button type="submit" kind="secondary" size="lg" wide disabled={!hydrated || busy !== null} busy={busy === 'operator'}>{busy === 'operator' ? 'Signing in…' : 'Sign in'}</Button>
      <noscript>Enable JavaScript to sign in or launch the demo.</noscript>
    </form>
    <p className={styles.footnote}>Testnet demo · synthetic money</p>
  </main>;
}
