'use client';
import { useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { run } from '@/lib/request';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/form';
import { Logo } from '@/ui/kit';
import styles from '@/screens/auth/auth.module.css';

const subscribeToHydration = () => () => undefined;
const clientSnapshot = () => true;
const serverSnapshot = () => false;

/** Figma "01 Sign in". */
export function SignInScreen({children}:{children?:React.ReactNode}) {
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
      setPassword('');
      // First run teaches the idea once: it shows while no rules are active yet.
      const state = await run(() => api.GET('/financial-state'));
      const pairing = sessionStorage.getItem('vallet.pairing.return');
      sessionStorage.removeItem('vallet.pairing.return');
      router.replace(pairing && /^pair-[0-9a-f]{32}$/.test(pairing) ? `/connect-extension?request=${pairing}` : state.ok && !state.data.active_constitution_version ? '/welcome' : '/');
    } catch(error) { setError(error instanceof Error ? error.message : 'Unable to sign in'); }
    finally { setBusy(false); }
  }
  return <main className={styles.center}>
    <Logo />
    {children}
    <form method="post" onSubmit={submit} className={styles.card} aria-labelledby="sign-in-title" noValidate={false}>
      <h1 id="sign-in-title" className="t-h3">Sign in</h1>
      <Field id="password" name="password" type="password" label="Demo password" autoComplete="current-password" required minLength={12} maxLength={200}
        disabled={!hydrated} value={password} onChange={event=>setPassword(event.target.value)} error={error || undefined} />
      <Button type="submit" kind="primary" size="lg" wide disabled={!hydrated} busy={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      <noscript>Enable JavaScript to sign in.</noscript>
    </form>
    <section className={styles.extension} aria-labelledby="extension-download-title">
      <h2 id="extension-download-title">Get the Vallet browser extension</h2>
      <p>Preview for Chrome 116+ and Brave. This extension currently requires a separately running local Vallet companion; it does not connect to this hosted site yet.</p>
      <a className={styles.download} href="/downloads/vallet-extension-0.1.0.zip" download>
        Download extension (.zip)
      </a>
      <details>
        <summary>Installation steps</summary>
        <ol>
          <li>Download and extract the ZIP file.</li>
          <li>Open <code>chrome://extensions</code> or <code>brave://extensions</code> and turn on Developer mode.</li>
          <li>Choose <strong>Load unpacked</strong> and select the extracted folder.</li>
        </ol>
      </details>
    </section>
    <p className={styles.footnote}>A testnet demo. No real money moves.</p>
  </main>;
}
