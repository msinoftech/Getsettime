import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

/** Enabled department names for workspace onboarding, filtered by catalog profession. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const professionIdRaw = searchParams.get('profession_id');
    if (!professionIdRaw || !/^\d+$/.test(professionIdRaw)) {
      return NextResponse.json({ departments: [] as string[] }, { status: 200 });
    }

    const professionId = Number(professionIdRaw);
    const supabaseServer = getSupabaseServer();

    const { data: rows, error } = await supabaseServer
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
    console.error('GET departments error:', error);
    return NextResponse.json(
      { error: error?.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
