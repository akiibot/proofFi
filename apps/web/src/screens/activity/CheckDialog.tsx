'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { run, writeHeaders } from '@/lib/request';
import { CERTIFICATE_ID, statusMeaning, type CertificateStatus } from '@/components/certificates/status';
import { Button } from '@/ui/Button';
import { Field } from '@/ui/form';
import { Status, type StatusState } from '@/ui/kit';
import { Dialog } from '@/ui/overlay';
import styles from './activity.module.css';

type Result = { status: CertificateStatus; id: string };

/**
 * Which separate facts the single backend status settles. The verifier returns one status, so a check is listed only when
 * that status decides it: everything passes for VALID / APPROVAL_REQUIRED, and only the failing fact (plus what the
 * signature and the status rule out) is shown otherwise.
 */
function checks(r: Result): { label: string; state: StatusState }[] {
  const s = r.status.status;
  const ok = s === 'VALID' || s === 'APPROVAL_REQUIRED';
  const out: { label: string; state: StatusState }[] = [{ label: 'Signature is genuine', state: r.status.signature_valid ? 'pass' : 'fail' }];
  if (s === 'TAMPERED') { out.push({ label: 'Not tampered with', state: 'fail' }); return out; }
  out.push({ label: 'Not tampered with', state: 'pass' });
  if (ok || s === 'SIGNED_BUT_STALE') out.push({ label: 'Matches your current money and rules', state: s === 'SIGNED_BUT_STALE' ? 'fail' : 'pass' });
  if (ok || s === 'ALREADY_USED') out.push({ label: 'Never used', state: s === 'ALREADY_USED' ? 'fail' : 'pass' });
  if (ok || s === 'EXPIRED') out.push({ label: 'Within its 5-minute window', state: s === 'EXPIRED' ? 'fail' : 'pass' });
  if (s === 'APPROVAL_REQUIRED') out.push({ label: 'Waiting for your OK', state: 'attention' });
  return out;
}

/** Figma "17 Check certificate": paste any ID; checking never approves or sends anything. */
export function CheckDialog() {
  const router = useRouter();
  const linked = useSearchParams().get('id');
  const [id, setId] = useState(linked ?? '');
  const [fieldError, setFieldError] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState('');

  const check = useCallback(async (value: string) => {
    const trimmed = value.trim();
    setError(''); setResult(null);
    if (!CERTIFICATE_ID.test(trimmed)) { setFieldError('A certificate ID uses only letters, numbers, - and _ (up to 100 characters).'); return; }
    setFieldError(''); setBusy(true);
    try {
      const headers = await writeHeaders();
      // The status check re-runs every binding on the backend.
      const status = await run(() => api.POST('/certificates/{id}/verify', { params: { path: { id: trimmed } }, headers }));
      if (!status.ok) {
        if (status.expired) { router.replace('/login'); return; }
        setError(status.problem.code === 'INVALID_CERTIFICATE' ? `No certificate with ID "${trimmed}" exists.` : status.problem.message);
        return;
      }
      setResult({ status: status.data, id: trimmed });
    } catch { setError('Your session could not be checked. Sign in again and retry.'); }
    finally { setBusy(false); }
  }, [router]);

  useEffect(() => { if (linked) void check(linked); }, [linked, check]);

  const meaning = result ? statusMeaning(result.status.status) : null;
  return <Dialog open onClose={() => router.push('/activity')} title="Check a certificate" label="Check a certificate"
    description={<p>Paste any certificate ID. Checking never approves or sends anything.</p>}
    footer={<Button kind="secondary" size="lg" href="/activity">Done</Button>}>
    <form className={styles.checkForm} noValidate onSubmit={(e) => { e.preventDefault(); void check(id); }}>
      <div className={styles.checkRow}>
        <Field id="certificate-id" label="Certificate ID" mono autoComplete="off" spellCheck={false} placeholder="cert-…" value={id} error={fieldError || undefined} data-autofocus
          onChange={(e) => { setId(e.target.value); setFieldError(''); }} />
        <Button type="submit" kind="secondary" size="lg" busy={busy}>{busy ? 'Checking…' : 'Check'}</Button>
      </div>
    </form>
    {error && <p role="alert" className="t-body-1 c-danger">{error}</p>}
    {result && meaning && <div className={styles.result} role="status" data-testid="certificate-status">
      <div className={`${styles.verdict} ${styles[`verdict_${meaning.tone}`]}`}>
        <p className="t-title-2">{meaning.title}</p>
        <p className="t-body-1 c-med">{meaning.meaning}{result.status.reasons.length > 0 ? ` ${result.status.reasons.join('; ')}.` : ''}</p>
      </div>
      <div className={styles.checkList}>{checks(result).map((c) => <Status key={c.label} state={c.state}>{c.label}</Status>)}</div>
      <Button kind="flat" size="sm" href={`/activity/story?certificate=${encodeURIComponent(result.id)}`}>See this payment&apos;s story</Button>
    </div>}
  </Dialog>;
}
