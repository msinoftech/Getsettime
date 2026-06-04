import {
  parsePhoneNumberWithError,
  isValidPhoneNumber,
  type CountryCode,
} from 'libphonenumber-js/max';

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'IN';

export function parsePhone(value: string, defaultCountry?: CountryCode) {
  return parsePhoneNumberWithError(
    value.trim(),
    defaultCountry ?? DEFAULT_PHONE_COUNTRY
  );
}

export function isValidPhone(value: string, defaultCountry?: CountryCode): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    return isValidPhoneNumber(trimmed, defaultCountry ?? DEFAULT_PHONE_COUNTRY);
  } catch {
    return false;
  }
}

export function toE164(value: string, defaultCountry?: CountryCode): string | null {
  try {
    const p = parsePhone(value, defaultCountry);
    return p.isValid() ? p.format('E.164') : null;
  } catch {
    return null;
  }
}

export function countryFromPhone(value: string): CountryCode | null {
  try {
    const p = parsePhoneNumberWithError(value.trim());
    return p.country ?? null;
  } catch {
    return null;
  }
}

export function normalizePhoneE164(value: string, defaultCountry?: CountryCode): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('+')) return toE164(trimmed);
  return toE164(trimmed, defaultCountry);
}

/** Normalize invitee phone for DB storage; returns invalid=true when non-empty but not parseable. */
export function normalizeInviteePhoneForStorage(
  raw: string | null | undefined
): { value: string | null; invalid: boolean } {
  const trimmed = raw?.trim();
  if (!trimmed) return { value: null, invalid: false };
  const detected = countryFromPhone(trimmed);
  const e164 = toE164(trimmed, detected ?? DEFAULT_PHONE_COUNTRY);
  if (!e164) return { value: null, invalid: true };
  return { value: e164, invalid: false };
}
