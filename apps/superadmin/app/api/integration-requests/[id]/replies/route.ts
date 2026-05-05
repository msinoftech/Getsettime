import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid request id' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    const { data: requestRow, error: reqErr } = await supabase
      .from('integration_requests')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (reqErr) {
      console.error('integration_requests replies fetch parent:', reqErr);
      return NextResponse.json({ error: reqErr.message }, { status: 500 });
    }
    if (!requestRow) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('integration_request_replies')
      .select('id, integration_request_id, subject, message, created_at')
      .eq('integration_request_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('integration_request_replies fetch:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ replies: data ?? [] });
  } catch (err: unknown) {
    console.error('GET integration-requests [id] replies:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unexpected error' },
      { status: 500 },
    );
  }
}
