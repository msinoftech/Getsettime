import {
  datetime_local_from_date_and_time,
  datetime_local_to_ms,
  iso_date_from_date,
  parse_iso_date_input,
  parse_time_input,
} from '@/src/features/event-types/event_type_availability';
import type {
  event_type_recurrence_frequency,
  event_type_recurrence_weekday,
} from '@/src/types/event_types';
import type { date_exception } from '@/src/types/date_exceptions';
import type { AvailabilitySettings } from '@/src/types/workspace';
import { resolveAvailabilityForServiceProvider } from '@/src/utils/availabilityResolution';
import {
  getDayName,
  isTimeSlotOnBreak,
  parseTimeToMinutes,
} from '@/src/utils/bookingTime';
import { validateSlotDateExceptions } from '@/src/utils/dateExceptionApiValidation';

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
const FALLBACK_DURATION_MINUTES = 30;

export type recurrence_series_preview = {
  ends_on: string | null;
  max_sessions: number | null;
  occurrence_count: number;
};

export type recurrence_series_calculation_input = {
  frequency: event_type_recurrence_frequency;
  days_of_week: event_type_recurrence_weekday[];
  start_date: string;
  start_time: string;
  session_count: number;
  duration_minutes: number;
  custom_availability: boolean;
  custom_availability_start: string | null;
  custom_availability_end: string | null;
  provider_ids: string[];
  workspace_availability: AvailabilitySettings | null;
  date_exceptions: date_exception[];
};

export function recurrence_sessions_capacity_error(max_sessions: number): string {
  if (max_sessions < 1) {
    return 'The selected Custom Availability period cannot accommodate any sessions for this recurrence. Please extend the Custom Availability end date or choose a time the provider is available.';
  }
  const unit = max_sessions === 1 ? 'session' : 'sessions';
  return `The selected Custom Availability period can accommodate a maximum of ${max_sessions} ${unit}. Please reduce the number of sessions or extend the Custom Availability end date.`;
}

function has_timesheet_data(
  timesheet: AvailabilitySettings['timesheet']
): boolean {
  return !!timesheet && Object.keys(timesheet).length > 0;
}

function add_iso_days(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  return iso_date_from_date(new Date(year, month - 1, day + days));
}

function add_iso_months(iso: string, months: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const last_of_target = new Date(year, month - 1 + months + 1, 0).getDate();
  return iso_date_from_date(new Date(year, month - 1 + months, Math.min(day, last_of_target)));
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

function is_slot_open_for_provider(
  date_str: string,
  start_time: string,
  duration_minutes: number,
  workspace_availability: AvailabilitySettings | null,
  provider_id: string | null,
  date_exceptions: date_exception[]
): boolean {
  const availability = resolveAvailabilityForServiceProvider(
    workspace_availability,
    provider_id
  );
  const day_name = getDayName(local_date_from_iso(date_str));
  const day_schedule = availability.timesheet?.[day_name];
  const start_minutes = parseTimeToMinutes(start_time);
  const end_minutes = start_minutes + duration_minutes;
  const timesheet_start = day_schedule
    ? parseTimeToMinutes(day_schedule.startTime)
    : 9 * 60;
  const timesheet_end = day_schedule
    ? parseTimeToMinutes(day_schedule.endTime)
    : 17 * 60;

  const exception_validation = validateSlotDateExceptions(
    date_exceptions,
    date_str,
    provider_id,
    start_minutes,
    end_minutes,
    timesheet_start,
    timesheet_end
  );

  if (exception_validation.blocked && exception_validation.error?.includes('closed')) {
    return false;
  }

  if (has_timesheet_data(availability.timesheet)) {
    if (!day_schedule?.enabled && !exception_validation.allowDisabledDay) {
      return false;
    }
    const schedule_start = exception_validation.startMinutes ?? timesheet_start;
    const schedule_end = exception_validation.endMinutes ?? timesheet_end;
    if (start_minutes < schedule_start || start_minutes > schedule_end) {
      return false;
    }
    if (
      day_schedule?.breaks?.length &&
      isTimeSlotOnBreak(start_minutes, end_minutes, day_schedule.breaks)
    ) {
      return false;
    }
    const individual_key = `${date_str}-${Math.floor(start_minutes / 60)}`;
    if (availability.individual?.[individual_key] === false) {
      return false;
    }
  }

  if (exception_validation.blocked) return false;
  return true;
}

function is_occurrence_available(
  date_str: string,
  start_time: string,
  duration_minutes: number,
  provider_ids: string[],
  workspace_availability: AvailabilitySettings | null,
  date_exceptions: date_exception[]
): boolean {
  const ids = provider_ids.map((id) => id.trim()).filter(Boolean);
  if (ids.length === 0) {
    return is_slot_open_for_provider(
      date_str,
      start_time,
      duration_minutes,
      workspace_availability,
      null,
      date_exceptions
    );
  }
  return ids.every((provider_id) =>
    is_slot_open_for_provider(
      date_str,
      start_time,
      duration_minutes,
      workspace_availability,
      provider_id,
      date_exceptions
    )
  );
}

function occurrence_ms(date_str: string, start_time: string): number | null {
  return datetime_local_to_ms(datetime_local_from_date_and_time(date_str, start_time));
}

export function calculate_recurrence_series(
  input: recurrence_series_calculation_input
): recurrence_series_preview | null {
  const start_date = parse_iso_date_input(input.start_date);
  const start_time = parse_time_input(input.start_time);
  if (!start_date || !start_time) return null;
  if (input.frequency === 'weekly' && input.days_of_week.length === 0) return null;
  if (!Number.isFinite(input.session_count) || input.session_count < 1) return null;

  const duration_minutes =
    Number.isFinite(input.duration_minutes) && input.duration_minutes >= 1
      ? Math.trunc(input.duration_minutes)
      : FALLBACK_DURATION_MINUTES;

  const window_start_ms =
    input.custom_availability && input.custom_availability_start
      ? datetime_local_to_ms(input.custom_availability_start)
      : null;
  const window_end_ms =
    input.custom_availability && input.custom_availability_end
      ? datetime_local_to_ms(input.custom_availability_end)
      : null;
  const bounded = window_end_ms != null;

  const occurrences: string[] = [];
  let current = first_candidate_date(start_date, input.frequency, input.days_of_week);

  for (let step = 0; step < MAX_CANDIDATE_STEPS; step += 1) {
    const ms = occurrence_ms(current, start_time);
    if (ms == null) break;
    if (window_end_ms != null && ms > window_end_ms) break;
    if (window_start_ms != null && ms < window_start_ms) {
      current = next_candidate_date(current, input.frequency, input.days_of_week);
      continue;
    }

    if (
      is_occurrence_available(
        current,
        start_time,
        duration_minutes,
        input.provider_ids,
        input.workspace_availability,
        input.date_exceptions
      )
    ) {
      occurrences.push(current);
      if (!bounded && occurrences.length >= input.session_count) break;
    }

    current = next_candidate_date(current, input.frequency, input.days_of_week);
  }

  const max_sessions = bounded ? occurrences.length : null;
  const ends_on =
    occurrences.length >= input.session_count
      ? occurrences[input.session_count - 1] ?? null
      : null;

  return {
    ends_on,
    max_sessions,
    occurrence_count: occurrences.length,
  };
}
