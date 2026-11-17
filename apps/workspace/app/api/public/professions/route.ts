import { NextResponse } from 'next/server';
import { listPublicProfessionsList } from '@app/db/public_professions_list';
import { guardPublicMarketingApi } from '@/lib/public-api-auth';
import { jsonWithPublicPlansCors, withPublicPlansCors } from '@/lib/public-plans-http';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function OPTIONS(req: Request) {
  return withPublicPlansCors(req, new NextResponse(null, { status: 204 }));
}

/** Read-only enabled professions from `professions_list` (allowlisted / Bearer). */
export async function GET(req: Request) {
  const denied = guardPublicMarketingApi(req);
  if (denied) return denied;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return jsonWithPublicPlansCors(req, { error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const professions = await listPublicProfessionsList(supabase);
    return jsonWithPublicPlansCors(req, { professions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('GET /api/public/professions:', err);
    return jsonWithPublicPlansCors(req, { error: message }, { status: 500 });
  }
}