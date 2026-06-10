import { FALLBACK_TIMEZONE } from './constants';
import { getTimezoneForCountry } from './country-maps';
import { fetchGeoFromApi } from './detect-country';
import { getBrowserTimezone, getCachedTimezone } from './timezone-storage';

export type timezone_detection_source =
  | 'localStorage'
  | 'browser'
  | 'ip'
  | 'edge'
  | 'host_fallback';

export type timezone_detection_result = {
  timezone: string;
  source: timezone_detection_source;
};

/**
 * Customer timezone detection.
 * Order: manual localStorage → IP/edge geo → browser Intl → host fallback → UTC.
 */
export async function detectTimezone(options?: {
  hostTimezone?: string | null;
  country?: string | null;
}): Promise<timezone_detection_result> {
  const manual = getCachedTimezone();
  if (manual) {
    return { timezone: manual, source: 'localStorage' };
  }

  const geo = await fetchGeoFromApi();
  if (geo?.timezone?.trim()) {
    const tz = geo.timezone.trim();
    const source: timezone_detection_source =
      geo.source === 'edge' ? 'edge' : 'ip';
    return { timezone: tz, source };
  }

  const browser = getBrowserTimezone();
  if (browser && browser !== FALLBACK_TIMEZONE) {
    return { timezone: browser, source: 'browser' };
  }

  const host = options?.hostTimezone?.trim();
  if (host) {
    return { timezone: host, source: 'host_fallback' };
  }

  if (options?.country) {
    const fromCountry = getTimezoneForCountry(options.country);
    if (fromCountry) {
      return { timezone: fromCountry, source: 'host_fallback' };
    }
  }

  return { timezone: FALLBACK_TIMEZONE, source: 'host_fallback' };
}

export function detectTimezoneSync(hostTimezone?: string | null): timezone_detection_result {
  const manual = getCachedTimezone();
  if (manual) return { timezone: manual, source: 'localStorage' };
  const browser = getBrowserTimezone();
  if (browser) return { timezone: browser, source: 'browser' };
  const host = hostTimezone?.trim();
  if (host) return { timezone: host, source: 'host_fallback' };
  return { timezone: FALLBACK_TIMEZONE, source: 'host_fallback' };
}
