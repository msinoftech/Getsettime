import { useMemo } from 'react';
import type { AvailabilitySettings, Booking, EventType, Timeslot } from '@/src/types/bookingForm';
import {
  formatMinutesToDisplay,
  getDayName,
  getIndividualSlotKey,
  isTimeSlotBooked,
  isTimeSlotInPast,
  isTimeSlotOnBreak,
  normalizeDate,
  parseTimeToMinutes,
} from '@/src/utils/bookingTime';

export function useTimeslots(
  selectedType: EventType | null,
  selectedDate: Date | null,
  availabilitySettings: AvailabilitySettings | null,
  existingBookings: Booking[]
): Timeslot[] {
  return useMemo(() => {
    if (!selectedType || !selectedDate) return [];

    const duration = selectedType.duration_minutes || 30;
    const dayName = getDayName(selectedDate);
    const daySchedule = availabilitySettings?.timesheet?.[dayName];
    const slots: Timeslot[] = [];

    if (!daySchedule?.enabled) return [];

    const startMinutes = parseTimeToMinutes(daySchedule.startTime);
    const endMinutes = parseTimeToMinutes(daySchedule.endTime);
    const normalizedDate = normalizeDate(selectedDate);

    for (let slotStartMinutes = startMinutes; slotStartMinutes < endMinutes; slotStartMinutes += duration) {
      const slotEndMinutes = slotStartMinutes + duration;
      if (slotEndMinutes > endMinutes) break;

      if (isTimeSlotOnBreak(slotStartMinutes, slotEndMinutes, daySchedule.breaks || [])) {
        slots.push({ time: formatMinutesToDisplay(slotStartMinutes), disabled: true, reason: 'break' });
        continue;
      }

      const slotHour = Math.floor(slotStartMinutes / 60);
      const slotMinute = slotStartMinutes % 60;
      const slotStart = new Date(normalizedDate);
      slotStart.setHours(slotHour, slotMinute, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + duration);

      if (isTimeSlotBooked(slotStart, slotEnd, selectedDate, existingBookings)) {
        slots.push({ time: formatMinutesToDisplay(slotStartMinutes), disabled: true, reason: 'booked' });
        continue;
      }

      const slotEndHour = Math.floor(slotEndMinutes / 60);
      let isOverrideDisabled = false;
      for (let hour = slotHour; hour <= slotEndHour; hour++) {
        const individualKey = getIndividualSlotKey(normalizedDate, hour);
        if (availabilitySettings?.individual?.[individualKey] === false) {
          isOverrideDisabled = true;
          break;
        }
      }
      if (isOverrideDisabled) {
        slots.push({ time: formatMinutesToDisplay(slotStartMinutes), disabled: true, reason: 'unavailable' });
        continue;
      }

      if (isTimeSlotInPast(slotStart, selectedDate)) {
        slots.push({ time: formatMinutesToDisplay(slotStartMinutes), disabled: true, reason: 'past' });
        continue;
      }

      slots.push({ time: formatMinutesToDisplay(slotStartMinutes), disabled: false });
    }
    return slots;
  }, [selectedType, selectedDate, availabilitySettings, existingBookings]);
}
