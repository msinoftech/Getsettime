import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

function flatten_department_row(row: Record<string, unknown>) {
  const prof = row.professions_list as { name?: string } | null | undefined;
  const { professions_list: _p, ...rest } = row;
  return { ...rest, profession_name: prof?.name ?? null };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolved = await Promise.resolve(params);
    const id = resolved.id;
    const body = await req.json();
    const { name, enabled, profession_id } = body as {
      name?: unknown;
      enabled?: unknown;
      profession_id?: unknown;
    };

    if (name === undefined && enabled === undefined && profession_id === undefined) {
      return NextResponse.json({ error: 'Provide name, enabled, and/or profession_id' }, { status: 400 });
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 });
      }
      patch.name = name.trim();
    }

    if (enabled !== undefined) {
      if (typeof enabled !== 'boolean') {
        return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
      }
      patch.enabled = enabled;
    }

    if (profession_id !== undefined) {
      if (typeof profession_id !== 'number' || !Number.isFinite(profession_id) || profession_id <= 0) {
        return NextResponse.json({ error: 'profession_id must be a positive number' }, { status: 400 });
      }
      patch.profession_id = profession_id;
    }

    const supabaseServer = getSupabaseServer();

    const { data: current, error: curErr } = await supabaseServer
      .from('departments_list')
      .select('id, name, profession_id')
      .eq('id', id)
      .maybeSingle();

    if (curErr || !current) {
      return NextResponse.json({ error: 'Department not found' }, { status: 404 });
    }

    if (patch.profession_id !== undefined) {
      const { data: profOk } = await supabaseServer
        .from('professions_list')
        .select('id')
        .eq('id', patch.profession_id as number)
        .maybeSingle();
      if (!profOk) {
        return NextResponse.json({ error: 'Invalid profession' }, { status: 400 });
      }
    }

    const nextName = typeof patch.name === 'string' ? patch.name : current.name;
    const nextProfId =
      patch.profession_id !== undefined ? (patch.profession_id as number) : current.profession_id;

    if (name !== undefined || profession_id !== undefined) {
      if (nextProfId == null) {
        return NextResponse.json(
          { error: 'Assign a profession before changing the name' },
          { status: 400 }
        );
      }
      const { data: existing } = await supabaseServer
        .from('departments_list')
        .select('id')
        .ilike('name', nextName)
        .eq('profession_id', nextProfId)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: 'A department with this name already exists for this profession' },
          { status: 409 }
        );
      }
    }

    const { data: row, error } = await supabaseServer
      .from('departments_list')
      .update(patch)
      .eq('id', id)
      .select('id, name, enabled, created_at, updated_at, profession_id, professions_list(name)')
      .single();

    if (error) {
      console.error('PATCH departments-list error:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Department not found' }, { status: 404 });
      }
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A department with this name already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { department: flatten_department_row(row as Record<string, unknown>), message: 'Updated' },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('PATCH departments-list error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolved = await Promise.resolve(params);
    const id = resolved.id;
    const supabaseServer = getSupabaseServer();

    const { error } = await supabaseServer.from('departments_list').delete().eq('id', id);

    if (error) {
      console.error('DELETE departments-list error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Deleted' }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('DELETE departments-list error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
