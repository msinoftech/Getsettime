import { useMemo } from 'react';
import type { AvailabilitySettings, Booking, EventType, Timeslot } from '@/src/types/bookingForm';
import { buildTimeslotsForDay } from '@/src/utils/bookingTime';

export function useTimeslots(
  selectedType: EventType | null,
  selectedDate: Date | null,
  availabilitySettings: AvailabilitySettings | null,
  existingBookings: Booking[],
  minLeadTimeMinutes = 0
): Timeslot[] {
  return useMemo(() => {
    if (!selectedType || !selectedDate) return [];
    return buildTimeslotsForDay(
      selectedType,
      selectedDate,
      availabilitySettings,
      existingBookings,
      minLeadTimeMinutes
    );
  }, [selectedType, selectedDate, availabilitySettings, existingBookings, minLeadTimeMinutes]);
}
