import type {
  AvailabilitySettings,
  BreakTime,
  Booking,
  DayName,
  DaySchedule,
  EventType,
  Timeslot,
} from '@/src/types/bookingForm';
import { DAY_NAMES } from '@/src/constants/booking';
import {
  formatUtcInTimezone,
  getCalendarDateInTimezone,
  getLocalTimePartsInTimezone,
  localDateTimeToUtcIso,
} from '@/lib/date-timezone';
import { getBrowserTimezone } from '@app/location';
import { step3PerfLog } from '@/src/utils/bookingStep3Perf';
import { formatDateTimeForDisplay, needsTimezoneConversion } from './timezone';

/** Parse time string (HH:mm) to minutes since midnight */
export function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

/** Format minutes since midnight to display time (12h format). Uses en-US for consistent "4:00 PM" output across iOS/Android. */
export function formatMinutesToDisplay(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** Format date as YYYY-MM-DD in local timezone */
export function formatLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Individual slot key (matches availability page format): YYYY-MM-DD-HOUR */
export function getIndividualSlotKey(date: Date, hour: number): string {
  const dateStr = formatLocalDateString(date);
  return `${dateStr}-${hour}`;
}

/** Normalize date to midnight in local timezone */
export function normalizeDate(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/** Check if time slot overlaps with breaks */
export function isTimeSlotOnBreak(
  slotStartMinutes: number,
  slotEndMinutes: number,
  breaks: BreakTime[]
): boolean {
  return breaks.some((breakTime) => {
    const breakStart = parseTimeToMinutes(breakTime.start);
    const breakEnd = parseTimeToMinutes(breakTime.end);
    return slotStartMinutes < breakEnd && slotEndMinutes > breakStart;
  });
}

export function getDayName(date: Date): DayName {
  return DAY_NAMES[date.getDay()];
}

export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export function isTimeSlotInPast(slotStart: Date, checkDate: Date): boolean {
  if (!isToday(checkDate)) return false;
  return slotStart < new Date();
}

function doTimeRangesOverlap(
  range1Start: Date,
  range1End: Date,
  range2Start: Date,
  range2End: Date
): boolean {
  const r1Start = new Date(range1Start.getTime());
  const r1End = new Date(range1End.getTime());
  const r2Start = new Date(range2Start.getTime());
  const r2End = new Date(range2End.getTime());
  return r1Start < r2End && r1End > r2Start;
}

const DEFAULT_BOOKING_FALLBACK_MINUTES = 30;

/** Resolved booking end for overlap; handles missing/invalid end_at. */
export function resolveBookingEnd(booking: Booking): Date {
  const start = new Date(booking.start_at);
  const end = new Date(booking.end_at);
  if (Number.isNaN(end.getTime()) || end.getTime() <= start.getTime()) {
    const fallback = new Date(start);
    fallback.setMinutes(fallback.getMinutes() + DEFAULT_BOOKING_FALLBACK_MINUTES);
    return fallback;
  }
  return end;
}

/** Minutes from local midnight of `dayMidnight` to `instant` (may exceed 1440 if next day). */
function minutesFromDayMidnight(dayMidnight: Date, instant: Date): number {
  return Math.floor((instant.getTime() - dayMidnight.getTime()) / 60_000);
}

function maxOverlappingBreakEnd(
  slotStartMin: number,
  slotEndMin: number,
  breaks: BreakTime[]
): number {
  let maxEnd = slotStartMin + 1;
  for (const b of breaks) {
    const bs = parseTimeToMinutes(b.start);
    const be = parseTimeToMinutes(b.end);
    if (slotStartMin < be && slotEndMin > bs) {
      maxEnd = Math.max(maxEnd, be);
    }
  }
  return maxEnd;
}

function jumpPastBookingConflicts(
  t: number,
  duration: number,
  normalizedDate: Date,
  selectedDate: Date,
  existingBookings: Booking[],
  endMinutes: number
): number {
  const slotHour = Math.floor(t / 60);
  const slotMinute = t % 60;
  const slotStart = new Date(normalizedDate);
  slotStart.setHours(slotHour, slotMinute, 0, 0);
  const slotEnd = new Date(slotStart);
  slotEnd.setMinutes(slotEnd.getMinutes() + duration);

  const dayStr = normalizeDate(selectedDate).toDateString();
  let maxEndMin = t + 1;

  for (const booking of existingBookings) {
    const bookingStart = new Date(booking.start_at);
    if (normalizeDate(bookingStart).toDateString() !== dayStr) continue;
    const bookingEnd = resolveBookingEnd(booking);
    if (!doTimeRangesOverlap(slotStart, slotEnd, bookingStart, bookingEnd)) continue;
    const endMin = minutesFromDayMidnight(normalizedDate, bookingEnd);
    maxEndMin = Math.max(maxEndMin, endMin);
  }

  const nextT = Math.max(t + 1, maxEndMin);
  return Math.min(nextT, endMinutes);
}

export function isTimeSlotBooked(
  slotStart: Date,
  slotEnd: Date,
  selectedDate: Date,
  existingBookings: Booking[]
): boolean {
  if (existingBookings.length === 0) return false;
  const normalizedSelectedDate = normalizeDate(selectedDate);

  return existingBookings.some((booking) => {
    const bookingStart = new Date(booking.start_at);
    const bookingEnd = resolveBookingEnd(booking);
    const bookingDate = normalizeDate(bookingStart);
    if (bookingDate.toDateString() !== normalizedSelectedDate.toDateString()) return false;
    return doTimeRangesOverlap(slotStart, slotEnd, bookingStart, bookingEnd);
  });
}

/** Calendar YYYY-MM-DD from date picker cell (year/month/day components). */
export function getViewerDateString(selectedDate: Date): string {
  const y = selectedDate.getFullYear();
  const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
  const d = String(selectedDate.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map((x) => parseInt(x, 10));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return formatLocalDateString(dt);
}

function getDayNameFromDateStr(dateStr: string, timezone: string): DayName {
  const noonUtc = localDateTimeToUtcIso(dateStr, 12, 0, timezone);
  const parts = getLocalTimePartsInTimezone(noonUtc, timezone);
  return DAY_NAMES[parts.dayOfWeek];
}

function providerDatesForViewerDay(
  viewerDateStr: string,
  viewerTimezone: string,
  providerTimezone: string
): string[] {
  const dates = new Set<string>();
  const dayStartUtc = localDateTimeToUtcIso(viewerDateStr, 0, 0, viewerTimezone);
  const nextDay = addDaysToDateStr(viewerDateStr, 1);
  const dayEndUtc = localDateTimeToUtcIso(nextDay, 0, 0, viewerTimezone);
  let t = new Date(dayStartUtc).getTime();
  const end = new Date(dayEndUtc).getTime();
  while (t < end) {
    dates.add(getCalendarDateInTimezone(new Date(t).toISOString(), providerTimezone));
    t += 3_600_000;
  }
  dates.add(getCalendarDateInTimezone(dayStartUtc, providerTimezone));
  dates.add(getCalendarDateInTimezone(new Date(end - 1).toISOString(), providerTimezone));
  return Array.from(dates);
}

function isUtcSlotBooked(
  startUtc: string,
  durationMinutes: number,
  existingBookings: Booking[]
): boolean {
  const slotStart = new Date(startUtc);
  const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);
  return existingBookings.some((booking) => {
    const bookingStart = new Date(booking.start_at);
    const bookingEnd = resolveBookingEnd(booking);
    return doTimeRangesOverlap(slotStart, slotEnd, bookingStart, bookingEnd);
  });
}

function isIndividualOverrideDisabledUtc(
  startUtc: string,
  durationMinutes: number,
  providerTimezone: string,
  individual?: Record<string, boolean>
): boolean {
  if (!individual) return false;
  const startParts = getLocalTimePartsInTimezone(startUtc, providerTimezone);
  const endUtc = new Date(new Date(startUtc).getTime() + durationMinutes * 60_000).toISOString();
  const endParts = getLocalTimePartsInTimezone(endUtc, providerTimezone);
  const startHour = startParts.hours;
  const endHour = endParts.hours + (endParts.dateStr !== startParts.dateStr ? 24 : 0);
  for (let hour = startHour; hour <= endHour; hour++) {
    const h = hour % 24;
    const dateStr = hour >= 24 ? addDaysToDateStr(startParts.dateStr, 1) : startParts.dateStr;
    const key = `${dateStr}-${h}`;
    if (individual[key] === false) return true;
  }
  return false;
}

function isUtcSlotInPast(startUtc: string, minLeadTimeMinutes: number): boolean {
  const slotStart = new Date(startUtc);
  const now = new Date();
  if (minLeadTimeMinutes > 0) {
    const cutoff = new Date(now.getTime() + minLeadTimeMinutes * 60_000);
    return slotStart < cutoff;
  }
  return slotStart < now;
}

function buildSlotsForProviderDate(
  providerDateStr: string,
  daySchedule: DaySchedule,
  duration: number,
  availabilitySettings: AvailabilitySettings | null,
  existingBookings: Booking[],
  minLeadTimeMinutes: number,
  providerTimezone: string,
  viewerTimezone: string,
  viewerDateStr: string
): Timeslot[] {
  const startMinutes = parseTimeToMinutes(daySchedule.startTime);
  const endMinutes = parseTimeToMinutes(daySchedule.endTime);
  const breaks = daySchedule.breaks || [];
  const slots: Timeslot[] = [];
  const showHostTime = needsTimezoneConversion(providerTimezone, viewerTimezone);
  let t = startMinutes;

  while (t + duration <= endMinutes) {
    const slotEndMinutes = t + duration;
    const slotHour = Math.floor(t / 60);
    const slotMinute = t % 60;
    const startUtc = localDateTimeToUtcIso(
      providerDateStr,
      slotHour,
      slotMinute,
      providerTimezone
    );
    const viewerDay = getCalendarDateInTimezone(startUtc, viewerTimezone);
    if (viewerDay !== viewerDateStr) {
      if (viewerDay > viewerDateStr) {
        break;
      }
      t += Math.max(duration, 15);
      continue;
    }

    const label = formatUtcInTimezone(startUtc, viewerTimezone, { timeZoneName: undefined });
    const hostTime = showHostTime
      ? formatUtcInTimezone(startUtc, providerTimezone, { timeZoneName: undefined })
      : undefined;

    const makeSlot = (disabled: boolean, reason?: string): Timeslot => ({
      time: label,
      startUtc,
      ...(hostTime ? { hostTime } : {}),
      disabled,
      ...(reason ? { reason } : {}),
    });

    if (isTimeSlotOnBreak(t, slotEndMinutes, breaks)) {
      const jumpTo = maxOverlappingBreakEnd(t, slotEndMinutes, breaks);
      slots.push(makeSlot(true, 'break'));
      t = Math.min(Math.max(jumpTo, t + 1), endMinutes);
      continue;
    }

    if (isUtcSlotBooked(startUtc, duration, existingBookings)) {
      slots.push(makeSlot(true, 'booked'));
      t += 1;
      continue;
    }

    if (
      isIndividualOverrideDisabledUtc(
        startUtc,
        duration,
        providerTimezone,
        availabilitySettings?.individual
      )
    ) {
      slots.push(makeSlot(true, 'unavailable'));
      t = Math.min(Math.max((Math.floor(t / 60) + 1) * 60, t + 1), endMinutes);
      continue;
    }

    if (isUtcSlotInPast(startUtc, minLeadTimeMinutes)) {
      slots.push(makeSlot(true, 'past'));
      t += 1;
      continue;
    }

    slots.push(makeSlot(false));
    t += duration;
  }

  return slots;
}

/** True when at least one bookable slot exists (stops at first match). */
function hasBookableSlotForProviderDate(
  providerDateStr: string,
  daySchedule: DaySchedule,
  duration: number,
  availabilitySettings: AvailabilitySettings | null,
  existingBookings: Booking[],
  minLeadTimeMinutes: number,
  providerTimezone: string,
  viewerTimezone: string,
  viewerDateStr: string
): boolean {
  const startMinutes = parseTimeToMinutes(daySchedule.startTime);
  const endMinutes = parseTimeToMinutes(daySchedule.endTime);
  const breaks = daySchedule.breaks || [];
  let t = startMinutes;

  while (t + duration <= endMinutes) {
    const slotEndMinutes = t + duration;
    const slotHour = Math.floor(t / 60);
    const slotMinute = t % 60;
    const startUtc = localDateTimeToUtcIso(
      providerDateStr,
      slotHour,
      slotMinute,
      providerTimezone
    );
    const viewerDay = getCalendarDateInTimezone(startUtc, viewerTimezone);
    if (viewerDay !== viewerDateStr) {
      if (viewerDay > viewerDateStr) {
        break;
      }
      t += Math.max(duration, 15);
      continue;
    }

    if (isTimeSlotOnBreak(t, slotEndMinutes, breaks)) {
      const jumpTo = maxOverlappingBreakEnd(t, slotEndMinutes, breaks);
      t = Math.min(Math.max(jumpTo, t + 1), endMinutes);
      continue;
    }

    if (isUtcSlotBooked(startUtc, duration, existingBookings)) {
      t += duration;
      continue;
    }

    if (
      isIndividualOverrideDisabledUtc(
        startUtc,
        duration,
        providerTimezone,
        availabilitySettings?.individual
      )
    ) {
      t = Math.min(Math.max((Math.floor(t / 60) + 1) * 60, t + 1), endMinutes);
      continue;
    }

    if (isUtcSlotInPast(startUtc, minLeadTimeMinutes)) {
      t += duration;
      continue;
    }

    return true;
  }

  return false;
}

/**
 * Fast check: any bookable slot on this viewer calendar day (no label formatting).
 */
export function hasBookableSlotForDay(
  selectedType: EventType,
  selectedDate: Date,
  availabilitySettings: AvailabilitySettings | null,
  existingBookings: Booking[],
  minLeadTimeMinutes = 0,
  slotDurationMinutes?: number,
  providerTimezone?: string,
  viewerTimezone?: string
): boolean {
  const duration =
    typeof slotDurationMinutes === 'number' &&
    Number.isFinite(slotDurationMinutes) &&
    slotDurationMinutes >= 1
      ? Math.trunc(slotDurationMinutes)
      : selectedType.duration_minutes || 30;

  const fallbackTz = getBrowserTimezone();
  const providerTz = providerTimezone?.trim() || viewerTimezone?.trim() || fallbackTz;
  const viewerTz = viewerTimezone?.trim() || providerTimezone?.trim() || fallbackTz;
  if (!availabilitySettings?.timesheet) return false;

  const viewerDateStr = getViewerDateString(selectedDate);
  const providerDates = providerDatesForViewerDay(viewerDateStr, viewerTz, providerTz);

  for (const providerDateStr of providerDates) {
    const dayName = getDayNameFromDateStr(providerDateStr, providerTz);
    const daySchedule = availabilitySettings.timesheet[dayName];
    if (!daySchedule?.enabled) continue;
    if (
      hasBookableSlotForProviderDate(
        providerDateStr,
        daySchedule,
        duration,
        availabilitySettings,
        existingBookings,
        minLeadTimeMinutes,
        providerTz,
        viewerTz,
        viewerDateStr
      )
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Timezone-aware slot list. Host availability is in providerTimezone; labels in viewerTimezone.
 */
export function buildTimeslotsForDay(
  selectedType: EventType,
  selectedDate: Date,
  availabilitySettings: AvailabilitySettings | null,
  existingBookings: Booking[],
  minLeadTimeMinutes = 0,
  slotDurationMinutes?: number,
  providerTimezone?: string,
  viewerTimezone?: string
): Timeslot[] {
  const buildT0 = performance.now();
  const duration =
    typeof slotDurationMinutes === 'number' &&
    Number.isFinite(slotDurationMinutes) &&
    slotDurationMinutes >= 1
      ? Math.trunc(slotDurationMinutes)
      : selectedType.duration_minutes || 30;

  const fallbackTz = getBrowserTimezone();
  const providerTz = providerTimezone?.trim() || viewerTimezone?.trim() || fallbackTz;
  const viewerTz = viewerTimezone?.trim() || providerTimezone?.trim() || fallbackTz;
  if (!availabilitySettings?.timesheet) return [];

  const viewerDateStr = getViewerDateString(selectedDate);
  const providerDates = providerDatesForViewerDay(viewerDateStr, viewerTz, providerTz);

  const allSlots: Timeslot[] = [];
  for (const providerDateStr of providerDates) {
    const dayName = getDayNameFromDateStr(providerDateStr, providerTz);
    const daySchedule = availabilitySettings.timesheet[dayName];
    if (!daySchedule?.enabled) continue;
    allSlots.push(
      ...buildSlotsForProviderDate(
        providerDateStr,
        daySchedule,
        duration,
        availabilitySettings,
        existingBookings,
        minLeadTimeMinutes,
        providerTz,
        viewerTz,
        viewerDateStr
      )
    );
  }

  allSlots.sort(
    (a, b) => new Date(a.startUtc).getTime() - new Date(b.startUtc).getTime()
  );

  const seen = new Set<string>();
  const result = allSlots.filter((s) => {
    if (seen.has(s.startUtc)) return false;
    seen.add(s.startUtc);
    return true;
  });
  const buildMs = performance.now() - buildT0;
  if (buildMs > 30) {
    step3PerfLog('buildTimeslotsForDay slow', {
      ms: `${buildMs.toFixed(1)}ms`,
      date: viewerDateStr,
      totalSlots: result.length,
      existingBookings: existingBookings.length,
    });
  }
  return result;
}

export function formatDateWithTimezone(date: Date): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** Format date+time for display. Android-safe parsing; accepts optional timezone for workspace override. */
export function formatTimeWithTimezone(
  date: Date,
  timeString: string,
  timezone?: string | null
): string {
  return formatDateTimeForDisplay(date, timeString, timezone);
}

/** Get calendar days for a month (including prev/next month padding for 6-week grid) */
export function getCalendarDays(date: Date): Date[] {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startingDayOfWeek = firstDay.getDay();
  const days: Date[] = [];
  const prevMonth = new Date(year, month, 0);
  const daysInPrevMonth = prevMonth.getDate();
  for (let i = startingDayOfWeek - 1; i >= 0; i--) {
    days.push(new Date(year, month - 1, daysInPrevMonth - i));
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }
  const remainingDays = 42 - days.length;
  for (let i = 1; i <= remainingDays; i++) {
    days.push(new Date(year, month + 1, i));
  }
  return days;
}
