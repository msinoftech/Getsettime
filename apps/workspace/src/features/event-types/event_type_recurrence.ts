import {
  parse_datetime_local_input,
  parse_time_input,
} from '@/src/features/event-types/event_type_availability';
import type {
  event_type_format,
  event_type_recurrence,
  event_type_recurrence_allowed_frequency,
  event_type_recurrence_audience,
  event_type_recurrence_frequency,
  event_type_recurrence_weekday,
} from '@/src/types/event_types';

export type {
  event_type_recurrence,
  event_type_recurrence_allowed_frequency,
  event_type_recurrence_audience,
  event_type_recurrence_end_type,
  event_type_recurrence_frequency,
  event_type_recurrence_weekday,
} from '@/src/types/event_types';

export const EVENT_TYPE_RECURRENCE_AUDIENCE_OPTIONS: ReadonlyArray<{
  value: event_type_recurrence_audience;
  label: string;
  description: string;
}> = [
  {
    value: 'single',
    label: 'Single',
    description: 'One attendee per session.',
  },
  {
    value: 'group',
    label: 'Group',
    description: 'Multiple attendees per session.',
  },
];

export const EVENT_TYPE_RECURRENCE_FREQUENCY_OPTIONS: ReadonlyArray<{
  value: event_type_recurrence_frequency;
  label: string;
}> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export const EVENT_TYPE_RECURRENCE_WEEKDAY_OPTIONS: ReadonlyArray<{
  value: event_type_recurrence_weekday;
  label: string;
}> = [
  { value: 'sun', label: 'Sun' },
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
];

export const EVENT_TYPE_SESSION_PRESET_OPTIONS: ReadonlyArray<number> = [
  4, 8, 12,
];

const WEEKDAY_SET = new Set<string>(
  EVENT_TYPE_RECURRENCE_WEEKDAY_OPTIONS.map((option) => option.value)
);

const PRESET_SET = new Set<number>(EVENT_TYPE_SESSION_PRESET_OPTIONS);

function parse_allowed_frequency(
  value: unknown,
  fallback: event_type_recurrence_allowed_frequency
): event_type_recurrence_allowed_frequency {
  const frequency = String(value ?? '').toLowerCase();
  if (frequency === 'biweekly') return 'weekly';
  if (frequency === 'daily' || frequency === 'monthly') return frequency;
  if (frequency === 'weekly') return 'weekly';
  return fallback;
}

function parse_session_preset(value: unknown): number | null {
  const preset =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.trunc(value)
      : parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(preset) && PRESET_SET.has(preset) ? preset : null;
}

function parse_custom_session_count(value: unknown): number | null {
  const count =
    typeof value === 'number' && Number.isFinite(value)
      ? Math.trunc(value)
      : parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(count) && count >= 1 ? count : null;
}

function is_iso_date(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parse_audience(value: unknown): event_type_recurrence_audience {
  return value === 'group' ? 'group' : 'single';
}

export function default_event_type_recurrence(): event_type_recurrence {
  return {
    enabled: false,
    audience: 'single',
    frequency: 'weekly',
    days_of_week: [],
    start_date: null,
    start_time: null,
    end_type: 'never',
    end_date: null,
    end_after_sessions: 8,
    allowed_frequency: 'weekly',
    session_preset: EVENT_TYPE_SESSION_PRESET_OPTIONS[0],
    custom_session_count: null,
    custom_availability_start: null,
    custom_availability_end: null,
  };
}

export function parse_event_type_recurrence(
  value: unknown
): event_type_recurrence {
  const defaults = default_event_type_recurrence();
  if (!value || typeof value !== 'object') return defaults;

  const raw = value as Record<string, unknown>;
  const frequency =
    raw.frequency === 'daily' || raw.frequency === 'monthly'
      ? raw.frequency
      : 'weekly';

  const days_raw = Array.isArray(raw.days_of_week) ? raw.days_of_week : [];
  const days_of_week = days_raw
    .map((day) => String(day).toLowerCase())
    .filter((day): day is event_type_recurrence_weekday => WEEKDAY_SET.has(day));

  const end_type =
    raw.end_type === 'on_date' || raw.end_type === 'after' ? raw.end_type : 'never';

  const start_date =
    typeof raw.start_date === 'string' && is_iso_date(raw.start_date)
      ? raw.start_date
      : null;
  const end_date =
    typeof raw.end_date === 'string' && is_iso_date(raw.end_date)
      ? raw.end_date
      : null;

  let end_after_sessions = defaults.end_after_sessions;
  if (typeof raw.end_after_sessions === 'number' && Number.isFinite(raw.end_after_sessions)) {
    end_after_sessions = Math.max(1, Math.trunc(raw.end_after_sessions));
  } else if (
    typeof raw.end_after_sessions === 'string' &&
    /^\d+$/.test(raw.end_after_sessions.trim())
  ) {
    end_after_sessions = Math.max(1, parseInt(raw.end_after_sessions.trim(), 10));
  }

  const custom_session_count = parse_custom_session_count(raw.custom_session_count);
  const session_preset =
    custom_session_count != null
      ? null
      : raw.session_preset === undefined
        ? defaults.session_preset
        : parse_session_preset(raw.session_preset);

  return {
    enabled: raw.enabled === true,
    audience: parse_audience(raw.audience),
    frequency,
    days_of_week,
    start_date,
    start_time: parse_time_input(raw.start_time),
    end_type,
    end_date,
    end_after_sessions,
    allowed_frequency: parse_allowed_frequency(
      raw.allowed_frequency,
      defaults.allowed_frequency
    ),
    session_preset,
    custom_session_count,
    custom_availability_start: parse_datetime_local_input(
      raw.custom_availability_start
    ),
    custom_availability_end: parse_datetime_local_input(
      raw.custom_availability_end
    ),
  };
}

function validate_recurrence_schedule(
  parsed: event_type_recurrence,
  frequency: event_type_recurrence_frequency
): { ok: true } | { ok: false; message: string } {
  if (!parsed.start_date) {
    return { ok: false, message: 'Recurrence start date is required.' };
  }

  if (!parsed.start_time) {
    return { ok: false, message: 'Session time is required.' };
  }

  if (frequency === 'weekly' && parsed.days_of_week.length === 0) {
    return {
      ok: false,
      message: 'Select at least one day for weekly recurrence.',
    };
  }

  if (parsed.end_type === 'on_date') {
    if (!parsed.end_date) {
      return { ok: false, message: 'Recurrence end date is required.' };
    }
    if (parsed.end_date < parsed.start_date) {
      return {
        ok: false,
        message: 'Recurrence end date must be on or after the start date.',
      };
    }
    const custom_end_date = parsed.custom_availability_end?.slice(0, 10);
    if (custom_end_date && parsed.end_date > custom_end_date) {
      return {
        ok: false,
        message:
          'Recurrence end date must be on or before the custom availability end date.',
      };
    }
  }

  if (parsed.end_type === 'after') {
    if (
      parsed.end_after_sessions == null ||
      !Number.isFinite(parsed.end_after_sessions) ||
      parsed.end_after_sessions < 1
    ) {
      return {
        ok: false,
        message: 'Recurrence session count must be at least 1.',
      };
    }
  }

  return { ok: true };
}

function validate_one_time_schedule(
  parsed: event_type_recurrence
): { ok: true } | { ok: false; message: string } {
  return validate_recurrence_schedule(parsed, parsed.frequency);
}

function validate_group_recurring_booking(
  parsed: event_type_recurrence
): { ok: true } | { ok: false; message: string } {
  const schedule = validate_recurrence_schedule(parsed, parsed.allowed_frequency);
  if (!schedule.ok) return schedule;

  const custom_session_selected = parsed.session_preset == null;
  if (custom_session_selected && parsed.custom_session_count == null) {
    return {
      ok: false,
      message: 'Custom number of sessions must be at least 1.',
    };
  }
  return { ok: true };
}

function normalize_one_time_recurrence(
  parsed: event_type_recurrence
): event_type_recurrence {
  return {
    ...parsed,
    enabled: false,
    audience: parsed.audience === 'group' ? 'group' : 'single',
    days_of_week: parsed.frequency === 'weekly' ? parsed.days_of_week : [],
    end_date: parsed.end_type === 'on_date' ? parsed.end_date : null,
    end_after_sessions:
      parsed.end_type === 'after' ? parsed.end_after_sessions : null,
    session_preset: EVENT_TYPE_SESSION_PRESET_OPTIONS[0],
    custom_session_count: null,
  };
}

function normalize_group_recurring_booking(
  parsed: event_type_recurrence
): event_type_recurrence {
  const custom_session_selected = parsed.session_preset == null;
  return {
    ...parsed,
    enabled: true,
    audience: 'single',
    frequency: parsed.allowed_frequency,
    days_of_week:
      parsed.allowed_frequency === 'weekly' ? parsed.days_of_week : [],
    end_date: parsed.end_type === 'on_date' ? parsed.end_date : null,
    end_after_sessions:
      parsed.end_type === 'after' ? parsed.end_after_sessions : null,
    session_preset: custom_session_selected ? null : parsed.session_preset,
    custom_session_count: custom_session_selected
      ? parsed.custom_session_count
      : null,
  };
}

export function resolve_event_type_recurrence_for_storage(
  value: unknown,
  format: event_type_format
): { ok: true; value: event_type_recurrence | null } | { ok: false; message: string } {
  const parsed = parse_event_type_recurrence(value);

  if (format === 'one_on_one') {
    return {
      ok: true,
      value: {
        ...parsed,
        enabled: false,
        audience: 'single',
      },
    };
  }

  if (format === 'recurring') {
    const schedule = validate_one_time_schedule(parsed);
    if (!schedule.ok) return schedule;
    return {
      ok: true,
      value: normalize_one_time_recurrence(parsed),
    };
  }

  if (!parsed.enabled) {
    return {
      ok: true,
      value: {
        ...parsed,
        enabled: false,
        audience: 'single',
      },
    };
  }

  const booking = validate_group_recurring_booking(parsed);
  if (!booking.ok) return booking;

  return {
    ok: true,
    value: normalize_group_recurring_booking(parsed),
  };
}
