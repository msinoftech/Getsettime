/**
 * Centralized timezone management for booking forms and display.
 * Use getDisplayTimezone() to resolve: workspace timezone > browser timezone > UTC.
 */

const FALLBACK_TIMEZONE = 'UTC';

/** Get the browser's IANA timezone (e.g. Asia/Kolkata). Works on iOS, Android, and desktop. */
export function getBrowserTimezone(): string {
  if (typeof Intl === 'undefined') return FALLBACK_TIMEZONE;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return tz && tz.length > 0 ? tz : FALLBACK_TIMEZONE;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

/**
 * Get the timezone to use for display and API.
 * Order: workspace setting > browser timezone > UTC.
 */
export function getDisplayTimezone(workspaceTimezone?: string | null): string {
  const ws = workspaceTimezone?.trim();
  if (ws) return ws;
  return getBrowserTimezone();
}

/**
 * Parse time string like "4:00 PM" or "4:00 pm" to 24h { hour, minute }.
 * Locale-invariant: handles PM/pm/AM/am case-insensitively for reliable Android support.
 * Supports "4:00 PM" (space) and "4:00PM" (no space).
 */
export function parseTimeStringTo24h(timeStr: string): { hour: number; minute: number } | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const trimmed = timeStr.trim();
  const upper = trimmed.toUpperCase();
  const pmMatch = upper.match(/PM$/);
  const amMatch = upper.match(/AM$/);
  const periodPart = pmMatch ? 'PM' : amMatch ? 'AM' : null;
  const timePart = trimmed.replace(/\s*(AM|PM)$/i, '').trim();
  if (!periodPart || !timePart) return null;
  const [h, m] = timePart.split(':').map((x) => parseInt(x, 10));
  if (isNaN(h) || h < 0 || h > 12) return null;
  const minute = isNaN(m) ? 0 : Math.min(59, Math.max(0, m));
  let hour24 = h;
  if (periodPart === 'PM') {
    if (h !== 12) hour24 = h + 12;
  } else {
    if (h === 12) hour24 = 0;
  }
  return { hour: hour24, minute };
}

/**
 * Format a date + time string (e.g. "4:00 PM") for display in a given timezone.
 * Uses robust parsing to fix Android AM/PM case issues.
 */
export function formatDateTimeForDisplay(
  date: Date,
  timeString: string,
  timezone?: string | null
): string {
  const parsed = parseTimeStringTo24h(timeString);
  if (!parsed) return timeString;
  const d = new Date(date);
  d.setHours(parsed.hour, parsed.minute, 0, 0);
  const opts: Intl.DateTimeFormatOptions = {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  };
  if (timezone?.trim()) opts.timeZone = timezone.trim();
  return d.toLocaleString('en-US', opts);
}
