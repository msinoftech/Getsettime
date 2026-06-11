import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { appendActivityLog } from '@/lib/activity-log';
import { formatDualTimeBlock, whatsapp_timezone_payload } from '@/lib/booking-timezone-api';
import {
  admin_whatsapp_phones_for_booking,
  resolve_provider_notification_contact,
  sole_workspace_department_display_name,
} from '@/lib/booking_service_provider_phone';
import { post_booking_whatsapp_notification } from '@/lib/post_booking_whatsapp_notification';
import {
  is_whatsapp_admin_enabled,
  is_whatsapp_user_enabled,
} from '@/lib/workspace-notification-flags';
import {
  booking_wants_google_meet,
  calendar_event_location_string,
  merge_meet_into_booking_location,
} from '@/src/utils/google_meet';

export type post_booking_row = {
  id: string;
  public_code?: string;
  invitee_name?: string;
  invitee_email?: string | null;
  service_provider_id?: string | null;
  department_id?: string | null;
  event_type_id?: string | null;
  start_at?: string;
  end_at?: string | null;
  status?: string;
  metadata?: unknown;
  customer_timezone?: string | null;
  provider_timezone?: string | null;
};

export type post_booking_processing_params = {
  origin: string;
  booking: post_booking_row;
  workspace_id: string | number;
  event_type_id: string | null;
  service_provider_id: string | null;
  department_id: string | null;
  invitee_name: string;
  invitee_email: string | null;
  invitee_phone_e164: string | null;
  start_at: string;
  resolved_end_at: string;
  duration_minutes: number;
  booking_location: Record<string, unknown> | null;
  calendar_location: unknown;
  metadata: Record<string, unknown> | null;
  notes?: string;
  whatsapp_opt_in: boolean;
  tz_fields: {
    customer_timezone: string | null;
    provider_timezone: string | null;
  };
  resolved_notifications: Record<string, unknown>;
  activity_log?: {
    actor_user_id: string;
    status: string;
  };
  /** Fallback when service role is unavailable (e.g. dashboard JWT client). */
  supabase_client?: SupabaseClient;
};

function create_service_role_client(): SupabaseClient | null {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function run_post_booking_processing(
  params: post_booking_processing_params
): Promise<void> {
  const {
    origin,
    workspace_id: workspaceId,
    event_type_id,
    service_provider_id,
    department_id,
    invitee_name,
    invitee_email,
    invitee_phone_e164,
    start_at,
    resolved_end_at: resolvedEndAt,
    duration_minutes: durationMinutes,
    booking_location: normalizedBookingLocation,
    calendar_location: calendarLocation,
    metadata,
    notes,
    whatsapp_opt_in,
    tz_fields: tzFields,
    resolved_notifications: resolvedNotifications,
    activity_log,
    supabase_client,
  } = params;

  let data: post_booking_row = { ...params.booking };

  const notifyAdminClient = create_service_role_client();
  const supabase = notifyAdminClient ?? supabase_client;
  if (!supabase) {
    console.warn('No Supabase client available; skipping post-booking processing');
    return;
  }

  const notifyDb = notifyAdminClient ?? supabase;

  let providerEmail: string | undefined;
  let providerName: string | undefined;
  let departmentName: string | undefined;
  let eventTypeName = 'Appointment';
  let arriveEarlyMin = 10;
  let arriveEarlyMax = 15;

  try {
    if (event_type_id) {
      const { data: eventTypeData } = await notifyDb
        .from('event_types')
        .select('title, duration_minutes, buffer_before, buffer_after')
        .eq('id', event_type_id)
        .eq('workspace_id', workspaceId)
        .single();

      if (eventTypeData) {
        eventTypeName = eventTypeData.title || eventTypeName;
        arriveEarlyMin = Number(eventTypeData.buffer_before ?? arriveEarlyMin);
        arriveEarlyMax = Number(eventTypeData.buffer_after ?? arriveEarlyMax);
      }
    }
  } catch (eventTypeErr) {
    console.error('Error fetching event type details:', eventTypeErr);
  }

  try {
    if (department_id) {
      const { data: departmentData } = await notifyDb
        .from('departments')
        .select('name')
        .eq('id', department_id)
        .eq('workspace_id', workspaceId)
        .single();
      departmentName = departmentData?.name || undefined;
    }
  } catch (deptErr) {
    console.error('Error fetching department details:', deptErr);
  }

  if (!departmentName?.trim()) {
    try {
      const sole = await sole_workspace_department_display_name(notifyDb, workspaceId);
      if (sole) departmentName = sole;
    } catch (soleDeptErr) {
      console.error('Error resolving sole department name:', soleDeptErr);
    }
  }

  try {
    if (!notifyAdminClient) {
      console.warn('Service role key not configured, cannot fetch provider details for notifications');
    } else {
      const resolved = await resolve_provider_notification_contact(
        supabase,
        notifyAdminClient,
        String(workspaceId),
        service_provider_id || null
      );
      providerEmail = resolved.email;
      providerName = resolved.provider_name;
    }
  } catch (providerErr) {
    console.error('Error resolving provider details:', providerErr);
  }

  let meetingUrlAfterCalendar: string | undefined;
  let meet_link_dedicated_sent = false;

  try {
    const wantsMeet = booking_wants_google_meet(normalizedBookingLocation);
    const { createCalendarEvent } = await import('@/lib/google-calendar-service');
    const tzCal = tzFields.provider_timezone?.trim() || tzFields.customer_timezone?.trim();
    const dualTime = formatDualTimeBlock(
      start_at,
      tzFields.customer_timezone,
      tzFields.provider_timezone
    );
    const calDescription = [dualTime, notes ? String(notes) : ''].filter(Boolean).join('\n\n');
    const { eventId, meetLink, error: calInsertErr } = await createCalendarEvent({
      workspaceId: Number(workspaceId),
      serviceProviderId: service_provider_id || undefined,
      summary: `${eventTypeName}: ${invitee_name.trim()}`,
      description: calDescription || undefined,
      startAt: start_at,
      endAt: resolvedEndAt,
      location: calendar_event_location_string(calendarLocation),
      attendeeEmail: invitee_email?.trim() || undefined,
      metadata: { bookingId: data?.id, eventTypeName },
      addGoogleMeet: wantsMeet,
      meetRequestId: data?.id,
      ...(tzCal ? { timeZone: tzCal } : {}),
    });

    const patchBooking: Record<string, unknown> = {};
    const nextMeta =
      data?.metadata && typeof data.metadata === 'object'
        ? { ...(data.metadata as Record<string, unknown>) }
        : metadata && typeof metadata === 'object'
          ? { ...metadata }
          : {};

    if (eventId) {
      nextMeta.google_calendar_event_id = eventId;
      patchBooking.metadata = nextMeta;
    } else if (calInsertErr) {
      console.warn('Google Calendar create returned no event:', calInsertErr);
    }

    if (meetLink?.trim() && wantsMeet && data?.id) {
      patchBooking.location = merge_meet_into_booking_location(
        normalizedBookingLocation,
        meetLink.trim()
      );
    }

    if (Object.keys(patchBooking).length > 0 && data?.id) {
      const previousLocation = normalizedBookingLocation;
      const { error: patchErr } = await supabase
        .from('bookings')
        .update(patchBooking)
        .eq('id', data.id);
      if (patchErr) {
        console.warn('Booking patch after calendar sync failed:', patchErr);
      } else {
        data = {
          ...data,
          ...(patchBooking.metadata ? { metadata: patchBooking.metadata } : {}),
          ...(patchBooking.location ? { location: patchBooking.location } : {}),
        };
        const locAfter = patchBooking.location as Record<string, unknown> | undefined;
        const mw = typeof locAfter?.meeting_url === 'string' ? locAfter.meeting_url.trim() : '';
        meetingUrlAfterCalendar =
          mw || (meetLink?.trim() && wantsMeet ? meetLink.trim() : undefined);

        if (meetingUrlAfterCalendar && locAfter) {
          try {
            const { notify_meet_link_if_first_stored } = await import(
              '@/lib/meet-link-notification'
            );
            const meetNotify = await notify_meet_link_if_first_stored({
              supabase,
              adminClient: notifyAdminClient,
              booking: {
                id: String(data.id),
                workspace_id: workspaceId,
                invitee_name: data.invitee_name,
                invitee_email: data.invitee_email,
                service_provider_id: data.service_provider_id,
                department_id: data.department_id,
                event_type_id: data.event_type_id,
                start_at: data.start_at ?? start_at,
                end_at: data.end_at ?? resolvedEndAt,
                metadata: (data.metadata as Record<string, unknown> | null) ?? null,
                customer_timezone: data.customer_timezone,
                provider_timezone: data.provider_timezone,
              },
              previousLocation,
              newLocation: locAfter,
              meetingUrl: meetingUrlAfterCalendar,
              alsoSendGoogleCalendarInvites: false,
            });
            meet_link_dedicated_sent = meetNotify.notified;
            if (meetNotify.errors.length > 0) {
              console.warn('GetSetTime Meet notification:', meetNotify.errors);
            }
          } catch (meetNotifyErr) {
            console.warn('GetSetTime Meet notification failed (non-blocking):', meetNotifyErr);
          }
        }
      }
    }
  } catch (calErr) {
    console.warn('Google Calendar sync failed (non-blocking):', calErr);
  }

  try {
    if (invitee_email && invitee_email.trim()) {
      const { sendBookingConfirmationEmails } = await import('@/lib/email-service');

      const emailData = {
        inviteeName: invitee_name.trim(),
        inviteeEmail: invitee_email.trim(),
        ...(providerName?.trim() ? { providerName: providerName.trim() } : {}),
        providerEmail: providerEmail,
        eventTypeName,
        ...(departmentName?.trim() ? { departmentName: departmentName.trim() } : {}),
        startTime: start_at,
        endTime: resolvedEndAt,
        duration: durationMinutes,
        notes: notes || undefined,
        customerTimezone: tzFields.customer_timezone ?? undefined,
        providerTimezone: tzFields.provider_timezone ?? undefined,
        timezone: tzFields.customer_timezone ?? undefined,
        dualTimeBlock: formatDualTimeBlock(
          start_at,
          tzFields.customer_timezone,
          tzFields.provider_timezone
        ),
        ...(meetingUrlAfterCalendar?.trim() && !meet_link_dedicated_sent
          ? {
              meetingUrl: meetingUrlAfterCalendar.trim(),
              meetingLabel: 'Google Meet',
            }
          : {}),
      };

      const emailResult = await sendBookingConfirmationEmails(emailData);
      console.log('Email notifications:', {
        userEmailSent: emailResult.userEmailSent,
        providerEmailSent: emailResult.providerEmailSent,
        errors: emailResult.errors,
      });
    }
  } catch (emailError) {
    console.error('Error sending email notifications:', emailError);
  }

  const whatsapp_admin = is_whatsapp_admin_enabled(resolvedNotifications);
  const whatsapp_user = is_whatsapp_user_enabled(resolvedNotifications);

  let admin_whatsapp_phones: string[] = [];
  if (whatsapp_admin && data?.id && workspaceId && notifyAdminClient) {
    try {
      admin_whatsapp_phones = await admin_whatsapp_phones_for_booking(supabase, data.id, {
        workspace_id: String(workspaceId),
        admin_supabase: notifyAdminClient,
      });
    } catch (resolveAdminPhoneErr) {
      console.warn(
        'Could not resolve host phone for WhatsApp admin notification:',
        resolveAdminPhoneErr
      );
    }
  }

  try {
    const wants_whatsapp_admin = whatsapp_admin && admin_whatsapp_phones.length > 0;
    const wants_whatsapp_user = whatsapp_user && whatsapp_opt_in;
    if (invitee_phone_e164 && (wants_whatsapp_admin || wants_whatsapp_user)) {
      const whenOpts: Intl.DateTimeFormatOptions = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short',
        ...(tzFields.customer_timezone?.trim() && {
          timeZone: tzFields.customer_timezone.trim(),
        }),
      };
      const when = new Date(start_at).toLocaleString('en-US', whenOpts);

      const whatsappParts = [
        'Booking confirmed',
        `Event: ${eventTypeName}`,
        ...(departmentName?.trim() ? [`Department: ${departmentName.trim()}`] : []),
        ...(providerName?.trim() ? [`Service Provider: ${providerName.trim()}`] : []),
        `When: ${when}`,
        ...(notes ? [`Notes: ${String(notes)}`] : []),
        ...(meetingUrlAfterCalendar?.trim()
          ? [`Meet: ${meetingUrlAfterCalendar.trim()}`]
          : []),
      ];
      const message = whatsappParts.join(' ');

      await post_booking_whatsapp_notification(origin, {
        name: invitee_name?.trim() || 'Invitee',
        email: invitee_email?.trim() || null,
        phone: invitee_phone_e164,
        message,
        service: eventTypeName,
        ...(departmentName?.trim() ? { department: departmentName.trim() } : {}),
        ...(providerName?.trim() ? { provider: providerName.trim() } : {}),
        start: start_at,
        end: resolvedEndAt,
        note: notes ? String(notes) : '',
        arrive_early_min: arriveEarlyMin,
        arrive_early_max: arriveEarlyMax,
        booking_reference: data?.public_code || data?.id || '',
        send_to_user: whatsapp_user && whatsapp_opt_in,
        send_to_admin: whatsapp_admin,
        admin_phone: admin_whatsapp_phones,
        skip_contact_form_email: true,
        ...whatsapp_timezone_payload(
          tzFields.customer_timezone,
          tzFields.provider_timezone
        ),
      });
    }
  } catch (whatsappError) {
    console.error('Error sending WhatsApp notification:', whatsappError);
  }

  if (activity_log) {
    try {
      await appendActivityLog(workspaceId, {
        type: 'booking',
        action: 'created',
        entity_id: data?.id,
        actor_user_id: activity_log.actor_user_id,
        title: 'Booking created',
        description: `${data?.invitee_name || invitee_name.trim()} (${data?.status || activity_log.status || 'pending'})`,
        after_data: {
          invitee_name: data?.invitee_name || invitee_name.trim(),
          status: data?.status || activity_log.status || 'pending',
          start_at: data?.start_at,
          end_at: data?.end_at,
        },
      });
    } catch (activityErr) {
      console.error('Error appending booking activity log:', activityErr);
    }
  }
}
