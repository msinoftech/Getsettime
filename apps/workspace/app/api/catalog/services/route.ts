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

/** Catalog service names from services_list for a departments_list entry, resolved by profession id + department name. */
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
    const departmentName = searchParams.get('department')?.trim() || '';
    if (!professionIdRaw || !/^\d+$/.test(professionIdRaw) || !departmentName) {
      return NextResponse.json({ services: [] as string[] }, { status: 200 });
    }

    const professionId = Number(professionIdRaw);
    const supabase = createSupabaseServerClient();

    const { data: department, error: deptError } = await supabase
      .from('departments_list')
      .select('id')
      .eq('enabled', true)
      .eq('profession_id', professionId)
      .ilike('name', departmentName)
      .maybeSingle();

    if (deptError) {
      console.error('Error resolving departments_list entry:', deptError);
      return NextResponse.json({ error: deptError.message }, { status: 500 });
    }

    if (!department) {
      return NextResponse.json({ services: [] as string[] }, { status: 200 });
    }

    const { data: rows, error } = await supabase
      .from('services_list')
      .select('name')
      .eq('enabled', true)
      .eq('department_id', department.id)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching services_list:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const services = (rows ?? []).map((r) => r.name).filter(Boolean);

    return NextResponse.json({ services }, { status: 200 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('GET catalog services error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
