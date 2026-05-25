import { google } from 'googleapis';
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

/**
 * Create a calendar event when a booking is created
 */
export async function createCalendarEvent(
  params: CreateCalendarEventParams
): Promise<{ eventId: string | null; error?: string }> {
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
  } = params;

  try {
    const calendar = await getCalendarClient({ workspaceId, serviceProviderId });
    if (!calendar) return { eventId: null };

    const event: {
      summary: string;
      description?: string;
      start: { dateTime: string };
      end: { dateTime: string };
      location?: string;
      attendees?: { email: string }[];
      extendedProperties?: { shared: Record<string, string> };
    } = {
      summary,
      start: { dateTime: startAt },
      end: { dateTime: endAt },
    };
    if (description) event.description = description;
    if (location) event.location = location;
    if (attendeeEmail) event.attendees = [{ email: attendeeEmail }];
    if (metadata?.bookingId) {
      event.extendedProperties = { shared: { bookingId: metadata.bookingId } };
      if (metadata.eventTypeName) event.extendedProperties.shared.eventTypeName = metadata.eventTypeName;
    }

    const res = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: event,
      sendUpdates: 'none',
    });

    return { eventId: res.data.id ?? null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('createCalendarEvent error:', msg);
    return { eventId: null, error: msg };
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
