/** Digits-only phone for scoped identifier (E.164 without +). */
export function phoneDigitsForMyBookingsOtp(phoneE164: string): string {
  return phoneE164.replace(/\D/g, '');
}

export function myBookingsOtpIdentifier(phoneE164: string): string {
  return `my-bookings:${phoneDigitsForMyBookingsOtp(phoneE164)}`;
}

/** Masked email for UI hint (e.g. j***@example.com). */
export function maskEmailHint(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf('@');
  if (at <= 0) return '***';
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!domain) return '***';
  return `${local.slice(0, 1)}***@${domain}`;
}
