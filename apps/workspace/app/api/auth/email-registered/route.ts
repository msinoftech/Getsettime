import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Returns whether an email is registered in Supabase Auth.
 * Enables distinguishing "no account" from "wrong password" after failed password login.
 * Same email-enumeration tradeoff as typical "forgot password" flows.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const email = typeof body?.email === 'string' ? body.email.trim() : '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
    }

    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const supabaseServiceKey = (
      process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    ).trim();

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 });
    const found = listData?.users?.some((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? false;

    return NextResponse.json({ registered: found });
  } catch (err: unknown) {
    console.error('email-registered error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
