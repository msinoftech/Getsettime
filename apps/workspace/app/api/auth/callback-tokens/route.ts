import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const COOKIE_NAME = 'sb_callback_t';
const MAX_AGE_SEC = 120; // token valid for 2 minutes

export async function GET(req: Request) {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) {
      const { searchParams } = new URL(req.url);
      token = searchParams.get('t') ?? undefined;
    }
    if (!token) {
      return NextResponse.json({ error: 'no_callback_token' }, { status: 401 });
    }

    const supabaseUrl = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
    const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '').trim();
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'server_config' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: row, error: fetchErr } = await supabase
      .from('auth_callback_tokens')
      .select('access_token, refresh_token, created_at')
      .eq('id', token)
      .single();

    if (fetchErr || !row) {
      const res = NextResponse.json({ error: 'invalid_or_expired' }, { status: 401 });
      res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
      return res;
    }

    const created = row.created_at ? new Date(row.created_at).getTime() : 0;
    if (Date.now() - created > MAX_AGE_SEC * 1000) {
      await supabase.from('auth_callback_tokens').delete().eq('id', token);
      const res = NextResponse.json({ error: 'invalid_or_expired' }, { status: 401 });
      res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
      return res;
    }

    await supabase.from('auth_callback_tokens').delete().eq('id', token);

    const res = NextResponse.json({
      access_token: row.access_token,
      refresh_token: row.refresh_token ?? '',
    });
    res.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' });
    return res;
  } catch {
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }
}
