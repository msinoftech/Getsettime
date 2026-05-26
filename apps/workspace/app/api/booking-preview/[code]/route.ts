import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';
import { fetchGoogleMeetLinkForCalendarEvent } from '@/lib/google-calendar-service';
import {
  booking_wants_google_meet,
  merge_meet_into_booking_location,
  resolve_meeting_join_url_from_booking,
} from '@/src/utils/google_meet';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, event_types(title, duration_minutes, location_type), contacts(name, phone, email)')
      .eq('public_code', code)
      .single();

    if (error || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const workspaceId = booking.workspace_id;

    try {
      const meta =
        booking.metadata && typeof booking.metadata === 'object'
          ? (booking.metadata as Record<string, unknown>)
          : null;
      const gcalId =
        typeof meta?.google_calendar_event_id === 'string'
          ? meta.google_calendar_event_id.trim()
          : '';
      if (
        booking_wants_google_meet(booking.location) &&
        !resolve_meeting_join_url_from_booking(booking.location, booking.metadata) &&
        gcalId
      ) {
        const meetLink = await fetchGoogleMeetLinkForCalendarEvent({
          workspaceId: Number(workspaceId),
          serviceProviderId: booking.service_provider_id || null,
          eventId: gcalId,
        });
        if (meetLink?.trim()) {
          const nextLoc = merge_meet_into_booking_location(
            booking.location as Record<string, unknown> | null,
            meetLink.trim()
          );
          const { error: patchErr } = await supabase
            .from('bookings')
            .update({ location: nextLoc })
            .eq('id', booking.id)
            .eq('public_code', code);
          if (!patchErr) {
            booking.location = nextLoc;
          }
        }
      }
    } catch (hydrateErr) {
      console.warn('booking-preview Google Meet hydrate skipped:', hydrateErr);
    }

    const [deptResult, providerResult, servicesResult, configResult, workspaceResult] = await Promise.all([
      booking.department_id
        ? supabase
            .from('departments')
            .select('id, name')
            .eq('id', booking.department_id)
            .single()
        : Promise.resolve({ data: null }),

      booking.service_provider_id
        ? supabase.auth.admin
            .getUserById(booking.service_provider_id)
            .then(({ data: { user } }) =>
              user
                ? {
                    data: {
                      id: user.id,
                      email: user.email ?? '',
                      raw_user_meta_data: {
                        full_name: user.user_metadata?.full_name,
                        name: user.user_metadata?.name,
                        phone:
                          typeof user.user_metadata?.phone === 'string' &&
                          user.user_metadata.phone.trim() !== ''
                            ? user.user_metadata.phone.trim()
                            : undefined,
                      },
                    },
                  }
                : { data: null }
            )
            .catch(() => ({ data: null }))
        : Promise.resolve({ data: null }),

      supabase
        .from('services')
        .select('id, name')
        .eq('workspace_id', workspaceId),

      supabase
        .from('configurations')
        .select('settings')
        .eq('workspace_id', workspaceId)
        .single(),

      supabase
        .from('workspaces')
        .select('slug, user_id, name, logo_url')
        .eq('id', workspaceId)
        .single(),
    ]);

    const department = deptResult.data
      ? { id: String(deptResult.data.id), name: deptResult.data.name }
      : null;

    const serviceProvider = providerResult.data
      ? {
          id: providerResult.data.id,
          email: providerResult.data.email,
          raw_user_meta_data: providerResult.data.raw_user_meta_data,
        }
      : null;

    const ownerUserId = workspaceResult.data?.user_id as string | null | undefined;
    let workspaceOwner: {
      id: string;
      email: string;
      raw_user_meta_data: { full_name?: string; name?: string; phone?: string };
    } | null = null;
    if (ownerUserId) {
      try {
        const { data: ownerData } = await supabase.auth.admin.getUserById(ownerUserId);
        const user = ownerData?.user;
        if (user) {
          workspaceOwner = {
            id: user.id,
            email: user.email ?? '',
            raw_user_meta_data: {
              full_name: user.user_metadata?.full_name,
              name: user.user_metadata?.name,
              phone:
                typeof user.user_metadata?.phone === 'string' &&
                user.user_metadata.phone.trim() !== ''
                  ? user.user_metadata.phone.trim()
                  : undefined,
            },
          };
        }
      } catch {
        workspaceOwner = null;
      }
    }

    const bookingRecordId = booking.id;
    const { id: _id, workspace_id: _wid, host_user_id: _huid, ...safeBooking } = booking;

    return NextResponse.json({
      booking: safeBooking,
      booking_id: String(bookingRecordId),
      department,
      serviceProvider,
      workspaceOwner,
      services: servicesResult.data ?? [],
      intakeFormSettings: (() => {
        const settings = (configResult.data?.settings ?? {}) as Record<string, unknown>;
        const intake = settings.intake_form;
        return intake && typeof intake === 'object' ? intake : null;
      })(),
      workspace_slug: workspaceResult.data?.slug ?? null,
      workspace_name:
        workspaceResult.data && typeof workspaceResult.data.name === 'string'
          ? workspaceResult.data.name.trim() || null
          : null,
      workspace_logo_url: (() => {
        const ws = workspaceResult.data as { logo_url?: string | null } | null;
        const u = ws?.logo_url;
        return typeof u === 'string' && u.trim() !== '' ? u.trim() : null;
      })(),
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error fetching public booking:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
