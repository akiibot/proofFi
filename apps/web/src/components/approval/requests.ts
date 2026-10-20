import { scopeStorageKey } from '@/lib/scope-storage';
import type { components } from '@/lib/schema';
import type { ActionCertificate, CertificateStatus } from '@/components/certificates/status';

export type ApprovalRequest = components['schemas']['ApprovalRequest'];
export type Approval = components['schemas']['Approval'];
export type ExecuteRequest = components['schemas']['ExecuteRequest'];
export type Execution = components['schemas']['Execution'];

/** An approval names one certificate and the exact action digest it signed, so it cannot be reused for anything else. */
export function approvalRequest(certificate: ActionCertificate, decision: ApprovalRequest['decision']): ApprovalRequest {
  return { certificate_id: certificate.payload.id, action_digest: certificate.payload.action_digest, decision };
}

/** The retained identity names one attempt; an existing claim can only reconcile. */
export function executeRequest(certificate: ActionCertificate, idempotencyKey: string): ExecuteRequest {
  return { certificate_id: certificate.payload.id, action_digest: certificate.payload.action_digest, idempotency_key: idempotencyKey };
}

/** Approval is offered only while the backend says the certificate is current and waiting for a person. */
export function canApprove(status: CertificateStatus | null): boolean {
  return status?.status === 'APPROVAL_REQUIRED' && status.signature_valid;
}

/** Execution is offered only for a currently VALID, correctly signed certificate. The executor re-checks everything itself. */
export function canExecute(status: CertificateStatus | null): boolean {
  return status?.status === 'VALID' && status.signature_valid;
}

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

/** Base Sepolia block explorer link, only for a well-formed transaction hash returned by the backend. */
export function explorerUrl(txHash: string | null | undefined): string | null {
  return txHash && TX_HASH.test(txHash) ? `https://sepolia.basescan.org/tx/${txHash}` : null;
}

export const EXECUTION_MEANING: Record<Execution['status'], string> = {
  CLAIMED: 'The certificate is claimed. A stranded attempt must never be signed again.',
  PENDING: 'Dispatch is reserved or awaiting confirmation. This status alone does not prove broadcast.',
  CONFIRMED: 'The transaction is confirmed on Base Sepolia.',
  FAILED: 'The chain reported a failed transaction. Inspect its receipt and error.',
  REORGED: 'The block containing the transaction was replaced. It is no longer confirmed.',
};

/** Request identity only, never an approval or execution record. Storage is untrusted. */
export function retainedRequest(certificate: ActionCertificate): ExecuteRequest | null {
  const raw = sessionStorage.getItem(scopeStorageKey(`prooffi.execute.${certificate.payload.id}`));
  if (raw === null) return null;
  const value = JSON.parse(raw);
  if (value?.certificate_id !== certificate.payload.id || value?.action_digest !== certificate.payload.action_digest ||
      typeof value?.idempotency_key !== 'string' || !/^[A-Za-z0-9_-]{16,100}$/.test(value.idempotency_key)) {
    throw new Error('The retained request identity is invalid. Preserve existing evidence; do not create another attempt.');
  }
  return executeRequest(certificate, value.idempotency_key);
}

export function retainRequest(body: ExecuteRequest): void {
  sessionStorage.setItem(scopeStorageKey(`prooffi.execute.${body.certificate_id}`), JSON.stringify(body));
}

/** A sent decision intent is not evidence that a human decision was recorded. */
export function retainedDecision(certificate: ActionCertificate): ApprovalRequest | null {
  const raw = sessionStorage.getItem(scopeStorageKey(`prooffi.approval.${certificate.payload.id}`));
  if (raw === null) return null;
  const value = JSON.parse(raw);
  if (value?.certificate_id !== certificate.payload.id || value?.action_digest !== certificate.payload.action_digest ||
      (value?.decision !== 'APPROVE' && value?.decision !== 'DENY')) throw new Error('Invalid retained decision intent');
  return approvalRequest(certificate, value.decision);
}

export function retainDecision(body: ApprovalRequest): void {
  sessionStorage.setItem(scopeStorageKey(`prooffi.approval.${body.certificate_id}`), JSON.stringify(body));
}

/** The backend requires 16-100 characters; both branches always give more than 16. */
export function newIdempotencyKey(): string {
  const random: Crypto = globalThis.crypto;
  if (typeof random.randomUUID === 'function') return `exec-${random.randomUUID()}`;
  const bytes = new Uint8Array(16);
  random.getRandomValues(bytes);
  return `exec-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
