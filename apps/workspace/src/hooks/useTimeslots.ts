import { useMemo } from 'react';
import type {
  AvailabilitySettings,
  Booking,
  EventType,
  Timeslot,
} from '@/src/types/bookingForm';
import {
  resolveEffectiveBookingDurationMinutes,
  type ServiceDurationCatalogItem,
} from '@/src/utils/bookingDuration';
import { buildTimeslotsForDay } from '@/src/utils/bookingTime';

export function useTimeslots(
  selectedType: EventType | null,
  selectedDate: Date | null,
  availabilitySettings: AvailabilitySettings | null,
  existingBookings: Booking[],
  minLeadTimeMinutes = 0,
  selectedServiceIds: string[] = [],
  serviceCatalog: ServiceDurationCatalogItem[] = []
): Timeslot[] {
  return useMemo(() => {
    if (!selectedType || !selectedDate) return [];
    const effectiveDuration = resolveEffectiveBookingDurationMinutes(
      selectedType,
      selectedServiceIds,
      serviceCatalog
    );
    return buildTimeslotsForDay(
      selectedType,
      selectedDate,
      availabilitySettings,
      existingBookings,
      minLeadTimeMinutes,
      effectiveDuration
    );
  }, [
    selectedType,
    selectedDate,
    availabilitySettings,
    existingBookings,
    minLeadTimeMinutes,
    selectedServiceIds,
    serviceCatalog,
  ]);
}
