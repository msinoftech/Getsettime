import type { AvailabilitySettings, Booking, EventType } from '@/src/types/bookingForm';
import {
  formatLocalDateString,
  getDayName,
  getIndividualSlotKey,
  isTimeSlotBooked,
  isTimeSlotInPast,
  isTimeSlotOnBreak,
  normalizeDate,
  parseTimeToMinutes,
} from './bookingTime';

/** Check if a date has at least one valid time slot (availability, not past, not booked, etc.) */
export function isDateAvailable(
  date: Date,
  availabilitySettings: AvailabilitySettings | null,
  selectedType: EventType | null,
  existingBookings: Booking[]
): boolean {
  if (!availabilitySettings?.timesheet || !selectedType) return false;

  const dayName = getDayName(date);
  const daySchedule = availabilitySettings.timesheet[dayName];
  if (!daySchedule?.enabled) return false;
  if (date < new Date()) {
    const today = new Date();
    if (
      date.getDate() !== today.getDate() ||
      date.getMonth() !== today.getMonth() ||
      date.getFullYear() !== today.getFullYear()
    ) {
      return false;
    }
  }

  if (availabilitySettings.individual) {
    const normalizedDate = normalizeDate(date);
    const dateStrCheck = formatLocalDateString(normalizedDate);
    const startMinutes = parseTimeToMinutes(daySchedule.startTime);
    const endMinutes = parseTimeToMinutes(daySchedule.endTime);
    const startHour = Math.floor(startMinutes / 60);
    const endHour = Math.ceil(endMinutes / 60);
    let allHoursDisabled = true;
    for (let hour = startHour; hour < endHour; hour++) {
      const individualKey = `${dateStrCheck}-${hour}`;
      const individualOverride = availabilitySettings.individual[individualKey];
      if (individualOverride !== false) {
        allHoursDisabled = false;
        break;
      }
    }
    if (allHoursDisabled) return false;
  }

  const duration = selectedType.duration_minutes || 30;
  const startMinutes = parseTimeToMinutes(daySchedule.startTime);
  const endMinutes = parseTimeToMinutes(daySchedule.endTime);
  const normalizedDate = normalizeDate(date);

  for (let slotStartMinutes = startMinutes; slotStartMinutes < endMinutes; slotStartMinutes += duration) {
    const slotEndMinutes = slotStartMinutes + duration;
    if (slotEndMinutes > endMinutes) break;
    if (isTimeSlotOnBreak(slotStartMinutes, slotEndMinutes, daySchedule.breaks || [])) continue;

    const slotHour = Math.floor(slotStartMinutes / 60);
    const slotMinute = slotStartMinutes % 60;
    const slotStart = new Date(normalizedDate);
    slotStart.setHours(slotHour, slotMinute, 0, 0);
    const slotEnd = new Date(slotStart);
    slotEnd.setMinutes(slotEnd.getMinutes() + duration);

    if (isTimeSlotBooked(slotStart, slotEnd, date, existingBookings)) continue;

    const slotEndHour = Math.floor(slotEndMinutes / 60);
    let isOverrideDisabled = false;
    for (let hour = slotHour; hour <= slotEndHour; hour++) {
      const individualKey = getIndividualSlotKey(normalizedDate, hour);
      const individualOverride = availabilitySettings?.individual?.[individualKey];
      if (individualOverride === false) {
        isOverrideDisabled = true;
        break;
      }
    }
    if (isOverrideDisabled) continue;
    if (isTimeSlotInPast(slotStart, date)) continue;
    return true;
  }
  return false;
}
