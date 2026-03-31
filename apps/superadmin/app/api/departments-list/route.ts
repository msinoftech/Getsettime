import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

function flatten_department_row(row: Record<string, unknown>) {
  const prof = row.professions_list as { name?: string } | null | undefined;
  const { professions_list: _p, ...rest } = row;
  return { ...rest, profession_name: prof?.name ?? null };
}

export async function GET() {
  try {
    const supabaseServer = getSupabaseServer();

    const { data: departments, error } = await supabaseServer
      .from('departments_list')
      .select('id, name, enabled, created_at, updated_at, profession_id, professions_list(name)')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching departments_list:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (departments ?? []).map((row) =>
      flatten_department_row(row as Record<string, unknown>)
    );

    return NextResponse.json({ departments: rows }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('GET departments-list error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, profession_id } = body as { name?: unknown; profession_id?: unknown };

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (typeof profession_id !== 'number' || !Number.isFinite(profession_id) || profession_id <= 0) {
      return NextResponse.json({ error: 'Profession is required' }, { status: 400 });
    }

    const trimmed = name.trim();
    const supabaseServer = getSupabaseServer();

    const { data: profOk } = await supabaseServer
      .from('professions_list')
      .select('id')
      .eq('id', profession_id)
      .maybeSingle();

    if (!profOk) {
      return NextResponse.json({ error: 'Invalid profession' }, { status: 400 });
    }

    const { data: existing } = await supabaseServer
      .from('departments_list')
      .select('id')
      .ilike('name', trimmed)
      .eq('profession_id', profession_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'A department with this name already exists for this profession' },
        { status: 409 }
      );
    }

    const { data: row, error } = await supabaseServer
      .from('departments_list')
      .insert({ name: trimmed, enabled: true, profession_id })
      .select('id, name, enabled, created_at, updated_at, profession_id, professions_list(name)')
      .single();

    if (error) {
      console.error('Error creating departments_list row:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A department with this name already exists for this profession' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!row) {
      return NextResponse.json({ error: 'Failed to create department' }, { status: 500 });
    }

    return NextResponse.json(
      { department: flatten_department_row(row as Record<string, unknown>), message: 'Department created' },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('POST departments-list error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
