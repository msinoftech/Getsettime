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

/** Catalog department names for onboarding, from departments_list by professions_list id. */
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

    const { searchParams } = new URL(req.url);
    const professionIdRaw = searchParams.get('profession_id');
    if (!professionIdRaw || !/^\d+$/.test(professionIdRaw)) {
      return NextResponse.json({ departments: [] as string[] }, { status: 200 });
    }

    const professionId = Number(professionIdRaw);
    const supabase = createSupabaseServerClient();

    const { data: rows, error } = await supabase
      .from('departments_list')
      .select('name')
      .eq('enabled', true)
      .eq('profession_id', professionId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching departments_list:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const departments = (rows ?? []).map((r) => r.name).filter(Boolean);

    return NextResponse.json({ departments }, { status: 200 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('GET catalog departments error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
