import type { date_exception } from '@/src/types/date_exceptions';

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Normalize HH:mm:ss or HH:mm to HH:mm for minute parsing. */
export function normalizeExceptionTime(time: string | null | undefined): string | null {
  if (!time) return null;
  const trimmed = time.trim();
  if (!trimmed) return null;
  const parts = trimmed.split(':');
  if (parts.length < 2) return null;
  const hours = parts[0].padStart(2, '0');
  const minutes = parts[1].padStart(2, '0');
  return `${hours}:${minutes}`;
}

function monthDay(dateStr: string): { month: string; day: string } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  return { month: dateStr.slice(5, 7), day: dateStr.slice(8, 10) };
}

/** Whether an exception row applies to the given calendar date string (YYYY-MM-DD). */
export function exceptionMatchesDate(
  exception: date_exception,
  providerDateStr: string
): boolean {
  if (exception.status !== 'active') return false;
  if (exception.exception_date === providerDateStr) return true;
  if (!exception.repeat_yearly) return false;
  const target = monthDay(providerDateStr);
  const source = monthDay(exception.exception_date);
  if (!target || !source) return false;
  return target.month === source.month && target.day === source.day;
}

/** Workspace-wide (null) or matching provider. */
export function exceptionAppliesToProvider(
  exception: date_exception,
  providerId: string | null | undefined
): boolean {
  if (!exception.provider_id) return true;
  if (!providerId) return false;
  return exception.provider_id === providerId;
}

export function filterApplicableExceptions(
  exceptions: date_exception[] | null | undefined,
  providerDateStr: string,
  providerId: string | null | undefined
): date_exception[] {
  if (!exceptions?.length) return [];
  return exceptions.filter(
    (ex) =>
      exceptionAppliesToProvider(ex, providerId) &&
      exceptionMatchesDate(ex, providerDateStr)
  );
}

export type minute_range = { startMinutes: number; endMinutes: number };

export type resolved_date_exception_effect =
  | { kind: 'closed' }
  | {
      kind: 'open';
      specialHours: minute_range | null;
      unavailableRanges: minute_range[];
    }
  | { kind: 'none' };

/**
 * Resolve overlapping exceptions for a provider date.
 * Precedence: closed > special_hours bounds + unavailable ranges.
 */
export function resolveExceptionEffectForDate(
  exceptions: date_exception[] | null | undefined,
  providerDateStr: string,
  providerId: string | null | undefined
): resolved_date_exception_effect {
  const matching = filterApplicableExceptions(exceptions, providerDateStr, providerId);
  if (matching.length === 0) return { kind: 'none' };

  if (matching.some((ex) => ex.availability_type === 'closed')) {
    return { kind: 'closed' };
  }

  const unavailableRanges: minute_range[] = [];
  for (const ex of matching) {
    if (ex.availability_type !== 'unavailable') continue;
    const start = normalizeExceptionTime(ex.start_time);
    const end = normalizeExceptionTime(ex.end_time);
    if (!start || !end) continue;
    unavailableRanges.push({
      startMinutes: parseTimeToMinutes(start),
      endMinutes: parseTimeToMinutes(end),
    });
  }

  let specialHours: minute_range | null = null;
  const special = matching.find((ex) => ex.availability_type === 'special_hours');
  if (special) {
    const start = normalizeExceptionTime(special.start_time);
    const end = normalizeExceptionTime(special.end_time);
    if (start && end) {
      specialHours = {
        startMinutes: parseTimeToMinutes(start),
        endMinutes: parseTimeToMinutes(end),
      };
    }
  }

  if (!specialHours && unavailableRanges.length === 0) {
    return { kind: 'none' };
  }

  return { kind: 'open', specialHours, unavailableRanges };
}

export function rangesOverlapMinutes(
  slotStart: number,
  slotEnd: number,
  ranges: minute_range[]
): boolean {
  return ranges.some(
    (range) => slotStart < range.endMinutes && slotEnd > range.startMinutes
  );
}

/**
 * True when the slot [slotStartMinutes, slotEndMinutes) is blocked by date exceptions
 * for the given provider calendar date.
 */
export function isSlotBlockedByException(
  exceptions: date_exception[] | null | undefined,
  providerDateStr: string,
  providerId: string | null | undefined,
  slotStartMinutes: number,
  slotEndMinutes: number
): boolean {
  const effect = resolveExceptionEffectForDate(exceptions, providerDateStr, providerId);
  if (effect.kind === 'none') return false;
  if (effect.kind === 'closed') return true;

  if (effect.specialHours) {
    if (
      slotStartMinutes < effect.specialHours.startMinutes ||
      slotEndMinutes > effect.specialHours.endMinutes
    ) {
      return true;
    }
  }

  if (effect.unavailableRanges.length > 0) {
    return rangesOverlapMinutes(
      slotStartMinutes,
      slotEndMinutes,
      effect.unavailableRanges
    );
  }

  return false;
}

/**
 * Apply special_hours / closed override to a day's start/end minutes.
 */
export function applyExceptionScheduleBounds(
  exceptions: date_exception[] | null | undefined,
  providerDateStr: string,
  providerId: string | null | undefined,
  timesheetStartMinutes: number,
  timesheetEndMinutes: number
): { closed: boolean; startMinutes: number; endMinutes: number } {
  const effect = resolveExceptionEffectForDate(exceptions, providerDateStr, providerId);
  if (effect.kind === 'closed') {
    return {
      closed: true,
      startMinutes: timesheetStartMinutes,
      endMinutes: timesheetEndMinutes,
    };
  }
  if (effect.kind === 'open' && effect.specialHours) {
    return {
      closed: false,
      startMinutes: effect.specialHours.startMinutes,
      endMinutes: effect.specialHours.endMinutes,
    };
  }
  return {
    closed: false,
    startMinutes: timesheetStartMinutes,
    endMinutes: timesheetEndMinutes,
  };
}

/**
 * Validate a booking UTC interval against date exceptions (server + client).
 */
export function isUtcBookingBlockedByException(
  exceptions: date_exception[] | null | undefined,
  startUtc: string,
  durationMinutes: number,
  providerTimezone: string,
  providerId: string | null | undefined,
  getLocalTimeParts: (
    utcIso: string,
    timezone: string
  ) => { dateStr: string; hours: number; minutes: number }
): boolean {
  if (!exceptions?.length) return false;
  const startParts = getLocalTimeParts(startUtc, providerTimezone);
  const endUtc = new Date(
    new Date(startUtc).getTime() + durationMinutes * 60_000
  ).toISOString();
  const endParts = getLocalTimeParts(endUtc, providerTimezone);
  const startMinutes = startParts.hours * 60 + startParts.minutes;
  let endMinutes = endParts.hours * 60 + endParts.minutes;
  if (endParts.dateStr !== startParts.dateStr) {
    endMinutes += 24 * 60;
  }
  return isSlotBlockedByException(
    exceptions,
    startParts.dateStr,
    providerId,
    startMinutes,
    endMinutes
  );
}
