import crypto from 'crypto';
import { NextResponse } from 'next/server';

const ALPHANUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Strip trailing slashes so `https://a.com/` matches browser `Origin: https://a.com` */
export function normalizeClaimFreeOrigin(value: string): string {
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

/** Shared secret for minting claim links (`Authorization: Bearer …`). */
export function getClaimFreeMintBearerToken(): string | null {
  const raw = process.env.CLAIM_FREE_MINT_BEARER_TOKEN?.trim();
  return raw || null;
}

function timingSafeEqualString(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export type claim_free_mint_auth_result =
  | { ok: true }
  | { ok: false; reason: 'env_not_configured' | 'missing_bearer' | 'invalid_bearer' };

export function verifyClaimFreeMintBearer(req: Request): claim_free_mint_auth_result {
  const expected = getClaimFreeMintBearerToken();
  if (!expected) return { ok: false, reason: 'env_not_configured' };

  const auth = req.headers.get('authorization')?.trim();
  if (!auth || !/^bearer\s+/i.test(auth)) {
    return { ok: false, reason: 'missing_bearer' };
  }

  const token = auth.replace(/^bearer\s+/i, '').trim();
  if (!token || !timingSafeEqualString(token, expected)) {
    return { ok: false, reason: 'invalid_bearer' };
  }

  return { ok: true };
}

export function getClaimFreeAllowedOrigins(): string[] {
  const raw = (process.env.CLAIM_FREE_ALLOWED_ORIGINS || '').trim();
  if (!raw) return [];
  const parsed = raw
    .split(',')
    .map((o) => normalizeClaimFreeOrigin(o))
    .filter(Boolean);
  return expandDevOriginAliases(parsed);
}

function originFromRequestUrl(req: Request): string | null {
  try {
    return normalizeClaimFreeOrigin(new URL(req.url).origin);
  } catch {
    return null;
  }
}

/** When `req.url` is path-only, derive origin from Host (typical for some API clients). */
function originFromHostHeader(req: Request): string | null {
  const host = req.headers.get('host')?.trim();
  if (!host) return null;
  const forwarded = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  const proto =
    forwarded ||
    (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https');
  try {
    return normalizeClaimFreeOrigin(`${proto}://${host}`);
  } catch {
    return null;
  }
}

function allowRequestHostAsOrigin(): boolean {
  if (process.env.CLAIM_FREE_ALLOW_REQUEST_HOST === 'true') return true;
  return process.env.NODE_ENV === 'development';
}

/**
 * Whitelist check uses the caller's Origin (browser landing page).
 * Postman/curl must send `Origin: https://your-landing.example.com` or, in dev,
 * call the API on an allowed host (e.g. http://localhost:3001/...).
 */
export function resolveRequestOrigin(req: Request): string | null {
  const originHeader = req.headers.get('origin')?.trim();
  if (originHeader && originHeader !== 'null') {
    return normalizeClaimFreeOrigin(originHeader);
  }

  const referer = req.headers.get('referer')?.trim();
  if (referer) {
    try {
      return normalizeClaimFreeOrigin(new URL(referer).origin);
    } catch {
      /* ignore */
    }
  }

  if (allowRequestHostAsOrigin()) {
    return originFromRequestUrl(req) ?? originFromHostHeader(req);
  }

  return null;
}

export function isOriginAllowedForClaimFree(origin: string | null): boolean {
  if (!origin) return false;
  const normalized = normalizeClaimFreeOrigin(origin);
  const allowed = getClaimFreeAllowedOrigins();
  return allowed.includes(normalized);
}

export type claim_free_forbidden_reason =
  | 'env_not_configured'
  | 'missing_origin'
  | 'origin_not_allowed';

export function getClaimFreeForbiddenReason(
  req: Request
): claim_free_forbidden_reason {
  const allowed = getClaimFreeAllowedOrigins();
  if (allowed.length === 0) return 'env_not_configured';

  const resolved = resolveRequestOrigin(req);
  if (!resolved) return 'missing_origin';

  if (!isOriginAllowedForClaimFree(resolved)) return 'origin_not_allowed';

  return 'origin_not_allowed';
}

export function withClaimFreeCors(
  req: Request,
  response: NextResponse
): NextResponse {
  const origin = resolveRequestOrigin(req);
  if (origin && isOriginAllowedForClaimFree(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Vary', 'Origin');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization'
    );
  }
  return response;
}

export function jsonWithClaimFreeCors(
  req: Request,
  body: unknown,
  init?: ResponseInit
): NextResponse {
  return withClaimFreeCors(req, NextResponse.json(body, init));
}

export function generateClaimCode(length = 20): string {
  const bytes = crypto.randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHANUM[bytes[i]! % ALPHANUM.length];
  }
  return out;
}

export function getClaimCodeTtlHours(): number {
  const raw = process.env.CLAIM_FREE_CODE_TTL_HOURS?.trim();
  const n = raw ? parseInt(raw, 10) : 24;
  return Number.isFinite(n) && n > 0 ? n : 24;
}

export function getAppBaseUrl(req: Request): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (env) return env.replace(/\/$/, '');
  try {
    const url = new URL(req.url);
    return `${url.protocol}//${url.host}`;
  } catch {
    return '';
  }
}
