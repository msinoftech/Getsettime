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
import {
  build_offered_schedule_timeslots,
  event_type_max_window_days,
  event_type_min_notice_minutes,
  event_type_recurrence_of,
  event_type_session_duration_minutes,
  event_type_slot_capacity,
  uses_offered_schedule_slots,
} from '@/src/features/booking-flow';

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
    const effectiveDuration = event_type_session_duration_minutes(
      selectedType,
      resolveEffectiveBookingDurationMinutes(
        selectedType,
        selectedServiceIds,
        serviceCatalog
      )
    );
    const notice = Math.max(
      minLeadTimeMinutes,
      event_type_min_notice_minutes(selectedType)
    );
    const capacity = event_type_slot_capacity(selectedType);
    const slots = uses_offered_schedule_slots(selectedType)
      ? build_offered_schedule_timeslots({
          recurrence: event_type_recurrence_of(selectedType),
          timezone: providerTz,
          viewer_timezone: viewerTz,
          duration_minutes: effectiveDuration,
          selected_date: selectedDate,
          existing_bookings: existingBookings,
          capacity,
          event_type: selectedType,
          window_days: event_type_max_window_days(selectedType),
          min_lead_time_minutes: notice,
        })
      : buildTimeslotsForDay(
          selectedType,
          selectedDate,
          availabilitySettings,
          existingBookings,
          notice,
          effectiveDuration,
          providerTz,
          viewerTz,
          dateExceptions,
          providerId,
          capacity
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
