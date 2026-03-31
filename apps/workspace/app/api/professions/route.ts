import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';
import { createClient } from '@supabase/supabase-js';

function getAuthToken(req: NextRequest): string | null {
  return req.headers.get('authorization')?.replace('Bearer ', '') || null;
}

async function getAuthUser(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: { user }, error } = await client.auth.getUser(token);
  return error || !user ? null : user;
}

export async function GET(req: NextRequest) {
  try {
    const token = getAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getAuthUser(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('professions_list')
      .select('id, name')
      .eq('enabled', true)
      .order('id', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ professions: data || [] });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
