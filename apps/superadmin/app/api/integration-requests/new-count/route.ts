import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const supabase = getSupabaseServer();

    const { count, error } = await supabase
      .from('integration_requests')
      .select('*', { count: 'exact', head: true })
      .is('seen_at', null);

    if (error) {
      console.error('integration_requests new-count:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ count: count ?? 0 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('integration-requests new-count:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
