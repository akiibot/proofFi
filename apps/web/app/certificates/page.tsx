'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { run, writeHeaders, type Problem } from '@/lib/request';
import { AppShell } from '@/components/shell/AppShell';
import { CertificateDetails, StatusBanner, TransactionFields } from '@/components/certificates/CertificateDetails';
import { CERTIFICATE_ID, type ActionCertificate, type CertificateStatus } from '@/components/certificates/status';
import { ApprovalPanel } from '@/components/approval/ApprovalPanel';
import { ExecutionPanel } from '@/components/approval/ExecutionPanel';
import { approvalRequest, canApprove, canExecute, executeRequest, newIdempotencyKey, type Approval, type Execution } from '@/components/approval/requests';

const sessionProblem: Problem = { code: 'UNAUTHORIZED', message: 'Your session could not be checked. Sign in again and retry.', reasons: [], httpStatus: 0 };

export default function CertificatesPage() {
  const router = useRouter();
  const [id, setId] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [certificate, setCertificate] = useState<ActionCertificate | null>(null);
  const [status, setStatus] = useState<CertificateStatus | null>(null);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [approvalProblem, setApprovalProblem] = useState<Problem | null>(null);
  const [execution, setExecution] = useState<Execution | null>(null);
  const [executionProblem, setExecutionProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState<'approve' | 'execute' | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  const refreshStatus = useCallback(async (certificateId: string) => {
    const headers = await writeHeaders();
    const outcome = await run(() => api.POST('/certificates/{id}/verify', { params: { path: { id: certificateId } }, headers }));
    if (!outcome.ok) { if (outcome.expired) router.replace('/login'); else setLoadError(outcome.problem.message); return; }
    setStatus(outcome.data);
  }, [router]);

  const open = useCallback(async (value: string) => {
    const trimmed = value.trim();
    setLoadError(''); setCertificate(null); setStatus(null); setApproval(null); setApprovalProblem(null); setExecution(null); setExecutionProblem(null);
    idempotencyKey.current = null;
    if (!CERTIFICATE_ID.test(trimmed)) { setFieldError('A certificate ID uses only letters, numbers, - and _ (up to 100 characters).'); return; }
    setFieldError(''); setLoading(true);
    try {
      const outcome = await run(() => api.GET('/certificates/{id}', { params: { path: { id: trimmed } } }));
      if (!outcome.ok) {
        if (outcome.expired) { router.replace('/login'); return; }
        setLoadError(outcome.problem.code === 'INVALID_CERTIFICATE' ? `No certificate with ID "${trimmed}" exists.` : outcome.problem.message);
        return;
      }
      setCertificate(outcome.data);
      await refreshStatus(trimmed);
    } catch { setLoadError(sessionProblem.message); }
    finally { setLoading(false); }
  }, [refreshStatus, router]);

  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get('id');
    if (fromLink) { setId(fromLink); void open(fromLink); }
  }, [open]);

  async function decide(decision: 'APPROVE' | 'DENY') {
    if (!certificate) return;
    setApprovalProblem(null); setBusy('approve');
    try {
      const headers = await writeHeaders();
      const outcome = await run(() => api.POST('/approvals', { body: approvalRequest(certificate, decision), headers }));
      if (!outcome.ok) { if (outcome.expired) { router.replace('/login'); return; } setApprovalProblem(outcome.problem); return; }
      setApproval(outcome.data);
      await refreshStatus(certificate.payload.id); // the backend decides what the approval changed
    } catch { setApprovalProblem(sessionProblem); }
    finally { setBusy(null); }
  }

  async function execute() {
    if (!certificate) return;
    setExecutionProblem(null); setBusy('execute');
    idempotencyKey.current ??= newIdempotencyKey(); // reused on retry, so a retry cannot run twice
    try {
      const headers = await writeHeaders();
      const outcome = await run(() => api.POST('/execute', { body: executeRequest(certificate, idempotencyKey.current!), headers }));
      if (!outcome.ok) { if (outcome.expired) { router.replace('/login'); return; } setExecutionProblem(outcome.problem); return; }
      setExecution(outcome.data);
      await refreshStatus(certificate.payload.id);
    } catch { setExecutionProblem(sessionProblem); }
    finally { setBusy(null); }
  }

  return <AppShell current="/certificates">
    <section className="page-head">
      <p className="eyebrow">PROOF BEFORE MONEY MOVES</p>
      <h1>Certificates</h1>
      <p>A certificate is the verifier&apos;s signed record of one exact action. Review what it would sign, decide, and only then execute. Each step is checked again by the backend.</p>
    </section>

    <section className="editor" aria-label="Open a certificate">
      <form noValidate onSubmit={(e) => { e.preventDefault(); void open(id); }}>
        <div className="field">
          <label htmlFor="open-certificate-id">Certificate ID</label>
          <input id="open-certificate-id" className="mono" value={id} onChange={(e) => { setId(e.target.value); setFieldError(''); }} autoComplete="off" spellCheck={false}
            aria-invalid={fieldError ? true : undefined} aria-describedby={fieldError ? 'open-certificate-id-error' : 'open-certificate-id-help'} />
          <small id="open-certificate-id-help">Certificates are issued by the verifier for a proposed action. Links from the audit log open here.</small>
          {fieldError && <small id="open-certificate-id-error" className="field-error">{fieldError}</small>}
        </div>
        <div className="actions"><button type="submit" disabled={loading}>{loading ? 'Opening…' : 'Open certificate'}</button></div>
      </form>
    </section>

    {loadError && <p role="alert" className="notice">{loadError}</p>}
    {certificate && <>
      {status && <StatusBanner status={status} />}
      <CertificateDetails certificate={certificate} />
      <section className="certificate" aria-label="Exact transaction fields">
        <h2>Exact transaction</h2>
        <p>These are the exact fields the executor would sign. Nothing else can be sent under this certificate.</p>
        <TransactionFields certificate={certificate} />
      </section>
      {approvalProblem && <div role="alert" className="notice"><p><strong>Your decision was not recorded.</strong> {approvalProblem.message}</p></div>}
      <ApprovalPanel certificate={certificate} enabled={canApprove(status)} busy={busy === 'approve'} approval={approval} onDecide={decide} />
      <ExecutionPanel enabled={canExecute(status) && approval?.decision !== 'DENY'} busy={busy === 'execute'} execution={execution} problem={executionProblem} onExecute={execute} />
    </>}
  </AppShell>;
}
