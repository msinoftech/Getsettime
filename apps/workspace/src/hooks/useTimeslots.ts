import { useMemo } from 'react';
import type {
  AvailabilitySettings,
  Booking,
  EventType,
  Timeslot,
} from '@/src/types/bookingForm';
import type { date_exception } from '@/src/types/date_exceptions';
import {
  resolveEffectiveBookingDurationMinutes,
  type ServiceDurationCatalogItem,
} from '@/src/utils/bookingDuration';
import { getBrowserTimezone } from '@app/location';
import { buildTimeslotsForDay } from '@/src/utils/bookingTime';
import { step3PerfSync } from '@/src/utils/bookingStep3Perf';

export function useTimeslots(
  selectedType: EventType | null,
  selectedDate: Date | null,
  availabilitySettings: AvailabilitySettings | null,
  existingBookings: Booking[],
  minLeadTimeMinutes = 0,
  selectedServiceIds: string[] = [],
  serviceCatalog: ServiceDurationCatalogItem[] = [],
  providerTimezone?: string | null,
  viewerTimezone?: string | null,
  dateExceptions: date_exception[] = [],
  providerId?: string | null
): Timeslot[] {
  return useMemo(() => {
    if (!selectedType || !selectedDate) return [];
    const t0 = performance.now();
    const fallback = getBrowserTimezone();
    const providerTz = providerTimezone?.trim() || viewerTimezone?.trim() || fallback;
    const viewerTz = viewerTimezone?.trim() || providerTimezone?.trim() || fallback;
    const effectiveDuration = resolveEffectiveBookingDurationMinutes(
      selectedType,
      selectedServiceIds,
      serviceCatalog
    );
    const slots = buildTimeslotsForDay(
      selectedType,
      selectedDate,
      availabilitySettings,
      existingBookings,
      minLeadTimeMinutes,
      effectiveDuration,
      providerTz,
      viewerTz,
      dateExceptions,
      providerId
    );
    const enabled = slots.filter((s) => !s.disabled).length;
    step3PerfSync('useTimeslots build', t0, {
      date: selectedDate.toDateString(),
      totalSlots: slots.length,
      enabledSlots: enabled,
      existingBookings: existingBookings.length,
    });
    return slots;
  }, [
    selectedType,
    selectedDate,
    availabilitySettings,
    existingBookings,
    minLeadTimeMinutes,
    selectedServiceIds,
    serviceCatalog,
    providerTimezone,
    viewerTimezone,
    dateExceptions,
    providerId,
  ]);
}
