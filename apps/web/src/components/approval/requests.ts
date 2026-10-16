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

/** The idempotency key is created once per attempt and reused on retry, so a retry can never execute twice. */
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
  CLAIMED: 'The executor claimed this certificate and is preparing the transaction.',
  PENDING: 'The transaction was broadcast and is waiting for confirmation.',
  CONFIRMED: 'The transaction is confirmed on Base Sepolia.',
  FAILED: 'The transaction failed. Nothing was transferred.',
  REORGED: 'The block containing the transaction was replaced. It is no longer confirmed.',
};

/** The backend requires 16-100 characters; both branches always give more than 16. */
export function newIdempotencyKey(): string {
  const random: Crypto = globalThis.crypto;
  if (typeof random.randomUUID === 'function') return `exec-${random.randomUUID()}`;
  const bytes = new Uint8Array(16);
  random.getRandomValues(bytes);
  return `exec-${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}
