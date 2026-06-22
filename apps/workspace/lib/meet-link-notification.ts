import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { emailTimezoneFields } from '@/lib/booking-timezone-api';
import {
  notification_provider_name,
  resolve_provider_notification_contact,
  sole_workspace_department_display_name,
} from '@/lib/booking_service_provider_phone';
import { sendMeetLinkEmails } from '@/lib/email-service';
import { resolve_meeting_join_url_from_booking } from '@/src/utils/google_meet';

export const MEET_LINK_NOTIFICATION_SENT_KEY = 'meet_link_notification_sent_at';

export type meet_link_notification_booking = {
  id: string;
  workspace_id: string | number;
  invitee_name?: string | null;
  invitee_email?: string | null;
  service_provider_id?: string | null;
  service_provider_name?: string | null;
  department_id?: string | null;
  event_type_id?: string | null;
  start_at: string;
  end_at?: string | null;
  metadata?: Record<string, unknown> | null;
  customer_timezone?: string | null;
  provider_timezone?: string | null;
  event_types?:
    | { title?: string; duration_minutes?: number }
    | { title?: string; duration_minutes?: number }[]
    | null;
};

function read_meeting_url_from_location(location: unknown): string | null {
  if (!location || typeof location !== 'object') return null;
  const raw = (location as Record<string, unknown>).meeting_url;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

export function should_send_meet_link_notification(
  previousLocation: unknown,
  newLocation: unknown,
  metadata: Record<string, unknown> | null | undefined
): boolean {
  const prevUrl = read_meeting_url_from_location(previousLocation);
  const nextUrl = read_meeting_url_from_location(newLocation);
  if (!nextUrl || prevUrl === nextUrl) return false;
  if (metadata && typeof metadata[MEET_LINK_NOTIFICATION_SENT_KEY] === 'string') {
    const sent = metadata[MEET_LINK_NOTIFICATION_SENT_KEY].trim();
    if (sent) return false;
  }
  return true;
}

function create_service_role_client(): SupabaseClient | null {
  const supabaseUrl = (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    ''
  ).trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function event_type_from_booking(
  booking: meet_link_notification_booking
): { title?: string; duration_minutes?: number } | null {
  const et = booking.event_types;
  if (!et) return null;
  if (Array.isArray(et)) return et[0] ?? null;
  return et;
}

async function build_meet_link_email_data(
  supabase: SupabaseClient,
  adminClient: SupabaseClient | null,
  booking: meet_link_notification_booking,
  meetingUrl: string
) {
  const workspaceId = String(booking.workspace_id);
  const et = event_type_from_booking(booking);
  let eventTypeName =
    typeof et?.title === 'string' && et.title.trim() ? et.title.trim() : 'Appointment';
  let durationMinutes =
    typeof et?.duration_minutes === 'number' && et.duration_minutes > 0
      ? et.duration_minutes
      : 30;

  if (booking.event_type_id) {
    const db = adminClient ?? supabase;
    const { data: etRow } = await db
      .from('event_types')
      .select('title, duration_minutes')
      .eq('id', booking.event_type_id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (etRow?.title) eventTypeName = etRow.title;
    if (typeof etRow?.duration_minutes === 'number' && etRow.duration_minutes > 0) {
      durationMinutes = etRow.duration_minutes;
    }
  }

  let departmentName: string | undefined;
  if (booking.department_id) {
    const db = adminClient ?? supabase;
    const { data: dept } = await db
      .from('departments')
      .select('name')
      .eq('id', booking.department_id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    departmentName = dept?.name?.trim() || undefined;
  }
  if (!departmentName?.trim() && adminClient) {
    try {
      const sole = await sole_workspace_department_display_name(adminClient, workspaceId);
      if (sole) departmentName = sole;
    } catch {
      /* non-critical */
    }
  }

  let providerEmail: string | undefined;
  let providerName: string | undefined = notification_provider_name(booking);
  if (adminClient) {
    try {
      const resolved = await resolve_provider_notification_contact(
        supabase,
        adminClient,
        workspaceId,
        booking.service_provider_id || null
      );
      providerEmail = resolved.email;
      providerName = notification_provider_name(booking, resolved);
    } catch (err) {
      console.warn('meet-link-notification: provider contact resolution failed:', err);
    }
  }

  const endAt = booking.end_at?.trim() || booking.start_at;
  const tzEmail = emailTimezoneFields(
    booking.customer_timezone,
    booking.provider_timezone,
    booking.start_at
  );

  return {
    inviteeName: booking.invitee_name?.trim() || 'Guest',
    inviteeEmail: booking.invitee_email?.trim() || undefined,
    providerName,
    providerEmail,
    eventTypeName,
    ...(departmentName ? { departmentName } : {}),
    startTime: booking.start_at,
    endTime: endAt,
    duration: durationMinutes,
    meetingUrl: meetingUrl.trim(),
    meetingLabel: 'GetSetTime Meet',
    ...tzEmail,
  };
}

export type meet_link_notification_result = {
  notified: boolean;
  errors: string[];
};

/**
 * Sends dedicated GetSetTime Meet emails when `meeting_url` is first stored on the booking.
 * Marks metadata so the notification is not sent again.
 */
export async function notify_meet_link_if_first_stored(options: {
  supabase: SupabaseClient;
  adminClient?: SupabaseClient | null;
  booking: meet_link_notification_booking;
  previousLocation: unknown;
  newLocation: unknown;
  meetingUrl?: string;
  /**
   * When true, also triggers Google Calendar attendee invites (sendUpdates: 'all')
   * for deferred Meet links sent after booking success. Leave false when the link
   * is stored in the same request as booking creation.
   */
  alsoSendGoogleCalendarInvites?: boolean;
}): Promise<meet_link_notification_result> {
  const {
    supabase,
    booking,
    previousLocation,
    newLocation,
  } = options;
  const adminClient = options.adminClient ?? create_service_role_client();
  const metadata =
    booking.metadata && typeof booking.metadata === 'object'
      ? booking.metadata
      : null;

  const meetingUrl =
    options.meetingUrl?.trim() ||
    read_meeting_url_from_location(newLocation) ||
    resolve_meeting_join_url_from_booking(newLocation, metadata);

  if (!meetingUrl) {
    return { notified: false, errors: [] };
  }

  if (!should_send_meet_link_notification(previousLocation, newLocation, metadata)) {
    return { notified: false, errors: [] };
  }

  const errors: string[] = [];

  try {
    const emailData = await build_meet_link_email_data(
      supabase,
      adminClient,
      booking,
      meetingUrl
    );
    const emailResult = await sendMeetLinkEmails(emailData);
    errors.push(...emailResult.errors);
    if (!emailResult.userEmailSent && !emailResult.providerEmailSent) {
      return { notified: false, errors };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('meet-link-notification email error:', err);
    return { notified: false, errors: [msg] };
  }

  const patchClient = adminClient ?? supabase;
  const nextMeta = {
    ...(metadata ?? {}),
    [MEET_LINK_NOTIFICATION_SENT_KEY]: new Date().toISOString(),
  };
  const { error: patchErr } = await patchClient
    .from('bookings')
    .update({ metadata: nextMeta })
    .eq('id', booking.id)
    .eq('workspace_id', booking.workspace_id);

  if (patchErr) {
    console.warn('meet-link-notification metadata patch failed:', patchErr);
    errors.push(`Failed to mark meet notification sent: ${patchErr.message}`);
  }

  if (options.alsoSendGoogleCalendarInvites) {
    const metaForGcal = nextMeta as Record<string, unknown>;
    const gcalRaw =
      metaForGcal.google_calendar_event_id ?? metadata?.google_calendar_event_id;
    const gcalId = typeof gcalRaw === 'string' ? gcalRaw.trim() : '';
    if (gcalId) {
      try {
        const { sendGoogleCalendarMeetInvites } = await import(
          '@/lib/google-calendar-service'
        );
        const inviteResult = await sendGoogleCalendarMeetInvites({
          workspaceId: Number(booking.workspace_id),
          serviceProviderId: booking.service_provider_id ?? null,
          eventId: gcalId,
          attendeeEmail: booking.invitee_email,
        });
        if (!inviteResult.success && inviteResult.error) {
          console.warn('Google Calendar meet invites:', inviteResult.error);
          errors.push(`Google Calendar invites: ${inviteResult.error}`);
        }
      } catch (inviteErr) {
        const msg = inviteErr instanceof Error ? inviteErr.message : String(inviteErr);
        console.warn('Google Calendar meet invites failed:', inviteErr);
        errors.push(`Google Calendar invites: ${msg}`);
      }
    }
  }

  console.log('GetSetTime Meet link notification sent for booking:', booking.id);
  return { notified: true, errors };
}
