'use client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { routeQuery } from '@prooffi/client/location';
import { api } from '@/lib/api';
import { run, writeHeaders, type Problem } from '@/lib/request';
import { AppShell } from '@/components/shell/AppShell';
import { verifyChain, type AuditEvent } from '@/components/audit/chain';
import { CertificateDetails, StatusBanner, TransactionFields } from '@/components/certificates/CertificateDetails';
import { CERTIFICATE_ID, type ActionCertificate, type CertificateStatus } from '@/components/certificates/status';
import { ApprovalPanel } from '@/components/approval/ApprovalPanel';
import { ExecutionPanel } from '@/components/approval/ExecutionPanel';
import { approvalRequest, canApprove, canExecute, executeRequest, newIdempotencyKey, retainedRequest, retainRequest, retainedDecision, retainDecision, type Approval, type ExecuteRequest, type Execution } from '@/components/approval/requests';

const sessionProblem: Problem = { code: 'SESSION_CHECK', message: 'Your session could not be checked. The mutation was not sent.', reasons: [], httpStatus: 0 };
const uncertain = (problem: Problem) => problem.httpStatus === 0 || problem.httpStatus >= 500;
const subscribeToHydration = () => () => undefined;
const clientSnapshot = () => true;
const serverSnapshot = () => false;
type Evidence = { claim: AuditEvent | null; decision: 'APPROVE' | 'DENY' | null };

export default function CertificatesPage() {
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  const flight = useRef(false);
  const [id, setId] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [readProblem, setReadProblem] = useState('');
  const [identityProblem, setIdentityProblem] = useState('');
  const [certificate, setCertificate] = useState<ActionCertificate | null>(null);
  const [status, setStatus] = useState<CertificateStatus | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [approval, setApproval] = useState<Approval | null>(null);
  const [approvalProblem, setApprovalProblem] = useState<Problem | null>(null);
  const [approvalUnknown, setApprovalUnknown] = useState(false);
  const [execution, setExecution] = useState<Execution | null>(null);
  const [executionProblem, setExecutionProblem] = useState<Problem | null>(null);
  const [executionUnknown, setExecutionUnknown] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [request, setRequest] = useState<ExecuteRequest | null>(null);
  const [stranded, setStranded] = useState(false);
  const [busy, setBusy] = useState<'approve' | 'execute' | 'reconcile' | 'refresh' | null>(null);

  const inspect = useCallback(async (cert: ActionCertificate): Promise<Evidence> => {
    setReadProblem(''); setStatus(null); setEvidence(null);
    try {
      const headers = await writeHeaders();
      const [checked, audit] = await Promise.all([
        run(() => api.POST('/certificates/{id}/verify', { params: { path: { id: cert.payload.id } }, headers })),
        run(() => api.GET('/audit')),
      ]);
      if ((!checked.ok && checked.expired) || (!audit.ok && audit.expired)) router.replace('/login');
      if (!checked.ok) throw new Error(checked.problem.message);
      if (!audit.ok) throw new Error(audit.problem.message);
      if (!(await verifyChain(audit.data)).ok) throw new Error('Audit integrity could not be verified.');
      const claims = audit.data.filter(e => e.event_type === 'EXECUTION_CLAIMED' && e.details.certificate_id === cert.payload.id);
      const decisions = audit.data.filter(e => e.event_type === 'APPROVAL_RECORDED' && e.details.certificate_id === cert.payload.id && e.details.action_digest === cert.payload.action_digest);
      const claim = claims[0];
      if (claims.length > 1 || decisions.length > 1 || (claim && (
        typeof claim.details.execution_id !== 'string' || !CERTIFICATE_ID.test(claim.details.execution_id) ||
        claim.details.action_digest !== cert.payload.action_digest || claim.details.certificate_hash !== cert.certificate_hash
      ))) throw new Error('Audit bindings are ambiguous.');
      const decision = decisions[0]?.details.decision;
      if (decision !== undefined && decision !== 'APPROVE' && decision !== 'DENY') throw new Error('Audit decision is invalid.');
      const found: Evidence = { claim: claims[0] ?? null, decision: decision ?? null };
      setStatus(checked.data); setEvidence(found);
      if (found.decision) { setApprovalUnknown(false); setApprovalProblem(null); }
      if (found.claim) setAttempted(true);
      return found;
    } catch {
      setReadProblem('Current certificate status and audit could not be checked. Prior responses remain observations; financial actions are disabled.');
      throw new Error('Current status and audit unavailable');
    }
  }, [router]);

  const open = useCallback(async (value: string) => {
    if (flight.current) return;
    const trimmed = value.trim();
    setLoadError(''); setCertificate(null); setStatus(null); setEvidence(null); setReadProblem('');
    setApproval(null); setApprovalProblem(null); setApprovalUnknown(false);
    setExecution(null); setExecutionProblem(null); setExecutionUnknown(false);
    setRequest(null); setAttempted(false); setStranded(false); setIdentityProblem('');
    if (!CERTIFICATE_ID.test(trimmed)) { setFieldError('A certificate ID uses only letters, numbers, - and _ (up to 100 characters).'); return; }
    setFieldError(''); setLoading(true); flight.current = true;
    try {
      const outcome = await run(() => api.GET('/certificates/{id}', { params: { path: { id: trimmed } } }));
      if (!outcome.ok) {
        if (outcome.expired) { router.replace('/login'); return; }
        setLoadError(outcome.problem.code === 'INVALID_CERTIFICATE' ? `No certificate with ID "${trimmed}" exists.` : outcome.problem.message);
        return;
      }
      const cert = outcome.data;
      setCertificate(cert);
      let saved: ExecuteRequest | null = null;
      try {
        saved = retainedRequest(cert); setRequest(saved); setAttempted(Boolean(saved)); setExecutionUnknown(Boolean(saved));
        setApprovalUnknown(Boolean(retainedDecision(cert)));
      }
      catch { setIdentityProblem('The original request identity cannot be read safely. No new execution attempt will be sent.'); }
      const found = await inspect(cert);
      if (found.claim && !saved) setIdentityProblem('An execution claim exists, but its original request identity is unavailable in this tab. Preserve the audit evidence; do not create a new attempt.');
    } catch { /* inspect reports read failures without erasing an actual prior outcome. */ }
    finally { setLoading(false); flight.current = false; }
  }, [inspect, router]);

  useEffect(() => {
    const fromLink = routeQuery().get('id');
    if (fromLink) { setId(fromLink); void open(fromLink); }
  }, [open]);

  async function refresh() {
    if (!certificate || flight.current) return;
    flight.current = true; setBusy('refresh');
    try { await inspect(certificate); } catch { /* explicit read warning above */ }
    finally { flight.current = false; setBusy(null); }
  }

  async function decide(decision: 'APPROVE' | 'DENY') {
    if (!certificate || flight.current || identityProblem || approvalUnknown || evidence?.decision || !canApprove(status) || id.trim() !== certificate.payload.id) return;
    flight.current = true; setApprovalProblem(null); setBusy('approve');
    try {
      let headers: Record<string, string>;
      try { headers = await writeHeaders(); } catch { setApprovalProblem(sessionProblem); return; }
      const body = approvalRequest(certificate, decision);
      try { retainDecision(body); }
      catch { setIdentityProblem('The decision intent could not be retained. The approval request was not sent.'); return; }
      const outcome = await run(() => api.POST('/approvals', { body, headers }));
      if (!outcome.ok) {
        setApprovalProblem(outcome.problem); setApprovalUnknown(uncertain(outcome.problem));
        if (outcome.expired) { router.replace('/login'); return; }
      } else setApproval(outcome.data);
      try { await inspect(certificate); } catch { /* retain the real decision response */ }
    } finally { flight.current = false; setBusy(null); }
  }

  async function send(reconcile: boolean) {
    if (!certificate || flight.current || identityProblem || id.trim() !== certificate.payload.id) return;
    if (!reconcile && (attempted || evidence?.claim || !evidence || !canExecute(status) || evidence.decision === 'DENY' || approval?.decision === 'DENY' || readProblem)) return;
    flight.current = true; setExecutionProblem(null); setBusy(reconcile ? 'reconcile' : 'execute');
    try {
      let body = request;
      if (reconcile) {
        const current = await inspect(certificate);
        if (!body || !current.claim || (execution && current.claim.details.execution_id !== execution.id)) {
          setReadProblem('No matching recorded claim is available to reconcile. The original request will not be resubmitted blindly.'); return;
        }
      }
      let headers: Record<string, string>;
      try { headers = await writeHeaders(); } catch { setExecutionProblem(sessionProblem); return; }
      if (!reconcile) {
        body = executeRequest(certificate, newIdempotencyKey());
        try { retainRequest(body); }
        catch { setIdentityProblem('The request identity could not be retained. Execution was not sent.'); return; }
        setRequest(body); setAttempted(true);
      }
      if (!body) return;
      const outcome = await run(() => api.POST('/execute', { body, headers }));
      if (!outcome.ok) {
        setExecutionProblem(outcome.problem); setExecutionUnknown(uncertain(outcome.problem));
        if (outcome.problem.code === 'ALREADY_USED') setStranded(true);
        if (outcome.expired) { router.replace('/login'); return; }
      } else { setExecution(outcome.data); setExecutionUnknown(false); }
      try { await inspect(certificate); } catch { /* keep the actual execution response */ }
    } catch { /* inspect reports uncertainty without any resend */ }
    finally { flight.current = false; setBusy(null); }
  }

  const current = certificate?.payload.id === id.trim();
  const locked = Boolean(busy) || loading || !current;
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
          <input id="open-certificate-id" className="mono" disabled={!hydrated || Boolean(busy)} value={id} onChange={(e) => { setId(e.target.value); setFieldError(''); }} autoComplete="off" spellCheck={false}
            aria-invalid={fieldError ? true : undefined} aria-describedby={fieldError ? 'open-certificate-id-error' : 'open-certificate-id-help'} />
          <small id="open-certificate-id-help">Certificates are issued by the verifier for a proposed action. Links from the audit log open here.</small>
          {fieldError && <small id="open-certificate-id-error" className="field-error">{fieldError}</small>}
        </div>
        <div className="actions"><button type="submit" disabled={!hydrated || loading || Boolean(busy)}>{loading ? 'Opening…' : 'Open certificate'}</button></div>
        <noscript>Enable JavaScript to open a certificate.</noscript>
      </form>
    </section>
    {loadError && <p role="alert" className="notice">{loadError}</p>}
    {certificate && <>
      {status && <StatusBanner status={status} />}
      {readProblem && <p role="alert" className="notice">{readProblem}</p>}
      {identityProblem && <p role="alert" className="notice">{identityProblem}</p>}
      <button type="button" className="secondary" disabled={locked} onClick={() => void refresh()}>Refresh status and audit</button>
      <CertificateDetails certificate={certificate} />
      <section className="certificate" aria-label="Exact transaction fields">
        <h2>Exact transaction</h2><p>These are the exact fields the executor would sign. Nothing else can be sent under this certificate.</p>
        <TransactionFields certificate={certificate} />
      </section>
      {approvalProblem && <div role="alert" className="notice"><p><strong>{approvalUnknown ? 'Your decision outcome is unknown.' : 'Decision request refused or not sent.'}</strong> {approvalProblem.message}</p></div>}
      {approvalUnknown && <p className="notice">The decision may already be recorded. Refresh status and audit; do not submit another decision.</p>}
      <ApprovalPanel certificate={certificate} enabled={!locked && !readProblem && !identityProblem && !approvalUnknown && !evidence?.decision && canApprove(status)} busy={Boolean(busy)} approval={approval} recordedDecision={evidence?.decision ?? undefined} onDecide={decide} />
      <ExecutionPanel enabled={!locked && !readProblem && !identityProblem && !attempted && !evidence?.claim && canExecute(status) && approval?.decision !== 'DENY' && evidence?.decision !== 'DENY'} busy={Boolean(busy)} execution={execution} problem={executionProblem}
        attempted={attempted} uncertain={executionUnknown} canReconcile={!locked && !readProblem && !identityProblem && !stranded && Boolean(request && evidence?.claim)} onExecute={() => void send(false)} onReconcile={() => void send(true)} />
    </>}
  </AppShell>;
}
