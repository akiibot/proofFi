import type { components } from '@/lib/schema';

export type ActionCertificate = components['schemas']['ActionCertificate'];
export type CertificateStatus = components['schemas']['CertificateStatus'];

type Tone = 'ok' | 'warn' | 'bad';

/** Plain meaning of every status POST /certificates/{id}/verify can return. Only VALID can authorize anything. */
export const STATUS_MEANING: Record<CertificateStatus['status'], { title: string; meaning: string; tone: Tone }> = {
  VALID: { title: 'Valid', meaning: 'The signature checks out and it still matches the current financial state and Constitution.', tone: 'ok' },
  APPROVAL_REQUIRED: { title: 'Valid, needs your approval', meaning: 'Genuinely signed and current, but it cannot be executed until you approve it.', tone: 'warn' },
  SIGNED_BUT_STALE: { title: 'Signed but stale', meaning: 'It was genuinely signed, but the financial state or Constitution has changed since. It can no longer be used.', tone: 'warn' },
  EXPIRED: { title: 'Expired', meaning: 'Its validity window has passed. A new verification is needed.', tone: 'warn' },
  ALREADY_USED: { title: 'Already used', meaning: 'It has already been claimed for an execution, so it cannot authorize another.', tone: 'warn' },
  TAMPERED: { title: 'Tampered', meaning: 'It does not match its signature or its stored record. Treat it as forged.', tone: 'bad' },
};

export function statusMeaning(status: string) {
  return STATUS_MEANING[status as CertificateStatus['status']] ?? { title: status, meaning: 'The backend returned a status this screen does not know.', tone: 'bad' as Tone };
}

export const CERTIFICATE_ID = /^[A-Za-z0-9_-]{1,100}$/;
