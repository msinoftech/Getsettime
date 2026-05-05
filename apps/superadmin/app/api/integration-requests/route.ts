import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function GET() {
  try {
    const supabase = getSupabaseServer();

    const { data, error } = await supabase
      .from('integration_requests')
      .select(
        'id, workspace_id, workspace_name, workspace_admin_email, subject, message, created_at, seen_at',
      )
      .order('created_at', { ascending: false });

    if (error) {
      console.error('integration_requests fetch:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ requests: data ?? [] }, { status: 200 });
  } catch (err: unknown) {
    console.error('GET integration-requests:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}
