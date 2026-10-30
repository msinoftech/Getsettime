import {
  parse_datetime_local_input,
  parse_iso_date_input,
  parse_time_input,
} from '@/src/features/event-types/event_type_availability';
import { parse_event_type_recurrence } from '@/src/features/event-types/event_type_recurrence';
import type {
  event_type_recurrence,
  event_type_recurrence_frequency,
  event_type_recurrence_weekday,
} from '@/src/types/event_types';
import { localDateTimeToUtcIso } from '@/lib/date-timezone';

const WEEKDAY_INDEX: Record<event_type_recurrence_weekday, number> = {
  sun: 0,
  mon: 1,
  tue: 2,
  wed: 3,
  thu: 4,
  fri: 5,
  sat: 6,
};

const MAX_CANDIDATE_STEPS = 400;
const DEFAULT_ROLLING_WINDOW_DAYS = 90;
const SCHEDULE_LOOKAHEAD_DAYS = 3650;

export const OFFERED_SCHEDULE_MISMATCH_MESSAGE =
  'The selected time is not part of this event type session schedule. Please pick an offered session.';

export type booking_occurrence_instant = {
  date: string;
  time: string;
  start_at: string;
  end_at: string;
};

function add_iso_days(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const next = new Date(year, month - 1, day + days);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, '0');
  const d = String(next.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function add_iso_months(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const last_of_target = new Date(year, month - 1 + months + 1, 0).getDate();
  const next = new Date(year, month - 1 + months, Math.min(day, last_of_target));
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, '0');
  const d = String(next.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function local_date_from_iso(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function is_selected_weekday(
  iso: string,
  days_of_week: event_type_recurrence_weekday[]
): boolean {
  if (days_of_week.length === 0) return false;
  const wanted = new Set(days_of_week.map((day) => WEEKDAY_INDEX[day]));
  return wanted.has(local_date_from_iso(iso).getDay());
}

function first_candidate_date(
  start_date: string,
  frequency: event_type_recurrence_frequency,
  days_of_week: event_type_recurrence_weekday[]
): string {
  if (frequency !== 'weekly') return start_date;
  let current = start_date;
  for (let i = 0; i < 7; i += 1) {
    if (is_selected_weekday(current, days_of_week)) return current;
    current = add_iso_days(current, 1);
  }
  return start_date;
}

function next_candidate_date(
  current: string,
  frequency: event_type_recurrence_frequency,
  days_of_week: event_type_recurrence_weekday[]
): string {
  if (frequency === 'daily') return add_iso_days(current, 1);
  if (frequency === 'monthly') return add_iso_months(current, 1);
  let next = add_iso_days(current, 1);
  for (let i = 0; i < 7; i += 1) {
    if (is_selected_weekday(next, days_of_week)) return next;
    next = add_iso_days(next, 1);
  }
  return add_iso_days(current, 7);
}

function iso_date_plus_days(days: number, from = new Date()): string {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function end_of_iso_date_utc(date: string, timezone: string): string {
  return localDateTimeToUtcIso(date, 23, 59, timezone);
}

export function rolling_occurrence_window_days(max_booking_window_days?: number | null): number {
  if (typeof max_booking_window_days === 'number' && max_booking_window_days >= 1) {
    return Math.min(Math.trunc(max_booking_window_days), DEFAULT_ROLLING_WINDOW_DAYS);
  }
  return DEFAULT_ROLLING_WINDOW_DAYS;
}

export function recurrence_session_limit(
  recurrence: event_type_recurrence
): number | null {
  if (recurrence.end_type === 'after') {
    if (recurrence.end_after_sessions != null && recurrence.end_after_sessions >= 1) {
      return Math.trunc(recurrence.end_after_sessions);
    }
  }
  // Repeating group/class schedules run until end date or custom window — not session_preset.
  if (recurrence.enabled) return null;
  if (recurrence.end_type === 'never') return null;

  if (recurrence.custom_session_count != null && recurrence.custom_session_count >= 1) {
    return Math.trunc(recurrence.custom_session_count);
  }
  if (recurrence.session_preset != null && recurrence.session_preset >= 1) {
    return Math.trunc(recurrence.session_preset);
  }
  return null;
}

/** True when the schedule stops on its own (session count, end date, or window). */
export function is_bounded_recurrence(recurrence: event_type_recurrence): boolean {
  if (recurrence_session_limit(recurrence) != null) return true;
  if (recurrence.custom_availability_end != null) return true;
  return recurrence.end_type === 'on_date' && recurrence.end_date != null;
}

export function occurrence_start_matches(left: string, right: string): boolean {
  const a = new Date(left).getTime();
  const b = new Date(right).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  return Math.abs(a - b) < 60_000;
}

export function expand_recurrence_occurrences(params: {
  recurrence: event_type_recurrence | null | undefined;
  timezone: string;
  duration_minutes: number;
  series_start_at?: string | null;
  series_end_at?: string | null;
  window_days?: number;
  from_date?: string | null;
  include_from_at?: string | null;
}): booking_occurrence_instant[] {
  const recurrence = parse_event_type_recurrence(params.recurrence);
  const frequency = recurrence.enabled
    ? recurrence.allowed_frequency || recurrence.frequency
    : recurrence.frequency;
  const start_time = parse_time_input(recurrence.start_time) || '10:00';
  const [hour, minute] = start_time.split(':').map((part) => parseInt(part, 10));
  const duration = Math.max(1, Math.trunc(params.duration_minutes || 30));

  const series_start_date = params.series_start_at
    ? parse_iso_date_input(params.series_start_at.slice(0, 10))
    : null;
  const custom_start_date = recurrence.custom_availability_start
    ? parse_iso_date_input(recurrence.custom_availability_start.slice(0, 10))
    : null;
  const start_date =
    parse_iso_date_input(recurrence.start_date) ||
    custom_start_date ||
    series_start_date ||
    iso_date_plus_days(0);

  const window_start_at = datetime_local_to_utc_iso(
    recurrence.custom_availability_start,
    params.timezone
  );
  const custom_end_at = datetime_local_to_utc_iso(
    recurrence.custom_availability_end,
    params.timezone
  );
  const on_date_end_at =
    recurrence.end_type === 'on_date' && recurrence.end_date
      ? end_of_iso_date_utc(recurrence.end_date, params.timezone)
      : null;
  const series_end_at = params.series_end_at
    ? new Date(params.series_end_at).toISOString()
    : null;

  const session_limit = recurrence_session_limit(recurrence);

  // The booking window caps how far ahead occurrences may be generated even for
  // series that already end on a session count or date.
  const window_days =
    typeof params.window_days === 'number' && params.window_days >= 1
      ? Math.trunc(params.window_days)
      : DEFAULT_ROLLING_WINDOW_DAYS;
  let window_end_at = end_of_iso_date_utc(
    iso_date_plus_days(window_days),
    params.timezone
  );
  const from_date_iso = parse_iso_date_input(params.from_date);
  if (from_date_iso) {
    const from_date_end = end_of_iso_date_utc(from_date_iso, params.timezone);
    if (from_date_end > window_end_at) {
      window_end_at = from_date_end;
    }
  }

  const days_of_week = frequency === 'weekly' ? recurrence.days_of_week : [];
  let current = first_candidate_date(start_date, frequency, days_of_week);
  const occurrences: booking_occurrence_instant[] = [];

  for (let step = 0; step < MAX_CANDIDATE_STEPS; step += 1) {
    if (session_limit != null && occurrences.length >= session_limit) break;

    const start_at = localDateTimeToUtcIso(current, hour, minute, params.timezone);
    const start_ms = new Date(start_at).getTime();
    if (!Number.isFinite(start_ms)) break;

    if (start_at > window_end_at) break;
    if (custom_end_at && start_at > custom_end_at) break;
    if (on_date_end_at && start_at > on_date_end_at) break;
    if (series_end_at && start_at > series_end_at) break;

    const before_custom_start = window_start_at != null && start_at < window_start_at;
    if (before_custom_start) {
      current = next_candidate_date(current, frequency, days_of_week);
      continue;
    }

    const end_at = new Date(start_ms + duration * 60_000).toISOString();
    occurrences.push({ date: current, time: start_time, start_at, end_at });
    current = next_candidate_date(current, frequency, days_of_week);
  }

  const include_from_at = params.include_from_at || null;
  const include_from_date = parse_iso_date_input(params.from_date);
  return occurrences.filter((occurrence) => {
    if (include_from_at && occurrence.start_at < include_from_at) return false;
    if (include_from_date && occurrence.date < include_from_date) return false;
    return true;
  });
}

/** The scheduled session starting at `start_at`, or null when none is offered. */
export function find_scheduled_occurrence(params: {
  recurrence: event_type_recurrence | null | undefined;
  timezone: string;
  duration_minutes: number;
  start_at: string;
  window_days?: number;
}): booking_occurrence_instant | null {
  const [candidate] = expand_recurrence_occurrences({
    recurrence: params.recurrence,
    timezone: params.timezone,
    duration_minutes: params.duration_minutes,
    window_days: params.window_days,
    include_from_at: params.start_at,
  });
  if (!candidate) return null;
  return occurrence_start_matches(candidate.start_at, params.start_at)
    ? candidate
    : null;
}

/** End of the final scheduled session, or null when the schedule is open-ended. */
export function recurrence_schedule_end_at(params: {
  recurrence: event_type_recurrence | null | undefined;
  timezone: string;
  duration_minutes: number;
}): string | null {
  const recurrence = parse_event_type_recurrence(params.recurrence);
  if (!is_bounded_recurrence(recurrence)) return null;

  const occurrences = expand_recurrence_occurrences({
    recurrence,
    timezone: params.timezone,
    duration_minutes: params.duration_minutes,
    window_days: SCHEDULE_LOOKAHEAD_DAYS,
  });
  return occurrences.length > 0 ? occurrences[occurrences.length - 1].end_at : null;
}
