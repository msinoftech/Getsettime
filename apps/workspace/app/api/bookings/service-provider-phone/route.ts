import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@app/db';
import { get_service_provider_phone_by_booking_id } from '@/lib/booking_service_provider_phone';

/**
 * GET ?booking_id= — host-side phone (assigned provider, else workspace owner).
 * Scoped to the caller's workspace.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || null;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json(
        { error: 'Workspace ID not found' },
        { status: 400 }
      );
    }

    const bookingId = new URL(req.url).searchParams.get('booking_id');
    if (!bookingId?.trim()) {
      return NextResponse.json(
        { error: 'booking_id is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();
    const phone = await get_service_provider_phone_by_booking_id(
      supabase,
      bookingId.trim(),
      { workspace_id: workspaceId }
    );

    if (phone === null) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    return NextResponse.json({ phone });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('service-provider-phone GET:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
