import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    const body = await req.json();
    const { name, enabled, icon } = body as { name?: unknown; enabled?: unknown; icon?: unknown };

    if (name === undefined && enabled === undefined && icon === undefined) {
      return NextResponse.json({ error: 'Provide name and/or enabled and/or icon' }, { status: 400 });
    }

    const supabaseServer = getSupabaseServer();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return NextResponse.json({ error: 'Name is required when provided' }, { status: 400 });
      }
      const trimmedName = name.trim();

      const { data: existing } = await supabaseServer
        .from('professions_list')
        .select('id')
        .ilike('name', trimmedName)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: 'A profession with this name already exists' },
          { status: 409 }
        );
      }
      patch.name = trimmedName;
    }

    if (enabled !== undefined) {
      if (typeof enabled !== 'boolean') {
        return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
      }
      patch.enabled = enabled;
    }

    if (icon !== undefined) {
      if (typeof icon !== 'string') {
        return NextResponse.json({ error: 'icon must be a string' }, { status: 400 });
      }
      patch.icon = icon.trim() || 'FcBriefcase';
    }

    const { data: profession, error } = await supabaseServer
      .from('professions_list')
      .update(patch)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating professions_list:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Profession not found' }, { status: 404 });
      }
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A profession with this name already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { profession, message: 'Profession catalog updated successfully' },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('PUT professions-list error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;

    const supabaseServer = getSupabaseServer();

    const { data: linked } = await supabaseServer
      .from('departments_list')
      .select('id')
      .eq('profession_id', id)
      .limit(1);

    if (linked && linked.length > 0) {
      return NextResponse.json(
        {
          error:
            'Cannot delete this catalog profession because departments are linked to it. Reassign or remove those departments first.',
        },
        { status: 409 }
      );
    }

    const { error } = await supabaseServer.from('professions_list').delete().eq('id', id);

    if (error) {
      console.error('Error deleting professions_list:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Profession catalog entry deleted successfully' }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('DELETE professions-list error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
