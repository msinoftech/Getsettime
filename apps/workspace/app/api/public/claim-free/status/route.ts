import { NextResponse } from 'next/server';
import { getClaimFreeAvailability } from '@app/db/subscription';
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

export async function GET(req: Request) {
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

  const availability = await getClaimFreeAvailability(supabase);
  return jsonWithClaimFreeCors(req, availability);
}
