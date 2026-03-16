import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const supabaseServer = getSupabaseServer();

    const { data: professions, error } = await supabaseServer
      .from('professions')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching professions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ professions: professions || [] }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('GET professions error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const trimmedName = name.trim();

    const supabaseServer = getSupabaseServer();

    const { data: existing } = await supabaseServer
      .from('professions')
      .select('id, name')
      .ilike('name', trimmedName)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'A profession with this name already exists' },
        { status: 409 }
      );
    }

    const { data: profession, error } = await supabaseServer
      .from('professions')
      .insert({ name: trimmedName })
      .select()
      .single();

    if (error) {
      console.error('Error creating profession:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'A profession with this name already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { profession, message: 'Profession created successfully' },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('POST profession error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
