import { getTimezoneForCountry } from '@app/location';

const CACHE = new Map<string, { data: IpapiJsonResponse; exp: number }>();
const TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 5000;

type IpApiJsonResponse = {
  status?: string;
  countryCode?: string;
  timezone?: string;
  currency?: string;
};

export type IpapiJsonResponse = {
  ip?: string;
  city?: string;
  region?: string;
  region_code?: string;
  country_code?: string;
  country_name?: string;
  country_capital?: string;
  country_tld?: string;
  continent_code?: string;
  in_eu?: boolean;
  postal?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  utc_offset?: string;
  country_calling_code?: string;
  currency?: string;
  currency_name?: string;
  languages?: string;
  country_area?: number;
  country_population?: number;
  asn?: string;
  org?: string;
  error?: boolean;
  reason?: string;
};

export function clientIpFromHeaders(headers: Headers): string | null {
  const raw =
    headers.get('x-forwarded-for') ??
    headers.get('x-real-ip') ??
    headers.get('x-vercel-forwarded-for');
  return raw?.split(',')[0]?.trim() ?? null;
}

export function countryFromEdgeHeaders(headers: Headers): string | null {
  const raw =
    headers.get('x-vercel-ip-country') ?? headers.get('cf-ipcountry');
  const c = raw?.toUpperCase();
  if (!c || c === 'XX') return null;
  return c;
}

async function fetchWithTimeout(url: string): Promise<Response | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function fetchIpApiJson(ip: string): Promise<IpApiJsonResponse | null> {
  const url = `http://ip-api.com/json/${ip}?fields=status,countryCode,timezone,currency`;
  const res = await fetchWithTimeout(url);
  if (!res?.ok) return null;
  const data = (await res.json()) as IpApiJsonResponse;
  if (data.status !== 'success') return null;
  return data;
}

/** ipapi.co — registration/onboarding only (one call per new workspace). */
export async function fetchIpapiJson(ip: string): Promise<IpapiJsonResponse | null> {
  const cached = CACHE.get(ip);
  if (cached && cached.exp > Date.now()) {
    return cached.data;
  }

  const key = process.env.IPAPI_KEY;
  const url = key
    ? `https://ipapi.co/${ip}/json/?key=${key}`
    : `https://ipapi.co/${ip}/json/`;

  const res = await fetchWithTimeout(url);
  if (!res?.ok) return null;
  const data = (await res.json()) as IpapiJsonResponse;
  if (data.error) return null;
  CACHE.set(ip, { data, exp: Date.now() + TTL_MS });
  return data;
}

async function resolveGeoFromIp(ip: string, edgeCountry: string | null): Promise<ResolvedGeo | null> {
  const ipApi = await fetchIpApiJson(ip);
  if (ipApi) {
    const country = ipApi.countryCode?.toUpperCase() ?? edgeCountry ?? null;
    return {
      country: country && country.length === 2 ? country : null,
      timezone: ipApi.timezone?.trim() || null,
      currency: ipApi.currency?.trim() || null,
      phoneCode: null,
      source: 'ip',
      ipapi: null,
    };
  }

  return null;
}

export type ResolvedGeo = {
  country: string | null;
  timezone: string | null;
  currency: string | null;
  phoneCode: string | null;
  source: 'edge' | 'ip' | null;
  ipapi?: IpapiJsonResponse | null;
};

export async function resolveRegistrationGeoFromHeaders(
  headers: Headers,
  browserTimezone?: string | null
): Promise<{
  ipapi: IpapiJsonResponse | null;
  edgeCountry: string | null;
  browserTimezone?: string;
}> {
  const edgeCountry = countryFromEdgeHeaders(headers);
  const ip = clientIpFromHeaders(headers);
  const ipapi = ip ? await fetchIpapiJson(ip) : null;
  const bt = browserTimezone?.trim();
  return {
    ipapi,
    edgeCountry,
    ...(bt ? { browserTimezone: bt } : {}),
  };
}

export async function resolveGeoFromRequest(headers: Headers): Promise<ResolvedGeo> {
  const edgeCountry = countryFromEdgeHeaders(headers);
  const ip = clientIpFromHeaders(headers);

  if (!ip) {
    const timezone = edgeCountry ? getTimezoneForCountry(edgeCountry) : null;
    return {
      country: edgeCountry,
      timezone,
      currency: null,
      phoneCode: null,
      source: edgeCountry ? 'edge' : null,
      ipapi: null,
    };
  }

  const resolved = await resolveGeoFromIp(ip, edgeCountry);
  if (resolved) return resolved;

  const timezone = edgeCountry ? getTimezoneForCountry(edgeCountry) : null;
  return {
    country: edgeCountry,
    timezone,
    currency: null,
    phoneCode: null,
    source: edgeCountry ? 'edge' : null,
    ipapi: null,
  };
}
