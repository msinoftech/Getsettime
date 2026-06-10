import {
  getCurrencyForCountry,
  getPhoneCodeForCountry,
  normalizeCallingCode,
} from './country-maps';
import { detectCountry, type country_detection_source } from './detect-country';
import { detectTimezone, type timezone_detection_source } from './detect-timezone';

export type location_context_source =
  | 'localStorage'
  | 'browser'
  | 'edge'
  | 'ip'
  | 'host_fallback'
  | 'default';

export type location_context = {
  country: string;
  timezone: string;
  currency: string;
  phoneCode: string;
  source: location_context_source;
};

function mergeSource(
  countrySource: country_detection_source,
  tzSource: timezone_detection_source
): location_context_source {
  if (countrySource === 'localStorage' || tzSource === 'localStorage') return 'localStorage';
  if (tzSource === 'browser' || countrySource === 'browser') return 'browser';
  if (countrySource === 'edge' || tzSource === 'edge') return 'edge';
  if (countrySource === 'ip' || tzSource === 'ip') return 'ip';
  if (tzSource === 'host_fallback') return 'host_fallback';
  if (countrySource === 'default') return 'default';
  return 'browser';
}

export async function resolveLocationContext(options?: {
  profileCountry?: string | null;
  hostTimezone?: string | null;
  manualTimezone?: string | null;
  manualCountry?: string | null;
}): Promise<location_context> {
  const countryResult = options?.manualCountry?.trim()
    ? { country: options.manualCountry.trim().toUpperCase(), source: 'browser' as const }
    : await detectCountry({ profileCountry: options?.profileCountry });

  let timezone: string;
  let tzSource: timezone_detection_source;

  if (options?.manualTimezone?.trim()) {
    timezone = options.manualTimezone.trim();
    tzSource = 'localStorage';
  } else {
    const tzResult = await detectTimezone({
      hostTimezone: options?.hostTimezone,
      country: countryResult.country,
    });
    timezone = tzResult.timezone;
    tzSource = tzResult.source;
  }

  return {
    country: countryResult.country,
    timezone,
    currency: getCurrencyForCountry(countryResult.country),
    phoneCode: getPhoneCodeForCountry(countryResult.country),
    source: mergeSource(countryResult.source, tzSource),
  };
}

export async function resolveLocationContextWithGeo(options?: {
  profileCountry?: string | null;
  hostTimezone?: string | null;
  manualTimezone?: string | null;
  manualCountry?: string | null;
}): Promise<location_context> {
  const { fetchGeoFromApi } = await import('./detect-country');
  const geo = await fetchGeoFromApi();

  const countryResult = options?.manualCountry?.trim()
    ? { country: options.manualCountry.trim().toUpperCase(), source: 'browser' as const }
    : await detectCountry({ profileCountry: options?.profileCountry });

  let timezone: string;
  let tzSource: timezone_detection_source;

  if (options?.manualTimezone?.trim()) {
    timezone = options.manualTimezone.trim();
    tzSource = 'localStorage';
  } else if (geo?.timezone?.trim()) {
    timezone = geo.timezone.trim();
    tzSource = geo.source === 'edge' ? 'edge' : 'ip';
  } else {
    const tzResult = await detectTimezone({
      hostTimezone: options?.hostTimezone,
      country: countryResult.country,
    });
    timezone = tzResult.timezone;
    tzSource = tzResult.source;
  }

  const currency = geo?.currency?.trim() || getCurrencyForCountry(countryResult.country);
  const phoneCode = geo?.phoneCode
    ? normalizeCallingCode(geo.phoneCode)
    : getPhoneCodeForCountry(countryResult.country);

  return {
    country: countryResult.country,
    timezone,
    currency,
    phoneCode,
    source: mergeSource(countryResult.source, tzSource),
  };
}
