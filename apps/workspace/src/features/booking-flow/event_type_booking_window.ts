import { expand_recurrence_occurrences } from '@/lib/booking_recurrence';
import { formatUtcInTimezone, localDateTimeToUtcIso } from '@/lib/date-timezone';
import {
  format_datetime_local_label,
  parse_datetime_local_input,
  parse_event_type_availability_mode,
  parse_time_input,
} from '@/src/features/event-types/event_type_availability';
import { EVENT_TYPE_RECURRENCE_WEEKDAY_OPTIONS } from '@/src/features/event-types/event_type_recurrence';
import type { event_type_recurrence } from '@/src/types/event_types';
import type { booking_event_type_flow_fields } from './event_type_booking_flow';
import {
  event_type_max_window_days,
  event_type_recurrence_of,
  uses_scheduled_event_type_slots,
} from './event_type_booking_flow';

function custom_window_bounds_utc(
  event_type: booking_event_type_flow_fields,
  timezone: string
): { start_at: string | null; end_at: string | null } {
  const recurrence = event_type_recurrence_of(event_type);
  return {
    start_at: datetime_local_to_utc_iso(recurrence.custom_availability_start, timezone),
    end_at: datetime_local_to_utc_iso(recurrence.custom_availability_end, timezone),
  };
}

function datetime_local_to_utc_iso(
  value: string | null | undefined,
  timezone: string
): string | null {
  const parsed = parse_datetime_local_input(value);
  if (!parsed) return null;
  const [date_part, time_part] = parsed.split('T');
  const [hour, minute] = time_part.split(':').map((part) => parseInt(part, 10));
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return localDateTimeToUtcIso(date_part, hour, minute, timezone);
}

export function event_type_uses_custom_availability_window(
  event_type: booking_event_type_flow_fields | null | undefined
): boolean {
  return parse_event_type_availability_mode(event_type?.availability_mode) === 'custom';
}

/** True when the current instant is inside the custom booking open/close window. */
export function is_event_type_booking_open(
  event_type: booking_event_type_flow_fields,
  timezone: string,
  now_ms = Date.now()
): boolean {
  if (!event_type_uses_custom_availability_window(event_type)) return true;
  const { start_at, end_at } = custom_window_bounds_utc(event_type, timezone);
  if (start_at && now_ms < new Date(start_at).getTime()) return false;
  if (end_at && now_ms > new Date(end_at).getTime()) return false;
  return true;
}

export function is_date_within_event_type_booking_window(
  date: Date,
  event_type: booking_event_type_flow_fields,
  timezone: string
): boolean {
  if (!event_type_uses_custom_availability_window(event_type)) return true;

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const day_start = localDateTimeToUtcIso(`${y}-${m}-${d}`, 0, 0, timezone);
  const day_end = localDateTimeToUtcIso(`${y}-${m}-${d}`, 23, 59, timezone);
  const { start_at, end_at } = custom_window_bounds_utc(event_type, timezone);

  if (start_at && day_end < start_at) return false;
  if (end_at && day_start > end_at) return false;
  return true;
}

function format_window_instant(
  instant: string | null,
  viewer_timezone: string
): string {
  if (!instant) return '—';
  return formatUtcInTimezone(instant, viewer_timezone, { timeZoneName: undefined });
}

export function scheduled_booking_window_days(
  event_type: booking_event_type_flow_fields,
  provider_timezone: string
): number {
  const configured = event_type_max_window_days(event_type);
  const recurrence = event_type_recurrence_of(event_type);
  const custom_end = datetime_local_to_utc_iso(
    recurrence.custom_availability_end,
    provider_timezone
  );
  if (!custom_end) return configured;
  const days_until_end = Math.ceil(
    (new Date(custom_end).getTime() - Date.now()) / 86_400_000
  );
  if (!Number.isFinite(days_until_end)) return configured;
  return Math.max(configured, Math.min(Math.max(days_until_end + 1, 1), 3650));
}

function format_schedule_time_label(time: string | null | undefined): string {
  const normalized = parse_time_input(time);
  if (!normalized) return '';
  const [hour, minute] = normalized.split(':').map((part) => parseInt(part, 10));
  const date = new Date(2000, 0, 1, hour, minute);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function summarize_recurrence_schedule(recurrence: event_type_recurrence): string {
  const frequency = recurrence.enabled
    ? recurrence.allowed_frequency || recurrence.frequency
    : recurrence.frequency;
  const time_label = format_schedule_time_label(recurrence.start_time);
  const time_part = time_label ? ` at ${time_label}` : '';

  if (frequency === 'daily') {
    return `Sessions run daily${time_part}.`;
  }
  if (frequency === 'weekly' && recurrence.days_of_week.length > 0) {
    const labels = recurrence.days_of_week.map(
      (day) =>
        EVENT_TYPE_RECURRENCE_WEEKDAY_OPTIONS.find((option) => option.value === day)
          ?.label ?? day
    );
    return `Sessions run weekly on ${labels.join(', ')}${time_part}.`;
  }
  if (frequency === 'monthly') {
    return `Sessions run monthly${time_part}.`;
  }
  return time_part ? `Sessions run${time_part}.` : 'Check the event schedule for session times.';
}

function summarize_booking_period(recurrence: event_type_recurrence): string | null {
  const start_label = format_datetime_local_label(recurrence.custom_availability_start ?? '');
  const end_label = format_datetime_local_label(recurrence.custom_availability_end ?? '');
  if (start_label !== '—' && end_label !== '—') {
    return `Booking period: ${start_label} – ${end_label}.`;
  }
  if (start_label !== '—') {
    return `Booking opens ${start_label}.`;
  }
  if (end_label !== '—') {
    return `Booking closes ${end_label}.`;
  }
  return null;
}

export function describe_event_type_booking_slot_availability(params: {
  event_type: booking_event_type_flow_fields;
  selected_date: Date | null;
  provider_timezone: string;
  viewer_timezone: string;
  duration_minutes: number;
}): string | null {
  const {
    event_type,
    selected_date,
    provider_timezone,
    viewer_timezone,
    duration_minutes,
  } = params;
  const recurrence = event_type_recurrence_of(event_type);
  const now_ms = Date.now();

  if (event_type_uses_custom_availability_window(event_type)) {
    const { start_at, end_at } = custom_window_bounds_utc(event_type, provider_timezone);

    if (start_at && now_ms < new Date(start_at).getTime()) {
      return `Booking opens on ${format_window_instant(start_at, viewer_timezone)}.`;
    }

    if (end_at && now_ms > new Date(end_at).getTime()) {
      return `Booking for this event closed on ${format_window_instant(end_at, viewer_timezone)}.`;
    }

    if (
      selected_date &&
      !is_date_within_event_type_booking_window(
        selected_date,
        event_type,
        provider_timezone
      )
    ) {
      const start_label = format_datetime_local_label(
        recurrence.custom_availability_start ?? ''
      );
      const end_label = format_datetime_local_label(recurrence.custom_availability_end ?? '');
      return `This date is outside the booking period (${start_label} – ${end_label}).`;
    }
  }

  if (!selected_date || !uses_scheduled_event_type_slots(event_type)) {
    return null;
  }

  const y = selected_date.getFullYear();
  const m = String(selected_date.getMonth() + 1).padStart(2, '0');
  const d = String(selected_date.getDate()).padStart(2, '0');
  const date_str = `${y}-${m}-${d}`;

  const window_days = scheduled_booking_window_days(event_type, provider_timezone);
  const occurrences = expand_recurrence_occurrences({
    recurrence,
    timezone: provider_timezone,
    duration_minutes,
    window_days,
    from_date: date_str,
  }).filter((occurrence) => occurrence.date === date_str);

  if (occurrences.length === 0) {
    const next = expand_recurrence_occurrences({
      recurrence,
      timezone: provider_timezone,
      duration_minutes,
      window_days,
      include_from_at: new Date().toISOString(),
    })[0];

    const schedule_summary = summarize_recurrence_schedule(recurrence);
    const period_summary = event_type_uses_custom_availability_window(event_type)
      ? summarize_booking_period(recurrence)
      : null;

    if (next) {
      const parts = [
        `No sessions on this date. Next session: ${format_window_instant(next.start_at, viewer_timezone)}.`,
        schedule_summary,
        period_summary,
      ].filter(Boolean);
      return parts.join(' ');
    }

    const parts = [
      'No sessions are scheduled on this date.',
      schedule_summary,
      period_summary,
    ].filter(Boolean);
    return parts.join(' ');
  }

  return null;
}
