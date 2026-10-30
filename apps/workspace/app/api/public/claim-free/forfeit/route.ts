import { createClient } from '@supabase/supabase-js';
import {
  addClaimIneligibleEmail,
  forfeitClaimCode,
  getClaimedCodeByCode,
} from '@app/db/subscription';
import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  let body: { claim_code?: string; email?: string; block_user?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const code = typeof body.claim_code === 'string' ? body.claim_code.trim() : '';
  if (!code) {
    return NextResponse.json({ error: 'claim_code is required' }, { status: 400 });
  }

  const row = await getClaimedCodeByCode(supabaseAdmin, code);

  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (row?.status === 'pending') {
    await forfeitClaimCode(
      supabaseAdmin,
      code,
      typeof body.email === 'string' ? body.email : null
    );
  }

  if (row?.status === 'consumed' && token) {
    const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const anon = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
    if (url && anon) {
      const verify = createClient(url, anon, {
        auth: { autoRefreshToken: false, persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const {
        data: { user },
      } = await verify.auth.getUser(token);
      if (user && row.user_id === user.id) {
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          user_metadata: {
            ...user.user_metadata,
            claim_free_blocked: true,
          },
        });
        if (user.email) {
          await addClaimIneligibleEmail(supabaseAdmin, user.email, 'forfeit_onboarding');
        }
      }
    }
  } else if (typeof body.email === 'string' && body.email.trim()) {
    await addClaimIneligibleEmail(supabaseAdmin, body.email, 'forfeit');
  }

  return NextResponse.json({ ok: true });
}
