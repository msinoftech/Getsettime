const STORAGE_KEY = 'country';
export const DEFAULT_COUNTRY = 'IN';
const TTL_MS = 60 * 24 * 60 * 60 * 1000;

type CachedCountry = { code: string; exp: number };

function isValidIso2(code: string | undefined | null): code is string {
  return Boolean(code && code.length === 2);
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

export function getCachedCountry(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCountry;
    if (!isValidIso2(parsed.code) || parsed.exp <= Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
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
  const payload: CachedCountry = { code: upper, exp: Date.now() + TTL_MS };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function apiCountryUrl(): string {
  if (typeof window === 'undefined') return '/api/ip-country';
  return `${window.location.origin}/api/ip-country`;
}

export async function fetchCountryFromApi(): Promise<string | null> {
  try {
    const res = await fetch(apiCountryUrl(), { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { country?: string | null };
    const c = data.country?.toUpperCase();
    return isValidIso2(c) ? c : null;
  } catch {
    return null;
  }
}

/**
 * Resolve default phone country.
 * Order: profile → /api/ip-country (Vercel edge / ipinfo / ipapi) → localStorage → locale → IN.
 * API runs before cache so deploys always hit the route when the phone field mounts.
 */
export async function detectCountry(options?: {
  profileCountry?: string | null;
}): Promise<string> {
  const profile = options?.profileCountry?.toUpperCase();
  if (isValidIso2(profile)) return profile;

  const fromApi = await fetchCountryFromApi();
  if (fromApi) {
    saveCountry(fromApi);
    return fromApi;
  }

  const cached = getCachedCountry();
  if (cached) return cached;

  const locale = getCountryFromBrowserLocale();
  if (locale) return locale;

  return DEFAULT_COUNTRY;
}
