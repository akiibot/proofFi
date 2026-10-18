'use client';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { routeQuery } from '@prooffi/client/location';
import { api } from '@/lib/api';
import { run, writeHeaders } from '@/lib/request';
import { AppShell } from '@/components/shell/AppShell';
import { CertificateDetails, StatusBanner } from '@/components/certificates/CertificateDetails';
import { CERTIFICATE_ID, type ActionCertificate, type CertificateStatus } from '@/components/certificates/status';

type Result = { status: CertificateStatus; certificate: ActionCertificate | null };

export default function CertificateVerifierPage() {
  const router = useRouter();
  const [id, setId] = useState('');
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
      // The status check re-runs every binding on the backend; the read only adds the human-readable payload.
      const [status, certificate] = await Promise.all([
        run(() => api.POST('/certificates/{id}/verify', { params: { path: { id: trimmed } }, headers })),
        run(() => api.GET('/certificates/{id}', { params: { path: { id: trimmed } } })),
      ]);
      if ((!status.ok && status.expired) || (!certificate.ok && certificate.expired)) { router.replace('/login'); return; }
      if (!status.ok) { setError(status.problem.code === 'INVALID_CERTIFICATE' ? `No certificate with ID "${trimmed}" exists.` : status.problem.message); return; }
      setResult({ status: status.data, certificate: certificate.ok ? certificate.data : null });
    } catch { setError('Your session could not be checked. Sign in again and retry.'); }
    finally { setBusy(false); }
  }, [router]);

  // Allow links such as /certificate-verifier?id=cert-123 from the audit log.
  useEffect(() => {
    const fromLink = routeQuery().get('id');
    if (fromLink) { setId(fromLink); void check(fromLink); }
  }, [check]);

  return <AppShell current="/certificate-verifier">
    <section className="page-head">
      <p className="eyebrow">CHECK A PROOF</p>
      <h1>Certificate verifier</h1>
      <p>Enter a certificate ID to check its signature and whether it still matches your current financial state and Constitution. Checking never approves or executes anything.</p>
    </section>

    <section className="editor" aria-label="Find a certificate">
      <form noValidate onSubmit={(e) => { e.preventDefault(); void check(id); }}>
        <div className="field">
          <label htmlFor="certificate-id">Certificate ID</label>
          <input id="certificate-id" className="mono" value={id} onChange={(e) => { setId(e.target.value); setFieldError(''); }} autoComplete="off" spellCheck={false}
            aria-invalid={fieldError ? true : undefined} aria-describedby={fieldError ? 'certificate-id-error' : undefined} />
          {fieldError && <small id="certificate-id-error" className="field-error">{fieldError}</small>}
        </div>
        <div className="actions"><button type="submit" disabled={busy}>{busy ? 'Checking…' : 'Check certificate'}</button></div>
      </form>
    </section>

    {error && <p role="alert" className="notice">{error}</p>}
    {result && <>
      <StatusBanner status={result.status} />
      {result.certificate
        ? <CertificateDetails certificate={result.certificate} />
        : <p className="notice">The status above comes from the backend, but the certificate contents could not be read, so they are not shown.</p>}
    </>}
  </AppShell>;
}
