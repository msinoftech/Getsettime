import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const supabaseServer = getSupabaseServer();

    const { data: rows, error } = await supabaseServer
      .from('professions_list')
      .select('id, name, icon, enabled, created_at, updated_at')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching professions_list:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ professions: rows ?? [] }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('GET professions-list error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, icon } = body as { name?: unknown; icon?: unknown };

    if (typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (icon !== undefined && typeof icon !== 'string') {
      return NextResponse.json({ error: 'Icon must be a string' }, { status: 400 });
    }

    const trimmed = name.trim();
    const trimmedIcon = typeof icon === 'string' && icon.trim() ? icon.trim() : 'FcBriefcase';
    const supabaseServer = getSupabaseServer();

    const { data: existing } = await supabaseServer
      .from('professions_list')
      .select('id')
      .ilike('name', trimmed)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'A profession with this name already exists' }, { status: 409 });
    }

    const { data: row, error } = await supabaseServer
      .from('professions_list')
      .insert({ name: trimmed, icon: trimmedIcon, enabled: true })
      .select('id, name, icon, enabled, created_at, updated_at')
      .single();

    if (error) {
      console.error('Error creating professions_list row:', error);
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A profession with this name already exists' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { profession: row, message: 'Profession catalog entry created' },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('POST professions-list error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
