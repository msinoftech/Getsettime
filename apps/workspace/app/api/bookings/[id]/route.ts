import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET a single booking by id. Used by the standalone booking details page
 * (/bookings/[id]) so that a shareable link resolves to the booking record
 * with the same `creator` enrichment we return from the list endpoint.
 *
 * RLS still gates which rows the caller can read; this route simply narrows
 * to a specific id and resolves the `host_user_id` into a human-readable
 * creator via the service role.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'Booking id is required' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, event_types(title, duration_minutes), contacts(name, phone, email)')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching booking:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (String(booking.status ?? '').toLowerCase() === 'deleted') {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    let creator: {
      id: string;
      name: string;
      email: string | null;
    } | null = null;

    const hostUserId =
      typeof booking.host_user_id === 'string' && booking.host_user_id.length > 0
        ? booking.host_user_id
        : null;

    if (hostUserId) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceKey) {
        try {
          const adminClient = createClient(supabaseUrl, serviceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });
          const { data: userResult } =
            await adminClient.auth.admin.getUserById(hostUserId);
          const creatorUser = userResult?.user ?? null;
          if (creatorUser) {
            const meta = (creatorUser.user_metadata || {}) as Record<
              string,
              unknown
            >;
            const rawName =
              typeof meta.name === 'string' ? meta.name.trim() : '';
            const rawFullName =
              typeof meta.full_name === 'string' ? meta.full_name.trim() : '';
            const emailPrefix =
              typeof creatorUser.email === 'string' &&
              creatorUser.email.includes('@')
                ? creatorUser.email.split('@')[0]
                : '';
            creator = {
              id: hostUserId,
              name: rawName || rawFullName || emailPrefix || 'Unknown',
              email: creatorUser.email ?? null,
            };
          }
        } catch (lookupError) {
          console.error('Creator lookup failed:', lookupError);
        }
      }
    }

    return NextResponse.json({ data: { ...booking, creator } });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
