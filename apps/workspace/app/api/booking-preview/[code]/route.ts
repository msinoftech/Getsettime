import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';
import { fetchGoogleMeetLinkForCalendarEvent } from '@/lib/google-calendar-service';
import {
  booking_wants_google_meet,
  merge_meet_into_booking_location,
  resolve_meeting_join_url_from_booking,
} from '@/src/utils/google_meet';
import { resolve_workspace_contact_from_general } from '@/src/utils/workspace_contact';
import { resolve_customer_booking_rules } from '@/lib/customer-booking-rules';

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
          const previousLocation = booking.location;
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
            try {
              const { notify_meet_link_if_first_stored } = await import(
                '@/lib/meet-link-notification'
              );
              const meetNotify = await notify_meet_link_if_first_stored({
                supabase,
                booking: {
                  id: String(booking.id),
                  workspace_id: workspaceId,
                  invitee_name: booking.invitee_name,
                  invitee_email: booking.invitee_email,
                  service_provider_id: booking.service_provider_id,
                  service_provider_name: booking.service_provider_name,
                  department_id: booking.department_id,
                  event_type_id: booking.event_type_id,
                  start_at: booking.start_at,
                  end_at: booking.end_at,
                  metadata: (booking.metadata as Record<string, unknown> | null) ?? null,
                  customer_timezone: booking.customer_timezone,
                  provider_timezone: booking.provider_timezone,
                  event_types: booking.event_types,
                },
                previousLocation,
                newLocation: nextLoc,
                meetingUrl: meetLink.trim(),
                alsoSendGoogleCalendarInvites: true,
              });
              if (meetNotify.errors.length > 0) {
                console.warn('GetSetTime Meet notification:', meetNotify.errors);
              }
            } catch (meetNotifyErr) {
              console.warn('GetSetTime Meet notification failed (non-blocking):', meetNotifyErr);
            }
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

    const settings = (configResult.data?.settings ?? {}) as Record<string, unknown>;
    const general =
      settings.general && typeof settings.general === 'object'
        ? (settings.general as Record<string, unknown>)
        : {};
    const workspace_contact = resolve_workspace_contact_from_general(general);
    const customer_booking_rules = resolve_customer_booking_rules(general);

    return NextResponse.json({
      booking: safeBooking,
      booking_id: String(bookingRecordId),
      department,
      serviceProvider,
      workspaceOwner,
      services: servicesResult.data ?? [],
      intakeFormSettings: (() => {
        const intake = settings.intake_form;
        return intake && typeof intake === 'object' ? intake : null;
      })(),
      workspace_contact: {
        email: workspace_contact.business_email,
        phone: workspace_contact.business_phone,
        address: workspace_contact.formatted_address,
      },
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
      allow_customer_reschedule: customer_booking_rules.allow_customer_reschedule,
      allow_customer_cancellation: customer_booking_rules.allow_customer_cancellation,
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
