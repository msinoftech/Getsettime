/**
 * Centralized timezone management for booking forms and display.
 */
import { getBrowserTimezone as getBrowserTzFromLocation } from '@app/location';

const FALLBACK_TIMEZONE = 'UTC';

export function getBrowserTimezone(): string {
  return getBrowserTzFromLocation();
}

/**
 * @deprecated Use resolveProviderTimezone / resolveCustomerTimezone explicitly.
 */
export function getDisplayTimezone(workspaceTimezone?: string | null): string {
  const ws = workspaceTimezone?.trim();
  if (ws) return ws;
  return getBrowserTimezone();
}

/** Host/provider timezone: workspace setting or visitor mode via customer TZ. */
export function resolveProviderTimezone(
  workspaceTimezone: string | null | undefined,
  customerTimezone: string
): string {
  const ws = workspaceTimezone?.trim();
  if (ws) return ws;
  const customer = customerTimezone?.trim();
  if (customer) return customer;
  return FALLBACK_TIMEZONE;
}

/** Customer/viewer timezone: manual override → detected → browser → UTC. */
export function resolveCustomerTimezone(
  manualOverride?: string | null,
  detected?: string | null
): string {
  return manualOverride?.trim() || detected?.trim() || getBrowserTimezone() || FALLBACK_TIMEZONE;
}

export function needsTimezoneConversion(providerTz: string, customerTz: string): boolean {
  return providerTz.trim() !== customerTz.trim();
}

export function isWorkspaceTimezoneConfigured(workspaceTimezone?: string | null): boolean {
  return Boolean(workspaceTimezone?.trim());
}

/**
 * Parse time string like "4:00 PM" or "4:00 pm" to 24h { hour, minute }.
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
