import { COUNTRY_STORAGE_KEY, STORAGE_TTL_MS } from './constants';

type CachedCountry = { code: string; exp: number };

export function isValidIso2(code: string | undefined | null): code is string {
  return Boolean(code && code.length === 2);
}

export function getCachedCountry(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(COUNTRY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCountry;
    if (!isValidIso2(parsed.code) || parsed.exp <= Date.now()) {
      localStorage.removeItem(COUNTRY_STORAGE_KEY);
      return null;
    }
    return parsed.code.toUpperCase();
  } catch {
    return null;
  }
}

export function saveCountry(code: string): void {
  if (typeof window === 'undefined') return;
  const upper = code.toUpperCase();
  if (!isValidIso2(upper)) return;
  const payload: CachedCountry = { code: upper, exp: Date.now() + STORAGE_TTL_MS };
  localStorage.setItem(COUNTRY_STORAGE_KEY, JSON.stringify(payload));
}

export function getCountryFromBrowserLocale(): string | null {
  if (typeof navigator === 'undefined') return null;
  try {
    const locale = new Intl.Locale(navigator.language);
    const region = locale.region?.toUpperCase();
    if (isValidIso2(region)) return region;
  } catch {
    /* ignore */
  }
  return null;
}
