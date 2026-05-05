import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Marks one integration request as seen (decrements "new" count only when it was unseen). */
export async function POST(_req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!id || !UUID_RE.test(id)) {
      return NextResponse.json({ error: 'Invalid request id' }, { status: 400 });
    }

    const supabase = getSupabaseServer();
    const now = new Date().toISOString();

    const { data: row, error: fetchErr } = await supabase
      .from('integration_requests')
      .select('id, seen_at')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) {
      console.error('integration_requests mark-seen fetch:', fetchErr);
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (row.seen_at != null) {
      return NextResponse.json({ success: true, marked: false });
    }

    const { error: updateErr } = await supabase
      .from('integration_requests')
      .update({ seen_at: now })
      .eq('id', id)
      .is('seen_at', null);

    if (updateErr) {
      console.error('integration_requests mark-seen update:', updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, marked: true });
  } catch (err: unknown) {
    console.error('integration-requests [id] mark-seen:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    );
  }
}
