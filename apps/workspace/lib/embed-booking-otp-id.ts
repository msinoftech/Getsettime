export function normalizeEmbedOtpEmail(email: string): string {
  return email.toLowerCase().trim();
}

/** Digits-only phone for scoped identifier (E.164 without +). */
export function phoneDigitsForEmbedOtp(phoneE164: string): string {
  return phoneE164.replace(/\D/g, '');
}

export function embedOtpIdentifier(workspaceId: string | number, phoneE164: string): string {
  const digits = phoneDigitsForEmbedOtp(phoneE164);
  return `${workspaceId}:${digits}`;
}

export function generateEmbedBookingOtpCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
