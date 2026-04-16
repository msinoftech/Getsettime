import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

function flatten_service_row(row: Record<string, unknown>) {
  const dep = row.departments_list as { name?: string } | null | undefined;
  const { departments_list: _d, ...rest } = row;
  return { ...rest, department_name: dep?.name ?? null };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolved = await Promise.resolve(params);
    const id = resolved.id;
    const body = await req.json();
    const { name, enabled, department_id } = body as {
      name?: unknown;
      enabled?: unknown;
      department_id?: unknown;
    };

    if (name === undefined && enabled === undefined && department_id === undefined) {
      return NextResponse.json(
        { error: 'Provide name, enabled, and/or department_id' },
        { status: 400 }
      );
    }

    const patch: Record<string, unknown> = {};

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

    if (department_id !== undefined) {
      if (typeof department_id !== 'number' || !Number.isFinite(department_id) || department_id <= 0) {
        return NextResponse.json({ error: 'department_id must be a positive number' }, { status: 400 });
      }
      patch.department_id = department_id;
    }

    const supabaseServer = getSupabaseServer();

    const { data: current, error: curErr } = await supabaseServer
      .from('services_list')
      .select('id, name, department_id')
      .eq('id', id)
      .maybeSingle();

    if (curErr || !current) {
      return NextResponse.json({ error: 'Service not found' }, { status: 404 });
    }

    if (patch.department_id !== undefined) {
      const { data: depOk } = await supabaseServer
        .from('departments_list')
        .select('id')
        .eq('id', patch.department_id as number)
        .maybeSingle();
      if (!depOk) {
        return NextResponse.json({ error: 'Invalid department' }, { status: 400 });
      }
    }

    const nextName = typeof patch.name === 'string' ? patch.name : current.name;
    const nextDepartmentId =
      patch.department_id !== undefined ? (patch.department_id as number) : current.department_id;

    if (name !== undefined || department_id !== undefined) {
      const { data: existing } = await supabaseServer
        .from('services_list')
        .select('id')
        .ilike('name', nextName)
        .eq('department_id', nextDepartmentId)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: 'A service with this name already exists for this department' },
          { status: 409 }
        );
      }
    }

    const { data: row, error } = await supabaseServer
      .from('services_list')
      .update(patch)
      .eq('id', id)
      .select('id, name, enabled, created_at, department_id, departments_list(name)')
      .single();

    if (error) {
      console.error('PATCH services-list error:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Service not found' }, { status: 404 });
      }
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A service with this name already exists for this department' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { service: flatten_service_row(row as Record<string, unknown>), message: 'Updated' },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('PATCH services-list error:', err);
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

    const { error } = await supabaseServer.from('services_list').delete().eq('id', id);

    if (error) {
      console.error('DELETE services-list error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Deleted' }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('DELETE services-list error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
