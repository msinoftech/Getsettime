import { NextResponse } from 'next/server';
import {
  getPublicMarketingApiAccess,
  getPublicPlansForbiddenReason,
  jsonWithPublicPlansCors,
} from '@/lib/public-plans-http';
import { verifyClaimFreeMintBearer } from '@/lib/claim-free-http';

/**
 * Guard for `/api/public/*` marketing routes (plans, subscribers, future APIs).
 * Uses the same Bearer secret as claim-free mint (`CLAIM_FREE_MINT_BEARER_TOKEN`)
 * or an allowlisted browser caller (Referer / Sec-Fetch + Origin).
 *
 * Returns a ready JSON response when blocked; otherwise `null`.
 */
export function guardPublicMarketingApi(req: Request): NextResponse | null {
  if (getPublicMarketingApiAccess(req).allowed) return null;

  const bearer = verifyClaimFreeMintBearer(req);
  if (!bearer.ok) {
    if (bearer.reason === 'env_not_configured') {
      const body: Record<string, unknown> = {
        error: 'Server configuration error',
        reason: 'env_not_configured',
      };
      if (process.env.NODE_ENV === 'development') {
        body.hint = 'Set CLAIM_FREE_MINT_BEARER_TOKEN in apps/workspace/.env.local and restart dev.';
      }
      return jsonWithPublicPlansCors(req, body, { status: 500 });
    }

    if (bearer.reason === 'invalid_bearer') {
      return jsonWithPublicPlansCors(
        req,
        { error: 'Unauthorized', reason: 'invalid_bearer' },
        { status: 401 }
      );
    }

    const reason = getPublicPlansForbiddenReason(req);
    const body: Record<string, unknown> = {
      error: 'Forbidden',
      reason,
      bearer: bearer.reason,
    };
    if (process.env.NODE_ENV === 'development') {
      body.hint =
        'Call from an allowlisted site in the browser, or send Authorization: Bearer <CLAIM_FREE_MINT_BEARER_TOKEN> (landing server only).';
    }
    return jsonWithPublicPlansCors(req, body, { status: 403 });
  }

  const reason = getPublicPlansForbiddenReason(req);
  const body: Record<string, unknown> = { error: 'Forbidden', reason };
  if (process.env.NODE_ENV === 'development') {
    body.hint =
      'Call from an allowlisted site in the browser, or send Authorization: Bearer <CLAIM_FREE_MINT_BEARER_TOKEN> (landing server only).';
  }
  return jsonWithPublicPlansCors(req, body, { status: 403 });
}

/** Paths under `/api/public` that implement their own auth (claim-free). */
export const PUBLIC_API_SELF_AUTH_PREFIX = '/api/public/claim-free';

export function isPublicApiSelfAuthPath(pathname: string): boolean {
  return pathname === PUBLIC_API_SELF_AUTH_PREFIX || pathname.startsWith(`${PUBLIC_API_SELF_AUTH_PREFIX}/`);
}