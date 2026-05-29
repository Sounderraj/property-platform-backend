import { createHash } from 'crypto';

export function buildEnquiryFingerprint(
  email: string,
  propertyRef: string | undefined,
  message: string
): string {
  const normalized = [
    email.toLowerCase().trim(),
    (propertyRef ?? '').toLowerCase().trim(),
    message.trim().slice(0, 500),
  ].join('|');
  return createHash('sha256').update(normalized).digest('hex');
}

export function hashPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
