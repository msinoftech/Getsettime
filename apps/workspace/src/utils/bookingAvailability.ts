import type { AvailabilitySettings, Booking, EventType } from '@/src/types/bookingForm';
import {
  buildTimeslotsForDay,
  formatLocalDateString,
  getDayName,
  normalizeDate,
  parseTimeToMinutes,
} from './bookingTime';

/** Check if a date has at least one valid time slot (availability, not past, not booked, etc.) */
export function isDateAvailable(
  date: Date,
  availabilitySettings: AvailabilitySettings | null,
  selectedType: EventType | null,
  existingBookings: Booking[],
  minLeadTimeMinutes = 0
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

  const slots = buildTimeslotsForDay(
    selectedType,
    date,
    availabilitySettings,
    existingBookings,
    minLeadTimeMinutes
  );
  return slots.some((s) => !s.disabled);
}
