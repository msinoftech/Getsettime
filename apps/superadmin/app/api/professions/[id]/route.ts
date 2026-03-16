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
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();
    const supabaseServer = getSupabaseServer();

    const { data: existing } = await supabaseServer
      .from('professions')
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

    const { data: profession, error } = await supabaseServer
      .from('professions')
      .update({ name: trimmedName })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating profession:', error);
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
      { profession, message: 'Profession updated successfully' },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('PUT profession error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;

    const supabaseServer = getSupabaseServer();

    const { data: linked } = await supabaseServer
      .from('workspaces')
      .select('id')
      .eq('profession_id', id)
      .limit(1);

    if (linked && linked.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete this profession because it is assigned to one or more workspaces' },
        { status: 409 }
      );
    }

    const { error } = await supabaseServer
      .from('professions')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting profession:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { message: 'Profession deleted successfully' },
      { status: 200 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('DELETE profession error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
