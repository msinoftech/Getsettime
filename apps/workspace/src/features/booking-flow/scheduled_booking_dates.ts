import { expand_recurrence_occurrences } from '@/lib/booking_recurrence';
import {
  CALENDAR_BUFFER_DAYS,
  CALENDAR_BUFFER_DAYS_BEFORE,
} from '@/src/constants/booking';
import { normalizeDate } from '@/src/utils/bookingTime';
import type { booking_event_type_flow_fields } from './event_type_booking_flow';
import {
  event_type_recurrence_of,
  event_type_session_duration_minutes,
  uses_scheduled_event_type_slots,
} from './event_type_booking_flow';
import { scheduled_booking_window_days } from './event_type_booking_window';

function date_from_iso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return normalizeDate(new Date(year, month - 1, day));
}

/** Every published session date for a scheduled (offered) event type. */
export function list_scheduled_session_dates(params: {
  event_type: booking_event_type_flow_fields;
  provider_timezone: string;
  duration_minutes: number;
}): Date[] {
  if (!uses_scheduled_event_type_slots(params.event_type)) return [];

  const window_days = scheduled_booking_window_days(
    params.event_type,
    params.provider_timezone
  );
  const occurrences = expand_recurrence_occurrences({
    recurrence: event_type_recurrence_of(params.event_type),
    timezone: params.provider_timezone,
    duration_minutes: params.duration_minutes,
    window_days,
  });

  return occurrences.map((occurrence) => date_from_iso(occurrence.date));
}

export function resolve_scheduled_booking_fetch_range(params: {
  event_type: booking_event_type_flow_fields;
  provider_timezone: string;
  duration_minutes: number;
}): { rangeStart: Date; rangeEnd: Date } | null {
  const session_dates = list_scheduled_session_dates(params);
  if (session_dates.length === 0) return null;

  const rangeStart = new Date(session_dates[0]);
  rangeStart.setDate(rangeStart.getDate() - CALENDAR_BUFFER_DAYS_BEFORE);
  const rangeEnd = new Date(session_dates[session_dates.length - 1]);
  rangeEnd.setDate(rangeEnd.getDate() + CALENDAR_BUFFER_DAYS);
  return { rangeStart, rangeEnd };
}

export function resolve_booking_data_fetch_range(params: {
  days: Date[];
  event_type: booking_event_type_flow_fields | null | undefined;
  provider_timezone: string;
  duration_minutes: number;
}): { rangeStart: Date; rangeEnd: Date } {
  if (params.event_type && uses_scheduled_event_type_slots(params.event_type)) {
    const scheduled = resolve_scheduled_booking_fetch_range({
      event_type: params.event_type,
      provider_timezone: params.provider_timezone,
      duration_minutes: params.duration_minutes,
    });
    if (scheduled) return scheduled;
  }

  const startDate = params.days[0] ?? new Date();
  const endDate = params.days[params.days.length - 1] ?? new Date();
  const rangeStart = new Date(startDate);
  rangeStart.setDate(rangeStart.getDate() - CALENDAR_BUFFER_DAYS_BEFORE);
  const rangeEnd = new Date(endDate);
  rangeEnd.setDate(rangeEnd.getDate() + CALENDAR_BUFFER_DAYS);
  return { rangeStart, rangeEnd };
}

export function scheduled_session_duration_minutes(
  event_type: booking_event_type_flow_fields,
  effective_minutes: number
): number {
  return event_type_session_duration_minutes(event_type, effective_minutes);
}
