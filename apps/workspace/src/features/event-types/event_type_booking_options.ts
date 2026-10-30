export const EVENT_TYPE_MIN_BOOKING_NOTICE_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
}> = [
  { value: 0, label: 'No notice' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
  { value: 480, label: '8 hours' },
  { value: 1440, label: '1 day' },
  { value: 2880, label: '2 days' },
  { value: 10080, label: '1 week' },
];

export const EVENT_TYPE_MAX_BOOKING_WINDOW_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
}> = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: 60, label: '60 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '180 days' },
  { value: 365, label: '365 days' },
];

export function parse_boolean_flag(value: unknown, fallback: boolean): boolean {
  if (value === true) return true;
  if (value === false) return false;
  if (typeof value === 'string') {
    const t = value.trim().toLowerCase();
    if (t === 'true' || t === '1') return true;
    if (t === 'false' || t === '0') return false;
  }
  return fallback;
}

export function parse_min_booking_notice_minutes(
  value: unknown
): { ok: true; value: number } | { ok: false; message: string } {
  if (value === null || value === undefined || value === '') {
    return { ok: true, value: 120 };
  }
  const raw =
    typeof value === 'number' && Number.isFinite(value)
      ? String(Math.trunc(value))
      : String(value).trim();
  if (!/^\d+$/.test(raw)) {
    return {
      ok: false,
      message: 'Minimum booking notice must be a whole number of minutes.',
    };
  }
  return { ok: true, value: parseInt(raw, 10) };
}

export function parse_waitlist_capacity(
  value: unknown
): { ok: true; value: number | null } | { ok: false; message: string } {
  if (value === null || value === undefined || value === '') {
    return { ok: true, value: null };
  }
  const raw =
    typeof value === 'number' && Number.isFinite(value)
      ? String(Math.trunc(value))
      : String(value).trim();
  if (!raw) {
    return { ok: true, value: null };
  }
  if (!/^\d+$/.test(raw)) {
    return {
      ok: false,
      message: 'Waitlist capacity must be a whole number (0 or more).',
    };
  }
  return { ok: true, value: parseInt(raw, 10) };
}

export function parse_max_booking_window_days(
  value: unknown
): { ok: true; value: number } | { ok: false; message: string } {
  if (value === null || value === undefined || value === '') {
    return { ok: true, value: 30 };
  }
  const raw =
    typeof value === 'number' && Number.isFinite(value)
      ? String(Math.trunc(value))
      : String(value).trim();
  if (!/^\d+$/.test(raw)) {
    return {
      ok: false,
      message: 'Maximum booking window must be a whole number of days.',
    };
  }
  const n = parseInt(raw, 10);
  if (n < 1) {
    return {
      ok: false,
      message: 'Maximum booking window must be at least 1 day.',
    };
  }
  return { ok: true, value: n };
}

export function default_booking_options_form_fields() {
  return {
    allow_waitlist: true,
    waitlist_capacity: '',
    show_seats_remaining: true,
    min_booking_notice_minutes: '120',
    max_booking_window_days: '30',
    allow_reschedule: true,
    allow_cancellation: true,
  };
}
