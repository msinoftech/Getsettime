/** ISO2 → dial code and currency for common booking locales. */
const COUNTRY_MAP: Record<string, { phoneCode: string; currency: string }> = {
  IN: { phoneCode: '+91', currency: 'INR' },
  US: { phoneCode: '+1', currency: 'USD' },
  CA: { phoneCode: '+1', currency: 'CAD' },
  GB: { phoneCode: '+44', currency: 'GBP' },
  AE: { phoneCode: '+971', currency: 'AED' },
  AU: { phoneCode: '+61', currency: 'AUD' },
  SG: { phoneCode: '+65', currency: 'SGD' },
  DE: { phoneCode: '+49', currency: 'EUR' },
  FR: { phoneCode: '+33', currency: 'EUR' },
  JP: { phoneCode: '+81', currency: 'JPY' },
};

/** Country → default IANA timezone (last-resort fallback only). */
const COUNTRY_TIMEZONE_MAP: Record<string, string> = {
  IN: 'Asia/Kolkata',
  US: 'America/New_York',
  CA: 'America/Toronto',
  GB: 'Europe/London',
  AE: 'Asia/Dubai',
  AU: 'Australia/Sydney',
  SG: 'Asia/Singapore',
  DE: 'Europe/Berlin',
  FR: 'Europe/Paris',
  JP: 'Asia/Tokyo',
  AZ: 'Asia/Baku',
  TR: 'Europe/Istanbul',
};

export function getPhoneCodeForCountry(country: string): string {
  const upper = country.toUpperCase();
  return COUNTRY_MAP[upper]?.phoneCode ?? '+1';
}

export function getCurrencyForCountry(country: string): string {
  const upper = country.toUpperCase();
  return COUNTRY_MAP[upper]?.currency ?? 'USD';
}

export function getTimezoneForCountry(country: string): string | null {
  const upper = country.toUpperCase();
  return COUNTRY_TIMEZONE_MAP[upper] ?? null;
}

export function normalizeCallingCode(raw: string | null | undefined): string {
  if (!raw?.trim()) return '+1';
  const t = raw.trim();
  return t.startsWith('+') ? t : `+${t}`;
}
