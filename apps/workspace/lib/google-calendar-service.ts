import { google } from 'googleapis';
import type { calendar_v3 } from 'googleapis';
import type { GaxiosResponse } from 'gaxios';
import {
  getIntegration,
  getLinkedAuthUserIdFromConfig,
  saveIntegration,
} from '@/lib/integrations';
import { getGoogleOAuthClient } from '@/lib/googleClient';

export interface CreateCalendarEventParams {
  workspaceId: number;
  /** When set, prefers that service provider's integration, then workspace-level. */
  serviceProviderId?: string | null;
  summary: string;
  description?: string;
  startAt: string;
  endAt: string;
  location?: string;
  attendeeEmail?: string;
  metadata?: { bookingId?: string; eventTypeName?: string };
  /** When true, creates a Google Meet link on the event (Calendar API conferenceData). */
  addGoogleMeet?: boolean;
  /** Stable id for Meet createRequest (e.g. booking id); required when addGoogleMeet is true. */
  meetRequestId?: string | number | null;
  /** IANA timezone for event start/end when using dateTime. */
  timeZone?: string;
  /**
   * Google Calendar attendee notifications on insert.
   * Default `none`; use `all` when creating an event after booking (deferred Meet).
   */
  sendUpdates?: 'none' | 'all' | 'externalOnly';
}

export interface BusySlot {
  start_at: string;
  end_at: string;
}

type CalendarClientOptions = {
  workspaceId: number;
  serviceProviderId?: string | null;
};

/**
 * Get authorized Calendar API client for workspace or a specific service provider.
 */
async function getCalendarClient(options: CalendarClientOptions) {
  const { workspaceId, serviceProviderId } = options;
  const linkedAuthUserId =
    typeof serviceProviderId === 'string' && serviceProviderId.trim()
      ? serviceProviderId.trim()
      : null;

  const integration = await getIntegration(workspaceId, 'google_calendar', {
    linkedAuthUserId: linkedAuthUserId ?? null,
  });
  if (!integration?.access_token) return null;

  const resolvedLinkedAuthUserId = getLinkedAuthUserIdFromConfig(
    integration.config as Record<string, unknown>
  );

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || '';
  const redirectUri = `${baseUrl.replace(/\/$/, '')}/api/integrations/google/callback`;
  const oauth2Client = getGoogleOAuthClient(redirectUri);

  const creds = integration.credentials;
  oauth2Client.setCredentials({
    access_token: integration.access_token,
    refresh_token: creds.refresh_token,
    expiry_date: creds.expires_at ? creds.expires_at * 1000 : undefined,
  });

  const configSnapshot = (integration.config as Record<string, unknown>) ?? {};
  const googleAccountId = integration.provider_user_id ?? undefined;

  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await saveIntegration({
        workspace_id: workspaceId,
        type: 'google_calendar',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? undefined,
        expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : undefined,
        metadata: configSnapshot,
        provider_user_id: googleAccountId,
        linked_auth_user_id: resolvedLinkedAuthUserId ?? null,
      });
    }
  });

  return google.calendar({ version: 'v3', auth: oauth2Client });
}

function extract_meet_link_from_calendar_event(data: {
  hangoutLink?: string | null;
  conferenceData?: {
    entryPoints?: { entryPointType?: string | null; uri?: string | null }[] | null;
  } | null;
}): string | undefined {
  const hangout = data.hangoutLink?.trim();
  if (hangout) return hangout;
  const entries = data.conferenceData?.entryPoints;
  if (!entries?.length) return undefined;
  const video = entries.find((e) => e.entryPointType === 'video');
  const uri = video?.uri?.trim();
  return uri || undefined;
}

type GoogleCalendarApi = NonNullable<Awaited<ReturnType<typeof getCalendarClient>>>;

/**
 * `events.insert` sometimes omits hangoutLink/conferenceData until the event is re-fetched.
 * Poll with `conferenceDataVersion: 1` so we can persist `meeting_url` reliably.
 */
async function poll_google_meet_link_after_insert(
  calendar: GoogleCalendarApi,
  eventId: string
): Promise<string | undefined> {
  for (let attempt = 0; attempt < 5; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 650));
    }
    try {
      const getRes = await (
        calendar.events.get as unknown as (args: {
          calendarId: string;
          eventId: string;
          conferenceDataVersion?: number;
        }) => Promise<GaxiosResponse<calendar_v3.Schema$Event>>
      )({
        calendarId: 'primary',
        eventId,
        conferenceDataVersion: 1,
      });
      const data = getRes.data;
      const link = extract_meet_link_from_calendar_event(data);
      if (link) return link;
    } catch (err) {
      console.warn('poll_google_meet_link_after_insert get failed:', err);
    }
  }
  return undefined;
}

/**
 * Load Meet join URL for an existing calendar event (retries for delayed conference data).
 */
export async function fetchGoogleMeetLinkForCalendarEvent(params: {
  workspaceId: number;
  serviceProviderId?: string | null;
  eventId: string;
}): Promise<string | undefined> {
  const calendar = await getCalendarClient({
    workspaceId: params.workspaceId,
    serviceProviderId: params.serviceProviderId,
  });
  if (!calendar) return undefined;
  return poll_google_meet_link_after_insert(calendar, params.eventId);
}

/**
 * Create a calendar event when a booking is created
 */
export async function createCalendarEvent(
  params: CreateCalendarEventParams
): Promise<{ eventId: string | null; meetLink?: string; error?: string }> {
  const {
    workspaceId,
    serviceProviderId,
    summary,
    description,
    startAt,
    endAt,
    location,
    attendeeEmail,
    metadata,
    addGoogleMeet,
    meetRequestId,
    timeZone,
    sendUpdates = 'none',
  } = params;

  /** DB ids may arrive as numbers; Meet requestId must be a trimmed string. */
  const meet_request_id =
    meetRequestId === undefined || meetRequestId === null
      ? ''
      : String(meetRequestId).trim();

  try {
    const calendar = await getCalendarClient({ workspaceId, serviceProviderId });
    if (!calendar) return { eventId: null };

    const dateTimeFields = (iso: string) =>
      timeZone?.trim()
        ? { dateTime: iso, timeZone: timeZone.trim() }
        : { dateTime: iso };

    const event: {
      summary: string;
      description?: string;
      start: { dateTime: string; timeZone?: string };
      end: { dateTime: string; timeZone?: string };
      location?: string;
      attendees?: { email: string }[];
      extendedProperties?: { shared: Record<string, string> };
      conferenceData?: {
        createRequest: {
          requestId: string;
          conferenceSolutionKey: { type: string };
        };
      };
    } = {
      summary,
      start: dateTimeFields(startAt),
      end: dateTimeFields(endAt),
    };
    if (description) event.description = description;
    if (location) event.location = location;
    if (attendeeEmail) event.attendees = [{ email: attendeeEmail }];
    if (metadata?.bookingId) {
      event.extendedProperties = { shared: { bookingId: metadata.bookingId } };
      if (metadata.eventTypeName) event.extendedProperties.shared.eventTypeName = metadata.eventTypeName;
    }

    if (addGoogleMeet && meet_request_id) {
      event.conferenceData = {
        createRequest: {
          requestId: meet_request_id.slice(0, 256),
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      sendUpdates,
      ...(addGoogleMeet && meet_request_id ? { conferenceDataVersion: 1 } : {}),
    });

    const eventId = res.data.id ?? null;
    let meetLink = extract_meet_link_from_calendar_event(res.data);

    if (addGoogleMeet && meet_request_id && eventId && !meetLink?.trim()) {
      meetLink = await poll_google_meet_link_after_insert(calendar, eventId);
    }

    return { eventId, meetLink };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('createCalendarEvent error:', msg);
    return { eventId: null, error: msg };
  }
}

/**
 * Notify Google Calendar attendees after a Meet link is ready (deferred post-booking flow).
 * Keeps initial booking-time inserts on sendUpdates: 'none'.
 */
export async function sendGoogleCalendarMeetInvites(params: {
  workspaceId: number;
  serviceProviderId?: string | null;
  eventId: string;
  attendeeEmail?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const eventId = params.eventId?.trim();
  if (!eventId) {
    return { success: false, error: 'Calendar event id is required' };
  }

  try {
    const calendar = await getCalendarClient({
      workspaceId: params.workspaceId,
      serviceProviderId: params.serviceProviderId,
    });
    if (!calendar) {
      return { success: false, error: 'Calendar not connected' };
    }

    const attendeeEmail = params.attendeeEmail?.trim() || null;
    let requestBody: calendar_v3.Schema$Event = {};

    if (attendeeEmail) {
      const existing = await calendar.events.get({
        calendarId: 'primary',
        eventId,
      });
      const attendees = [...(existing.data.attendees ?? [])];
      const alreadyListed = attendees.some(
        (a) => a.email?.trim().toLowerCase() === attendeeEmail.toLowerCase()
      );
      if (!alreadyListed) {
        attendees.push({ email: attendeeEmail });
      }
      requestBody = { attendees };
    }

    await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody,
      sendUpdates: 'all',
      conferenceDataVersion: 1,
    });

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('sendGoogleCalendarMeetInvites error:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Update a calendar event when a booking is rescheduled
 */
export async function updateCalendarEvent(
  workspaceId: number,
  eventId: string,
  params: { startAt: string; endAt: string; summary?: string; serviceProviderId?: string | null }
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = await getCalendarClient({
      workspaceId,
      serviceProviderId: params.serviceProviderId,
    });
    if (!calendar) return { success: false, error: 'Calendar not connected' };

    await calendar.events.patch({
      calendarId: 'primary',
      eventId,
      requestBody: {
        start: { dateTime: params.startAt },
        end: { dateTime: params.endAt },
        ...(params.summary ? { summary: params.summary } : {}),
      },
      sendUpdates: 'none',
    });

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('updateCalendarEvent error:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Delete a calendar event when a booking is cancelled
 */
export async function deleteCalendarEvent(
  workspaceId: number,
  eventId: string,
  serviceProviderId?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    const calendar = await getCalendarClient({ workspaceId, serviceProviderId });
    if (!calendar) return { success: false, error: 'Calendar not connected' };

    await calendar.events.delete({
      calendarId: 'primary',
      eventId,
      sendUpdates: 'none',
    });

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('deleteCalendarEvent error:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Get busy time slots from Google Calendar for availability checking
 */
export async function getBusySlots(
  workspaceId: number,
  timeMin: string,
  timeMax: string,
  serviceProviderId?: string | null
): Promise<BusySlot[]> {
  try {
    const calendar = await getCalendarClient({ workspaceId, serviceProviderId });
    if (!calendar) return [];

    const res = await calendar.freebusy.query({
      requestBody: {
        timeMin,
        timeMax,
        items: [{ id: 'primary' }],
      },
    });

    const primary = res.data.calendars?.['primary'];
    if (!primary?.busy) return [];

    return primary.busy.map((b) => ({
      start_at: b.start!,
      end_at: b.end!,
    }));
  } catch (err) {
    console.error('getBusySlots error:', err instanceof Error ? err.message : err);
    return [];
  }
}

/**
 * Check if a time slot overlaps with any Google Calendar busy event
 */
export async function isSlotBusyInCalendar(
  workspaceId: number,
  startAt: string,
  endAt: string,
  serviceProviderId?: string | null
): Promise<boolean> {
  const slots = await getBusySlots(workspaceId, startAt, endAt, serviceProviderId);
  const start = new Date(startAt);
  const end = new Date(endAt);

  return slots.some((slot) => {
    const slotStart = new Date(slot.start_at);
    const slotEnd = new Date(slot.end_at);
    return start < slotEnd && end > slotStart;
  });
}
