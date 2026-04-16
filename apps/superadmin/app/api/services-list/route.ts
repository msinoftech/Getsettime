import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

function flatten_service_row(row: Record<string, unknown>) {
  const dep = row.departments_list as { name?: string } | null | undefined;
  const { departments_list: _d, ...rest } = row;
  return { ...rest, department_name: dep?.name ?? null };
}

export async function GET() {
  try {
    const supabaseServer = getSupabaseServer();

    const { data: services, error } = await supabaseServer
      .from('services_list')
      .select('id, name, enabled, created_at, department_id, departments_list(name)')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching services_list:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (services ?? []).map((row) =>
      flatten_service_row(row as Record<string, unknown>)
    );

    return NextResponse.json({ services: rows }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('GET services-list error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, department_id } = body as { name?: unknown; department_id?: unknown };

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (typeof department_id !== 'number' || !Number.isFinite(department_id) || department_id <= 0) {
      return NextResponse.json({ error: 'Department is required' }, { status: 400 });
    }

    const trimmed = name.trim();
    const supabaseServer = getSupabaseServer();

    const { data: depOk } = await supabaseServer
      .from('departments_list')
      .select('id')
      .eq('id', department_id)
      .maybeSingle();

    if (!depOk) {
      return NextResponse.json({ error: 'Invalid department' }, { status: 400 });
    }

    const { data: existing } = await supabaseServer
      .from('services_list')
      .select('id')
      .ilike('name', trimmed)
      .eq('department_id', department_id)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'A service with this name already exists for this department' },
        { status: 409 }
      );
    }

    const { data: row, error } = await supabaseServer
      .from('services_list')
      .insert({ name: trimmed, enabled: true, department_id })
      .select('id, name, enabled, created_at, department_id, departments_list(name)')
      .single();

    if (error) {
      console.error('Error creating services_list row:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A service with this name already exists for this department' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (!row) {
      return NextResponse.json({ error: 'Failed to create service' }, { status: 500 });
    }

    return NextResponse.json(
      { service: flatten_service_row(row as Record<string, unknown>), message: 'Service created' },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('POST services-list error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
