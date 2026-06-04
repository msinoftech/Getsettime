import { NextRequest, NextResponse } from 'next/server';

const CACHE = new Map<string, { country: string; exp: number }>();
const TTL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 5000;

function countryFromEdge(req: NextRequest): string | null {
  const raw =
    req.headers.get('x-vercel-ip-country') ?? req.headers.get('cf-ipcountry');
  const c = raw?.toUpperCase();
  if (!c || c === 'XX') return null;
  return c;
}

function clientIp(req: NextRequest): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;
}

async function fetchFromIpinfo(ip: string): Promise<string | null> {
  const token = process.env.IPINFO_TOKEN;
  if (!token) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://ipinfo.io/${ip}/country?token=${token}`, {
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const text = (await res.text()).trim().toUpperCase();
    return text.length === 2 ? text : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchFromIpapi(ip: string): Promise<string | null> {
  const key = process.env.IPAPI_KEY;
  const url = key
    ? `https://ipapi.co/${ip}/country_code/?key=${key}`
    : `https://ipapi.co/${ip}/country_code/`;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = (await res.json()) as { country_code?: string };
    const c = data.country_code?.toUpperCase();
    return c && c.length === 2 ? c : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function resolveCountryFromProviders(ip: string): Promise<string | null> {
  const provider = process.env.GEO_PROVIDER ?? 'ipinfo';
  if (provider === 'ipapi') {
    return (await fetchFromIpapi(ip)) ?? (await fetchFromIpinfo(ip));
  }
  return (await fetchFromIpinfo(ip)) ?? (await fetchFromIpapi(ip));
}

/** GET /api/ip-country — edge geo headers, then ipinfo/ipapi server-side fallback. */
export async function GET(req: NextRequest) {
  const edge = countryFromEdge(req);
  if (edge) return NextResponse.json({ country: edge });

  const ip = clientIp(req);
  if (!ip) return NextResponse.json({ country: null });

  const cached = CACHE.get(ip);
  if (cached && cached.exp > Date.now()) {
    return NextResponse.json({ country: cached.country });
  }

  const fromProvider = await resolveCountryFromProviders(ip);
  if (fromProvider) {
    CACHE.set(ip, { country: fromProvider, exp: Date.now() + TTL_MS });
    return NextResponse.json({ country: fromProvider });
  }

  return NextResponse.json({ country: null });
}
