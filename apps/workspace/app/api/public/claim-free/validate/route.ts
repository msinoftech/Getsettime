import { validateClaimCodeForSignup } from '@app/db/subscription';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get('claim_code')?.trim() ?? '';

  if (!code) {
    return NextResponse.json({ valid: false, message: 'Your claim is not valid.' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const result = await validateClaimCodeForSignup(supabase, code);
  if (!result.valid) {
    return NextResponse.json({ valid: false, message: result.message }, { status: 400 });
  }

  return NextResponse.json({ valid: true, expires_at: result.row.expires_at });
}
