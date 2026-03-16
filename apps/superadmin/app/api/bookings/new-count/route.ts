import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const supabaseServer = getSupabaseServer();

    const { count, error } = await supabaseServer
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('is_viewed', false);

    if (error) {
      console.error('Error fetching new bookings count:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ count: count ?? 0 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
