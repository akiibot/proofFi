'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { rememberExecution } from '@/lib/execution-evidence';
import { run, writeHeaders, type Problem } from '@/lib/request';
import { verifyChain, type AuditEvent } from '@/components/audit/chain';
import { CERTIFICATE_ID, type ActionCertificate, type CertificateStatus } from '@/components/certificates/status';
import {
  approvalRequest, canApprove, canExecute, executeRequest, newIdempotencyKey, retainedDecision, retainedRequest, retainDecision, retainRequest,
  type Approval, type ExecuteRequest, type Execution,
} from '@/components/approval/requests';

const sessionProblem: Problem = { code: 'SESSION_CHECK', message: 'Your session could not be checked. Nothing was sent.', reasons: [], httpStatus: 0 };
/** A transport or server failure cannot prove the request did not commit, so it is treated as unknown. */
const uncertain = (problem: Problem) => problem.httpStatus === 0 || problem.httpStatus >= 500;

export type Evidence = { claim: AuditEvent | null; decision: 'APPROVE' | 'DENY' | null };
type Busy = 'load' | 'approve' | 'send' | 'reconcile' | 'refresh' | null;

/**
 * Everything the approval screens need about one certificate, with the guards of the original Certificates page:
 * the request identity is retained so a retry can only reconcile, never resend; every status is re-read from the backend
 * together with the hash-checked audit log; an unknown outcome locks further attempts. `approveAndSend` is one click
 * for the person and two backend calls: record the decision, then (only if the certificate is now VALID) execute.
 */
export function useCertificateFlow(id: string | null) {
  const router = useRouter();
  const flight = useRef(false);
  const [certificate, setCertificate] = useState<ActionCertificate | null>(null);
  const [status, setStatus] = useState<CertificateStatus | null>(null);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [loadError, setLoadError] = useState('');
  const [readProblem, setReadProblem] = useState('');
  const [identityProblem, setIdentityProblem] = useState('');
  const [approval, setApproval] = useState<Approval | null>(null);
  const [approvalProblem, setApprovalProblem] = useState<Problem | null>(null);
  const [approvalUnknown, setApprovalUnknown] = useState(false);
  const [execution, setExecution] = useState<Execution | null>(null);
  const [executionProblem, setExecutionProblem] = useState<Problem | null>(null);
  const [executionUnknown, setExecutionUnknown] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [request, setRequest] = useState<ExecuteRequest | null>(null);
  const [stranded, setStranded] = useState(false);
  const [busy, setBusy] = useState<Busy>('load');

  const inspect = useCallback(async (cert: ActionCertificate): Promise<{ found: Evidence; checked: CertificateStatus }> => {
    setReadProblem('');
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
      const claims = audit.data.filter((e) => e.event_type === 'EXECUTION_CLAIMED' && e.details.certificate_id === cert.payload.id);
      const decisions = audit.data.filter((e) => e.event_type === 'APPROVAL_RECORDED' && e.details.certificate_id === cert.payload.id && e.details.action_digest === cert.payload.action_digest);
      const claim = claims[0];
      if (claims.length > 1 || decisions.length > 1 || (claim && (
        typeof claim.details.execution_id !== 'string' || !CERTIFICATE_ID.test(claim.details.execution_id) ||
        claim.details.action_digest !== cert.payload.action_digest || claim.details.certificate_hash !== cert.certificate_hash
      ))) throw new Error('Audit bindings are ambiguous.');
      const decision = decisions[0]?.details.decision;
      if (decision !== undefined && decision !== 'APPROVE' && decision !== 'DENY') throw new Error('Audit decision is invalid.');
      const found: Evidence = { claim: claim ?? null, decision: decision ?? null };
      setStatus(checked.data); setEvidence(found);
      if (found.decision) { setApprovalUnknown(false); setApprovalProblem(null); }
      if (found.claim) setAttempted(true);
      return { found, checked: checked.data };
    } catch {
      setReadProblem('Current status and the audit record could not be checked. What you saw earlier is only an observation, so nothing can be approved or sent right now.');
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
    if (!CERTIFICATE_ID.test(trimmed)) { setLoadError('That is not a certificate ID.'); setBusy(null); return; }
    flight.current = true; setBusy('load');
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
      } catch { setIdentityProblem('The original request identity cannot be read safely. No new attempt will be sent.'); }
      const { found } = await inspect(cert);
      if (found.claim && !saved) setIdentityProblem('A send was already started for this certificate, but its original request identity is not available in this tab. The record is kept; no new attempt will be made.');
    } catch { /* inspect reports read failures without erasing an actual prior outcome */ }
    finally { flight.current = false; setBusy(null); }
  }, [inspect, router]);

  useEffect(() => { if (id) void open(id); else setBusy(null); }, [id, open]);

  const refresh = useCallback(async () => {
    if (!certificate || flight.current) return;
    flight.current = true; setBusy('refresh');
    try { await inspect(certificate); } catch { /* explicit read warning is shown */ }
    finally { flight.current = false; setBusy(null); }
  }, [certificate, inspect]);

  /** Records the decision. Returns true only when the backend recorded an APPROVE. */
  const decide = useCallback(async (cert: ActionCertificate, decision: 'APPROVE' | 'DENY', current: CertificateStatus | null, recorded: Evidence | null): Promise<boolean> => {
    if (identityProblem || approvalUnknown || recorded?.decision || !canApprove(current)) return false;
    setApprovalProblem(null);
    let headers: Record<string, string>;
    try { headers = await writeHeaders(); } catch { setApprovalProblem(sessionProblem); return false; }
    const body = approvalRequest(cert, decision);
    try { retainDecision(body); } catch { setIdentityProblem('The decision could not be retained. It was not sent.'); return false; }
    const outcome = await run(() => api.POST('/approvals', { body, headers }));
    if (!outcome.ok) {
      setApprovalProblem(outcome.problem); setApprovalUnknown(uncertain(outcome.problem));
      if (outcome.expired) router.replace('/login');
      try { await inspect(cert); } catch { /* keep the actual response */ }
      return false;
    }
    setApproval(outcome.data);
    return outcome.data.decision === 'APPROVE';
  }, [approvalUnknown, identityProblem, inspect, router]);

  /** Executes (or, with `reconcile`, re-reads) the single recorded attempt. A new attempt is never sent blindly. */
  const send = useCallback(async (cert: ActionCertificate, reconcile: boolean, current: CertificateStatus | null, recorded: Evidence | null, denied: boolean) => {
    if (identityProblem) return;
    if (!reconcile && (attempted || recorded?.claim || !recorded || !canExecute(current) || recorded.decision === 'DENY' || denied || readProblem)) return;
    setExecutionProblem(null);
    let body = request;
    if (reconcile) {
      let fresh: Evidence;
      try { fresh = (await inspect(cert)).found; } catch { return; }
      if (!body || !fresh.claim || (execution && fresh.claim.details.execution_id !== execution.id)) {
        setReadProblem('No matching recorded attempt is available to check. The original request will not be sent again.'); return;
      }
    }
    let headers: Record<string, string>;
    try { headers = await writeHeaders(); } catch { setExecutionProblem(sessionProblem); return; }
    if (!reconcile) {
      body = executeRequest(cert, newIdempotencyKey());
      try { retainRequest(body); } catch { setIdentityProblem('The request identity could not be retained. Nothing was sent.'); return; }
      setRequest(body); setAttempted(true);
    }
    if (!body) return;
    const sent = body;
    const outcome = await run(() => api.POST('/execute', { body: sent, headers }));
    if (!outcome.ok) {
      setExecutionProblem(outcome.problem); setExecutionUnknown(uncertain(outcome.problem));
      if (outcome.problem.code === 'ALREADY_USED') setStranded(true);
      if (outcome.expired) { router.replace('/login'); return; }
    } else { rememberExecution(outcome.data); setExecution(outcome.data); setExecutionUnknown(false); }
    try { await inspect(cert); } catch { /* keep the actual execution response */ }
  }, [attempted, execution, identityProblem, inspect, readProblem, request, router]);

  const guarded = useCallback(async (kind: Exclude<Busy, 'load' | null>, work: () => Promise<void>) => {
    if (!certificate || flight.current) return;
    flight.current = true; setBusy(kind);
    try { await work(); } finally { flight.current = false; setBusy(null); }
  }, [certificate]);

  /** One click: record "approve" when the rules ask for it, then send. The send only happens if the backend now reports VALID. */
  const approveAndSend = useCallback(() => guarded('approve', async () => {
    if (!certificate || !status || !evidence) return;
    let current = status; let recorded = evidence;
    if (canApprove(current)) {
      const ok = await decide(certificate, 'APPROVE', current, recorded);
      if (!ok) return;
      try { const next = await inspect(certificate); current = next.checked; recorded = next.found; } catch { return; }
    }
    setBusy('send');
    await send(certificate, false, current, recorded, false);
  }), [certificate, decide, evidence, guarded, inspect, send, status]);

  /** Extension companion: approve independently; never dispatch from this action. */
  const approveOnly = useCallback(() => guarded('approve', async () => {
    if (!certificate) return;
    try {
      const fresh = await inspect(certificate);
      await decide(certificate, 'APPROVE', fresh.checked, fresh.found);
      await inspect(certificate);
    } catch { /* inspect reports unavailable evidence; nothing is dispatched */ }
  }), [certificate, decide, guarded, inspect]);

  const deny = useCallback(() => guarded('approve', async () => {
    if (!certificate) return;
    await decide(certificate, 'DENY', status, evidence);
    try { await inspect(certificate); } catch { /* keep the recorded decision */ }
  }), [certificate, decide, evidence, guarded, inspect, status]);

  /** Sends an already-approved certificate (the "Approved, not sent" recovery) or a certificate that needs no approval. */
  const sendNow = useCallback(() => guarded('send', async () => {
    if (!certificate || !status || !evidence) return;
    await send(certificate, false, status, evidence, approval?.decision === 'DENY');
  }), [approval, certificate, evidence, guarded, send, status]);

  const reconcile = useCallback(() => guarded('reconcile', async () => {
    if (!certificate) return;
    await send(certificate, true, status, evidence, false);
  }), [certificate, evidence, guarded, send, status]);

  const canReconcile = Boolean(!identityProblem && !stranded && request && evidence?.claim);
  return {
    id, certificate, status, evidence, loadError, readProblem, identityProblem, approval, approvalProblem, approvalUnknown,
    execution, executionProblem, executionUnknown, attempted, stranded, busy, canReconcile,
    approveAndSend, approveOnly, deny, sendNow, reconcile, refresh, reload: () => (id ? open(id) : Promise.resolve()),
  };
}
