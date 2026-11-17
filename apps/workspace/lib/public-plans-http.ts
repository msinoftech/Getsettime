import { NextResponse } from 'next/server';
import { verifyClaimFreeMintBearer } from '@/lib/claim-free-http';

/** Strip trailing slashes so `https://a.com/` matches browser `Origin: https://a.com` */
export function normalizePublicPlansOrigin(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function expandDevOriginAliases(origins: string[]): string[] {
  if (process.env.NODE_ENV !== 'development') return origins;
  const extra = new Set<string>();
  for (const o of origins) {
    try {
      const u = new URL(o);
      const port = u.port ? `:${u.port}` : '';
      if (u.hostname === 'localhost') {
        extra.add(`${u.protocol}//127.0.0.1${port}`);
      } else if (u.hostname === '127.0.0.1') {
        extra.add(`${u.protocol}//localhost${port}`);
      }
    } catch {
      /* ignore */
    }
  }
  return [...origins, ...extra];
}

export function getPublicPlansAllowedOrigins(): string[] {
  const raw = (process.env.PUBLIC_PLANS_ALLOWED_ORIGINS || '').trim();
  if (!raw) return [];
  const parsed = raw
    .split(',')
    .map((o) => normalizePublicPlansOrigin(o))
    .filter(Boolean);
  return expandDevOriginAliases(parsed);
}

function originFromRequestUrl(req: Request): string | null {
  try {
    return normalizePublicPlansOrigin(new URL(req.url).origin);
  } catch {
    return null;
  }
}

function originFromHostHeader(req: Request): string | null {
  const host = req.headers.get('host')?.trim();
  if (!host) return null;
  const forwarded = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto =
    forwarded ||
    (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  try {
    return normalizePublicPlansOrigin(`${proto}://${host}`);
  } catch {
    return null;
  }
}

/** Off by default — do not treat API Host as caller (curl/Postman would bypass Bearer). */
function allowRequestHostAsOrigin(): boolean {
  return process.env.PUBLIC_PLANS_ALLOW_REQUEST_HOST === 'true';
}

/** Modern browsers send Fetch Metadata on navigations and fetch(); Postman/curl usually do not. */
function hasFetchMetadata(req: Request): boolean {
  return Boolean(req.headers.get('sec-fetch-site')?.trim());
}

function originFromReferer(req: Request): string | null {
  const referer = req.headers.get('referer')?.trim();
  if (!referer) return null;
  try {
    return normalizePublicPlansOrigin(new URL(referer).origin);
  } catch {
    return null;
  }
}

function originFromBrowserOriginHeader(req: Request): string | null {
  if (!hasFetchMetadata(req)) return null;
  const originHeader = req.headers.get('origin')?.trim();
  if (!originHeader || originHeader === 'null') return null;
  return normalizePublicPlansOrigin(originHeader);
}

/**
 * Caller origin for allowlist checks. Does **not** trust a bare `Origin` header
 * (easy to spoof in Postman). Uses Referer, or Origin only with Sec-Fetch-* ,
 * then optional dev Host fallback.
 */
export function resolvePublicApiCallerOrigin(req: Request): string | null {
  const fromReferer = originFromReferer(req);
  if (fromReferer) return fromReferer;

  const fromBrowser = originFromBrowserOriginHeader(req);
  if (fromBrowser) return fromBrowser;

  if (allowRequestHostAsOrigin()) {
    return originFromRequestUrl(req) ?? originFromHostHeader(req);
  }

  return null;
}

/** @deprecated Use resolvePublicApiCallerOrigin */
export function resolveRequestOrigin(req: Request): string | null {
  return resolvePublicApiCallerOrigin(req);
}

export function isOriginAllowedForPublicPlans(origin: string | null): boolean {
  if (!origin) return false;
  const normalized = normalizePublicPlansOrigin(origin);
  const allowed = getPublicPlansAllowedOrigins();
  return allowed.includes(normalized);
}

export type public_marketing_api_access_via = 'bearer' | 'origin';

/** Shared with claim-free: `CLAIM_FREE_MINT_BEARER_TOKEN` or allowlisted browser caller. */
export function getPublicMarketingApiAccess(
  req: Request
): { allowed: true; via: public_marketing_api_access_via } | { allowed: false } {
  const bearer = verifyClaimFreeMintBearer(req);
  if (bearer.ok) return { allowed: true, via: 'bearer' };

  const caller = resolvePublicApiCallerOrigin(req);
  if (caller && isOriginAllowedForPublicPlans(caller)) {
    return { allowed: true, via: 'origin' };
  }

  return { allowed: false };
}

export function isPublicMarketingApiAccessAllowed(req: Request): boolean {
  return getPublicMarketingApiAccess(req).allowed;
}

export type public_plans_forbidden_reason =
  | 'env_not_configured'
  | 'missing_origin'
  | 'origin_not_allowed'
  | 'origin_header_spoofed';

export function getPublicPlansForbiddenReason(req: Request): public_plans_forbidden_reason {
  const allowed = getPublicPlansAllowedOrigins();
  if (allowed.length === 0) return 'env_not_configured';

  const caller = resolvePublicApiCallerOrigin(req);
  if (!caller) {
    const originOnly = req.headers.get('origin')?.trim();
    if (originOnly && originOnly !== 'null' && !hasFetchMetadata(req)) {
      return 'origin_header_spoofed';
    }
    return 'missing_origin';
  }

  if (!isOriginAllowedForPublicPlans(caller)) return 'origin_not_allowed';

  return 'origin_not_allowed';
}

function corsAllowOrigin(req: Request, caller: string): string {
  const browserOrigin = originFromBrowserOriginHeader(req);
  if (browserOrigin && isOriginAllowedForPublicPlans(browserOrigin)) {
    return browserOrigin;
  }
  if (isOriginAllowedForPublicPlans(caller)) return caller;
  return caller;
}

export function withPublicPlansCors(req: Request, response: NextResponse): NextResponse {
  const access = getPublicMarketingApiAccess(req);
  if (access.allowed) {
    let acao: string | null = null;
    if (access.via === 'origin') {
      const caller = resolvePublicApiCallerOrigin(req);
      if (caller && isOriginAllowedForPublicPlans(caller)) {
        acao = corsAllowOrigin(req, caller);
      }
    } else {
      const originHeader = req.headers.get('origin')?.trim();
      if (originHeader && originHeader !== 'null') {
        const norm = normalizePublicPlansOrigin(originHeader);
        if (isOriginAllowedForPublicPlans(norm)) acao = norm;
      }
    }
    if (acao) {
      response.headers.set('Access-Control-Allow-Origin', acao);
      response.headers.set('Vary', 'Origin');
    }
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }
  return response;
}

export function jsonWithPublicPlansCors(
  req: Request,
  body: unknown,
  init?: ResponseInit
): NextResponse {
  return withPublicPlansCors(req, NextResponse.json(body, init));
}