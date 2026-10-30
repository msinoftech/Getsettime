import { NextResponse } from 'next/server';
import {
  getClaimFreeAvailability,
  mintClaimCode,
} from '@app/db/subscription';
import {
  generateClaimCode,
  getAppBaseUrl,
  getClaimCodeTtlHours,
  getClaimFreeAllowedOrigins,
  getClaimFreeForbiddenReason,
  isOriginAllowedForClaimFree,
  jsonWithClaimFreeCors,
  resolveRequestOrigin,
  verifyClaimFreeMintBearer,
  withClaimFreeCors,
} from '@/lib/claim-free-http';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function OPTIONS(req: Request) {
  return withClaimFreeCors(req, new NextResponse(null, { status: 204 }));
}

export async function GET(req: Request) {
  const auth = verifyClaimFreeMintBearer(req);
  if (!auth.ok) {
    const status = auth.reason === 'env_not_configured' ? 500 : 401;
    const body: Record<string, unknown> = {
      error: status === 500 ? 'Server configuration error' : 'Unauthorized',
      reason: auth.reason,
    };
    if (process.env.NODE_ENV === 'development' && auth.reason !== 'env_not_configured') {
      body.hint =
        'Send Authorization: Bearer <CLAIM_FREE_MINT_BEARER_TOKEN> (set in apps/workspace/.env.local).';
    }
    if (process.env.NODE_ENV === 'development' && auth.reason === 'env_not_configured') {
      body.hint = 'Set CLAIM_FREE_MINT_BEARER_TOKEN in apps/workspace/.env.local and restart dev.';
    }
    return jsonWithClaimFreeCors(req, body, { status });
  }

  const origin = resolveRequestOrigin(req);
  if (!isOriginAllowedForClaimFree(origin)) {
    const reason = getClaimFreeForbiddenReason(req);
    const body: Record<string, unknown> = {
      error: 'Forbidden',
      reason,
    };
    if (process.env.NODE_ENV === 'development') {
      body.hint =
        reason === 'env_not_configured'
          ? 'Set CLAIM_FREE_ALLOWED_ORIGINS in apps/workspace/.env.local and restart dev server.'
          : reason === 'missing_origin'
            ? 'Send an Origin header (browser fetch from landing) or call this URL in development on a whitelisted host (e.g. localhost:3001).'
            : 'Origin must exactly match allowed whitelisted (no trailing slash).';
      body.resolved_origin = origin;
      // body.allowed_origins = getClaimFreeAllowedOrigins();
    }
    return jsonWithClaimFreeCors(req, body, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return jsonWithClaimFreeCors(req, { error: 'Server configuration error' }, { status: 500 });
  }

  const availability = await getClaimFreeAvailability(supabase);
  if (!availability.available) {
    return jsonWithClaimFreeCors(
      req,
      { ...availability, waitlist: true },
      { status: 200 }
    );
  }

  const ttlHours = getClaimCodeTtlHours();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  const code = generateClaimCode(20);

  await mintClaimCode(supabase, {
    code,
    origin: origin!,
    expiresAt,
  });

  const base = getAppBaseUrl(req);
  const redirectUrl = `${base}/register?claim_code=${encodeURIComponent(code)}`;

  return jsonWithClaimFreeCors(req, {
    available: true,
    redirectUrl,
    expiresAt,
  });
}
