import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const idNum = Number(id);
    if (!Number.isFinite(idNum) || idNum < 1) {
      return NextResponse.json({ error: 'Invalid event type id' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('event_types')
      .select('*')
      .eq('id', idNum)
      .maybeSingle();

    if (error) {
      console.error('Error fetching event type:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Event type not found' }, { status: 404 });
    }

    const { count, error: countError } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('event_type_id', idNum);

    if (countError) {
      console.error('Error fetching booking count:', countError);
    }

    return NextResponse.json({
      data: {
        ...data,
        bookings_count: count ?? 0,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('Error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
