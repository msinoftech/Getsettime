import type { BreakTime, Booking, DayName } from '@/src/types/bookingForm';
import { DAY_NAMES } from '@/src/constants/booking';
import { formatDateTimeForDisplay } from './timezone';

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
    const bookingEnd = new Date(booking.end_at);
    const bookingDate = normalizeDate(bookingStart);
    if (bookingDate.toDateString() !== normalizedSelectedDate.toDateString()) return false;
    return doTimeRangesOverlap(slotStart, slotEnd, bookingStart, bookingEnd);
  });
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
