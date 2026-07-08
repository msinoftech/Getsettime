/**
 * Timezone utilities for availability validation and slot conversion.
 */
import { TZDate } from '@date-fns/tz';

export interface LocalTimeParts {
  dayOfWeek: number; // 0=Sun, 1=Mon, ...
  dateStr: string; // YYYY-MM-DD
  hours: number;
  minutes: number;
  startMinutes: number; // hours * 60 + minutes
}

export function getLocalTimePartsInTimezone(
  isoString: string,
  timezone: string
): LocalTimeParts {
  const date = new Date(isoString);

  const dateFormatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = dateFormatter.formatToParts(date);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';

  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');
  const weekday = getPart('weekday');
  const hour = parseInt(getPart('hour'), 10) || 0;
  const minute = parseInt(getPart('minute'), 10) || 0;

  const dayOrder: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayOfWeek = dayOrder[weekday] ?? 0;
  const dateStr = `${year}-${month}-${day}`;
  const startMinutes = hour * 60 + minute;

  return { dayOfWeek, dateStr, hours: hour, minutes: minute, startMinutes };
}

/** Build UTC ISO from a calendar date + clock time in a specific IANA timezone. */
export function localDateTimeToUtcIso(
  dateStr: string,
  hour: number,
  minute: number,
  timezone: string
): string {
  const [y, m, d] = dateStr.split('-').map((x) => parseInt(x, 10));
  const zoned = new TZDate(y, m - 1, d, hour, minute, 0, 0, timezone);
  return zoned.toISOString();
}

/** Format UTC ISO instant for display in a timezone (12h with abbrev). */
export function formatUtcInTimezone(
  iso: string,
  timezone: string,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
    timeZone: timezone,
    ...options,
  };
  return date.toLocaleString('en-US', opts);
}

/** YYYY-MM-DD for an instant in a given timezone. */
export function getCalendarDateInTimezone(isoOrDate: string | Date, timezone: string): string {
  const iso = typeof isoOrDate === 'string' ? isoOrDate : isoOrDate.toISOString();
  return getLocalTimePartsInTimezone(iso, timezone).dateStr;
}

/** Display label for IANA timezone, e.g. "Asia/Kolkata (GMT+5:30)". */
export function format_timezone_display_label(timezone?: string | null): string {
  const tz = timezone?.trim();
  if (!tz) return 'Not set';
  try {
    const abbr = getTimezoneAbbreviation(tz);
    return abbr ? `${tz} (${abbr})` : tz;
  } catch {
    return tz;
  }
}

/** Short timezone label (e.g. IST, EST). */
export function getTimezoneAbbreviation(timezone: string, date?: Date): string {
  const d = date ?? new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    timeZoneName: 'short',
  }).formatToParts(d);
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? timezone;
}

/** Format calendar date only in a timezone (no time). */
export function formatDateOnlyInTimezone(iso: string, timezone: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: timezone,
  });
}

/** Format time only with timezone abbrev, e.g. "1:30 PM (GMT+10)". */
export function formatTimeOnlyInTimezone(iso: string, timezone: string): string {
  const date = new Date(iso);
  const time = date.toLocaleString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: timezone,
  });
  const abbrev = getTimezoneAbbreviation(timezone, date);
  return `${time} (${abbrev})`;
}

/** Full date+time for email/WhatsApp with timezone in parentheses, e.g. "... 02:00 PM (GMT+5:30)". */
export function formatNotificationDateTimeInTimezone(
  iso: string,
  timezone?: string | null
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const tz = timezone?.trim();
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  };
  if (!tz) {
    return date.toLocaleString('en-US', { ...opts, timeZoneName: 'short' });
  }
  const dateTime = date.toLocaleString('en-US', { ...opts, timeZone: tz });
  const abbrev = getTimezoneAbbreviation(tz, date);
  return `${dateTime} (${abbrev})`;
}

/** Format full date+time in timezone for confirmations. */
export function formatFullDateTimeInTimezone(iso: string, timezone: string): string {
  return formatNotificationDateTimeInTimezone(iso, timezone);
}
