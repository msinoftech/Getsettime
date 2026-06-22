import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  createCalendarEvent,
  fetchGoogleMeetLinkForCalendarEvent,
} from '@/lib/google-calendar-service';
import {
  booking_wants_google_meet,
  merge_meet_into_booking_location,
  resolve_meeting_join_url_from_booking,
} from '@/src/utils/google_meet';

/**
 * POST: pull Google Meet join URL from an existing calendar event, or create the
 * calendar event when the booking has none (e.g. host connected Calendar after booking).
 */
export async function POST(
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

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const { data: booking, error: fetchErr } = await supabase
      .from('bookings')
      .select('*, event_types(title, duration_minutes, location_type), contacts(name, phone, email)')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (fetchErr || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const st = String(booking.status ?? '').toLowerCase();
    if (st === 'deleted' || st === 'cancelled') {
      return NextResponse.json(
        { error: 'Cannot sync Google Meet for this booking status' },
        { status: 400 }
      );
    }

    if (!booking_wants_google_meet(booking.location)) {
      return NextResponse.json(
        { error: 'This booking does not use Google Meet' },
        { status: 400 }
      );
    }

    if (resolve_meeting_join_url_from_booking(booking.location, booking.metadata)?.trim()) {
      return NextResponse.json({ data: booking, synced: false });
    }

    const meta =
      booking.metadata && typeof booking.metadata === 'object'
        ? ({ ...(booking.metadata as Record<string, unknown>) })
        : {};
    const gcalId =
      typeof meta.google_calendar_event_id === 'string'
        ? meta.google_calendar_event_id.trim()
        : '';

    const workspaceNum = Number(workspaceId);
    const spId = booking.service_provider_id || null;

    let meetLink: string | undefined;
    let nextMeta = meta;
    let created_new_calendar_event = false;

    if (gcalId) {
      meetLink = await fetchGoogleMeetLinkForCalendarEvent({
        workspaceId: workspaceNum,
        serviceProviderId: spId,
        eventId: gcalId,
      });
      if (!meetLink?.trim()) {
        return NextResponse.json(
          {
            error:
              'Could not read a Meet link from Google Calendar. Check that Calendar is connected and the event exists.',
          },
          { status: 422 }
        );
      }
    } else {
      const eventTypeName =
        typeof booking.event_types?.title === 'string' && booking.event_types.title.trim()
          ? booking.event_types.title.trim()
          : 'Appointment';
      const tzRaw =
        (typeof meta.client_timezone === 'string' && meta.client_timezone.trim()) ||
        (typeof meta.timezone === 'string' && meta.timezone.trim()) ||
        undefined;
      const { eventId, meetLink: createdMeet, error: calInsertErr } = await createCalendarEvent({
        workspaceId: workspaceNum,
        serviceProviderId: spId ?? undefined,
        summary: `${eventTypeName}: ${String(booking.invitee_name ?? '').trim()}`,
        description: meta.notes ? String(meta.notes) : undefined,
        startAt: booking.start_at,
        endAt: booking.end_at || booking.start_at,
        attendeeEmail:
          typeof booking.invitee_email === 'string' && booking.invitee_email.trim()
            ? booking.invitee_email.trim()
            : undefined,
        metadata: { bookingId: booking.id, eventTypeName },
        addGoogleMeet: true,
        meetRequestId: booking.id,
        sendUpdates: 'all',
        ...(tzRaw ? { timeZone: tzRaw } : {}),
      });

      if (!eventId) {
        return NextResponse.json(
          {
            error:
              calInsertErr ||
              'Google Calendar is not connected for this host, or event creation failed.',
          },
          { status: 422 }
        );
      }

      nextMeta = { ...nextMeta, google_calendar_event_id: eventId };
      meetLink = createdMeet;
      created_new_calendar_event = true;
    }

    if (!meetLink?.trim()) {
      return NextResponse.json(
        { error: 'Meet link is not available yet. Try again in a few seconds.' },
        { status: 422 }
      );
    }

    const nextLoc = merge_meet_into_booking_location(
      booking.location as Record<string, unknown> | null,
      meetLink.trim()
    );

    const { data: updated, error: upErr } = await supabase
      .from('bookings')
      .update({
        location: nextLoc,
        metadata: nextMeta,
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select('*, event_types(title, duration_minutes, location_type), contacts(name, phone, email)')
      .single();

    if (upErr || !updated) {
      console.error('google-meet sync patch failed:', upErr);
      return NextResponse.json({ error: upErr?.message || 'Update failed' }, { status: 500 });
    }

    try {
      const { notify_meet_link_if_first_stored } = await import(
        '@/lib/meet-link-notification'
      );
      const meetNotify = await notify_meet_link_if_first_stored({
        supabase,
        booking: {
          id: String(updated.id),
          workspace_id: workspaceId,
          invitee_name: updated.invitee_name,
          invitee_email: updated.invitee_email,
          service_provider_id: updated.service_provider_id,
          service_provider_name: updated.service_provider_name,
          department_id: updated.department_id,
          event_type_id: updated.event_type_id,
          start_at: updated.start_at,
          end_at: updated.end_at,
          metadata: (updated.metadata as Record<string, unknown> | null) ?? null,
          customer_timezone: updated.customer_timezone,
          provider_timezone: updated.provider_timezone,
          event_types: updated.event_types,
        },
        previousLocation: booking.location,
        newLocation: nextLoc,
        meetingUrl: meetLink.trim(),
        alsoSendGoogleCalendarInvites: !created_new_calendar_event,
      });
      if (meetNotify.errors.length > 0) {
        console.warn('GetSetTime Meet notification:', meetNotify.errors);
      }
    } catch (meetNotifyErr) {
      console.warn('GetSetTime Meet notification failed (non-blocking):', meetNotifyErr);
    }

    return NextResponse.json({ data: updated, synced: true });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('google-meet POST:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
