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

export async function fetchCountryFromApi(): Promise<string | null> {
  try {
    const res = await fetch('/api/ip-country');
    if (!res.ok) return null;
    const data = (await res.json()) as { country?: string | null };
    const c = data.country?.toUpperCase();
    return isValidIso2(c) ? c : null;
  } catch {
    return null;
  }
}

export async function detectCountry(options?: {
  profileCountry?: string | null;
}): Promise<string> {
  const profile = options?.profileCountry?.toUpperCase();
  if (isValidIso2(profile)) return profile;

  const cached = getCachedCountry();
  if (cached) return cached;

  const fromApi = await fetchCountryFromApi();
  if (fromApi) {
    saveCountry(fromApi);
    return fromApi;
  }

  const locale = getCountryFromBrowserLocale();
  if (locale) return locale;

  return DEFAULT_COUNTRY;
}
