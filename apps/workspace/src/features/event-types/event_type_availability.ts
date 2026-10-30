import type { event_type_availability_mode } from '@/src/types/event_types';

export const EVENT_TYPE_AVAILABILITY_MODE_OPTIONS: ReadonlyArray<{
  value: event_type_availability_mode;
  label: string;
  description_template: 'provider' | 'custom';
}> = [
  {
    value: 'provider',
    label: "Use provider's regular availability",
    description_template: 'provider',
  },
  {
    value: 'custom',
    label: 'Custom availability for this event',
    description_template: 'custom',
  },
];

export const EVENT_TYPE_BUFFER_MINUTE_OPTIONS = [
  0, 5, 10, 15, 20, 30, 45, 60,
] as const;

export function parse_event_type_availability_mode(
  value: unknown
): event_type_availability_mode {
  return value === 'custom' ? 'custom' : 'provider';
}

const DATETIME_LOCAL_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

function pad_datetime_part(value: number): string {
  return String(value).padStart(2, '0');
}

export function datetime_local_from_date(date: Date): string {
  return `${date.getFullYear()}-${pad_datetime_part(date.getMonth() + 1)}-${pad_datetime_part(date.getDate())}T${pad_datetime_part(date.getHours())}:${pad_datetime_part(date.getMinutes())}`;
}

export function now_datetime_local(): string {
  return datetime_local_from_date(new Date());
}

export function parse_datetime_local_input(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (DATETIME_LOCAL_RE.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(trimmed)) {
    return trimmed.slice(0, 16);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return datetime_local_from_date(parsed);
}

export function date_part_from_datetime_local(value: string): string | null {
  const parsed = parse_datetime_local_input(value);
  return parsed ? parsed.slice(0, 10) : null;
}

export function datetime_local_to_ms(value: string): number | null {
  const parsed = parse_datetime_local_input(value);
  if (!parsed) return null;
  const ms = new Date(parsed).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function is_datetime_local_in_past(value: string, grace_ms = 60_000): boolean {
  const ms = datetime_local_to_ms(value);
  if (ms == null) return false;
  return ms < Date.now() - grace_ms;
}

export function format_datetime_local_label(value: string): string {
  const parsed = parse_datetime_local_input(value);
  if (!parsed) return '—';
  return format_datetime_local_display(parsed) || parsed;
}

export function parse_iso_date_input(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!ISO_DATE_RE.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  return trimmed;
}

export function iso_date_from_date(date: Date): string {
  return `${date.getFullYear()}-${pad_datetime_part(date.getMonth() + 1)}-${pad_datetime_part(date.getDate())}`;
}

/** Display format: `dd-mm-yyyy`. */
export function format_iso_date_display(value: string): string {
  const parsed = parse_iso_date_input(value);
  if (!parsed) return '';
  const [year, month, day] = parsed.split('-');
  return `${day}-${month}-${year}`;
}

export function format_iso_date_label(value: string): string {
  return format_iso_date_display(value) || '—';
}

/** Display format: `9 Sep 2026`. */
export function format_iso_date_long(value: string): string {
  const parsed = parse_iso_date_input(value);
  if (!parsed) return '';
  const date = new Date(`${parsed}T00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Display format: `dd-mm-yyyy hh:mm AM/PM`. */
export function format_datetime_local_display(value: string): string {
  const parsed = parse_datetime_local_input(value);
  if (!parsed) return '';
  const [date_part, time_part] = parsed.split('T');
  const [year, month, day] = date_part.split('-');
  return `${day}-${month}-${year} ${format_time_display(time_part)}`;
}

export function parse_time_input(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!TIME_RE.test(trimmed)) return null;
  const [hour_raw, minute_raw] = trimmed.split(':');
  const hour = parseInt(hour_raw, 10);
  const minute = parseInt(minute_raw, 10);
  if (
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return `${pad_datetime_part(hour)}:${pad_datetime_part(minute)}`;
}

export function time_from_parts(
  hour_12: number,
  minute: number,
  period: 'AM' | 'PM'
): string {
  let hour_24 = hour_12;
  if (period === 'AM') {
    hour_24 = hour_12 === 12 ? 0 : hour_12;
  } else {
    hour_24 = hour_12 === 12 ? 12 : hour_12 + 12;
  }
  return `${pad_datetime_part(hour_24)}:${pad_datetime_part(minute)}`;
}

export function format_time_display(value: string): string {
  const parsed = parse_time_input(value);
  if (!parsed) return '';
  const [hour_raw, minute] = parsed.split(':');
  const hour_24 = parseInt(hour_raw, 10);
  if (!Number.isFinite(hour_24)) return '';
  const period = hour_24 >= 12 ? 'PM' : 'AM';
  const hour_12 = hour_24 % 12 === 0 ? 12 : hour_24 % 12;
  return `${pad_datetime_part(hour_12)}:${minute} ${period}`;
}

export function datetime_local_from_date_and_time(
  date: string,
  time: string
): string {
  const parsed_date = parse_iso_date_input(date);
  const parsed_time = parse_time_input(time);
  if (!parsed_date || !parsed_time) return '';
  return `${parsed_date}T${parsed_time}`;
}

export function format_buffer_minutes_label(minutes: number): string {
  if (minutes <= 0) return '0 min';
  return `${minutes} min`;
}
