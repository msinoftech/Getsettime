import { DEFAULT_COUNTRY } from './constants';
import { getCountryFromBrowserLocale, getCachedCountry, isValidIso2, saveCountry } from './country-storage';

export type country_detection_source = 'localStorage' | 'edge' | 'ip' | 'browser' | 'default';

export type country_detection_result = {
  country: string;
  source: country_detection_source;
};

export type geo_api_response = {
  country?: string | null;
  timezone?: string | null;
  currency?: string | null;
  phoneCode?: string | null;
  source?: string | null;
};

function apiGeoUrl(): string {
  if (typeof window === 'undefined') return '/api/ip-geo';
  return `${window.location.origin}/api/ip-geo`;
}

export async function fetchGeoFromApi(): Promise<geo_api_response | null> {
  try {
    const res = await fetch(apiGeoUrl(), { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as geo_api_response;
    if (data.timezone?.trim() || data.country) {
      return data;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Customer country detection.
 * Order: profile → /api/ip-geo (edge + IP) → localStorage → browser locale → default.
 */
export async function detectCountry(options?: {
  profileCountry?: string | null;
}): Promise<country_detection_result> {
  const profile = options?.profileCountry?.toUpperCase();
  if (isValidIso2(profile)) {
    return { country: profile, source: 'browser' };
  }

  const geo = await fetchGeoFromApi();
  if (geo?.country && isValidIso2(geo.country)) {
    const code = geo.country.toUpperCase();
    const source: country_detection_source =
      geo.source === 'edge' ? 'edge' : geo.source === 'ip' ? 'ip' : 'ip';
    return { country: code, source };
  }

  const cached = getCachedCountry();
  if (cached) {
    return { country: cached, source: 'localStorage' };
  }

  const locale = getCountryFromBrowserLocale();
  if (locale) {
    return { country: locale, source: 'browser' };
  }

  return { country: DEFAULT_COUNTRY, source: 'default' };
}

/** Sync helper returning cached country only. */
export function detectCountrySync(): country_detection_result | null {
  const cached = getCachedCountry();
  if (cached) return { country: cached, source: 'localStorage' };
  const locale = getCountryFromBrowserLocale();
  if (locale) return { country: locale, source: 'browser' };
  return null;
}
