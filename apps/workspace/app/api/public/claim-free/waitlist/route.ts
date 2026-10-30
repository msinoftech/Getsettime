import { NextResponse } from 'next/server';
import { registerClaimFreeWaitlistEmail } from '@app/db/subscription';
import {
  getClaimFreeForbiddenReason,
  isOriginAllowedForClaimFree,
  jsonWithClaimFreeCors,
  resolveRequestOrigin,
  withClaimFreeCors,
} from '@/lib/claim-free-http';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function OPTIONS(req: Request) {
  return withClaimFreeCors(req, new NextResponse(null, { status: 204 }));
}

export async function POST(req: Request) {
  const origin = resolveRequestOrigin(req);
  if (!isOriginAllowedForClaimFree(origin)) {
    return jsonWithClaimFreeCors(
      req,
      {
        error: 'Forbidden',
        reason: getClaimFreeForbiddenReason(req),
      },
      { status: 403 }
    );
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return jsonWithClaimFreeCors(req, { error: 'Server configuration error' }, { status: 500 });
  }

  let body: { email?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return jsonWithClaimFreeCors(req, { error: 'Invalid JSON' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return jsonWithClaimFreeCors(req, { error: 'Valid email is required' }, { status: 400 });
  }

  await registerClaimFreeWaitlistEmail(supabase, email, body.source);
  return jsonWithClaimFreeCors(req, { ok: true });
}
