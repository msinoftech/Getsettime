import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

/** Superadmin restores a soft-deleted booking (workspace app cannot undelete). */
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Booking id required' }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const targetStatusRaw = typeof body.status === 'string' ? body.status.trim().toLowerCase() : '';
    const restoredStatus =
      targetStatusRaw && targetStatusRaw !== 'deleted' ? body.status.trim() : 'cancelled';

    const db = getSupabaseServer();

    const { data: booking, error: fetchErr } = await db
      .from('bookings')
      .select('id,status')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (String(booking.status ?? '').toLowerCase() !== 'deleted') {
      return NextResponse.json(
        { error: 'Only bookings marked deleted can be restored from this endpoint' },
        { status: 400 }
      );
    }

    const { data: updated, error: updErr } = await db
      .from('bookings')
      .update({
        status: restoredStatus === 'deleted' ? 'cancelled' : restoredStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updErr || !updated) {
      console.error('[superadmin] restore booking', updErr);
      return NextResponse.json({ error: updErr?.message || 'Update failed' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: updated });
  } catch (e: unknown) {
    console.error('[superadmin] PATCH bookings/[id]', e);
    const msg = e instanceof Error ? e.message : 'Server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
