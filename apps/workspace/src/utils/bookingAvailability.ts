import type { AvailabilitySettings, Booking, EventType, Timeslot } from '@/src/types/bookingForm';
import type { date_exception } from '@/src/types/date_exceptions';
import {
  resolveEffectiveBookingDurationMinutes,
  type ServiceDurationCatalogItem,
} from './bookingDuration';
import { hasBookableSlotForDay, normalizeDate } from './bookingTime';
import {
  build_offered_schedule_timeslots,
  event_type_min_notice_minutes,
  event_type_recurrence_of,
  event_type_session_duration_minutes,
  event_type_slot_capacity,
  is_date_within_event_type_booking_window,
  is_event_type_booking_open,
  scheduled_booking_window_days,
  uses_scheduled_event_type_slots,
} from '@/src/features/booking-flow';
import { getBrowserTimezone } from '@app/location';

function scheduled_day_has_visible_sessions(slots: Timeslot[], capacity: number): boolean {
  if (slots.length === 0) return false;
  if (capacity > 1) {
    return slots.some((slot) => slot.reason !== 'past');
  }
  return slots.some((slot) => !slot.disabled);
}

type date_availability_cache = {
  inputsKey: string;
  results: Map<string, boolean>;
};

let dateAvailabilityCache: date_availability_cache | null = null;

function buildAvailabilityInputsKey(
  availabilitySettings: AvailabilitySettings | null,
  selectedType: EventType | null,
  existingBookings: Booking[],
  minLeadTimeMinutes: number,
  effectiveDuration: number,
  providerTimezone?: string | null,
  viewerTimezone?: string | null,
  selectedServiceIds: string[] = [],
  dateExceptions: date_exception[] = [],
  providerId?: string | null
): string {
  const bookingSig = existingBookings
    .map(
      (b) =>
        `${b.id}:${b.start_at}:${b.end_at ?? ''}:${b.event_type_id ?? ''}:${b.occupancy_source ?? 'booking'}`
    )
    .join('|');
  const exceptionSig = dateExceptions
    .map(
      (e) =>
        `${e.id}:${e.exception_date}:${e.availability_type}:${e.start_time}:${e.end_time}:${e.provider_id}:${e.repeat_yearly}`
    )
    .join('|');
  return [
    selectedType?.id ?? '',
    effectiveDuration,
    minLeadTimeMinutes,
    providerTimezone ?? '',
    viewerTimezone ?? '',
    providerId ?? '',
    selectedServiceIds.join(','),
    bookingSig,
    exceptionSig,
    JSON.stringify(availabilitySettings?.timesheet ?? null),
    JSON.stringify(availabilitySettings?.individual ?? null),
  ].join('::');
}

function getCachedDateAvailability(
  dateStr: string,
  inputsKey: string,
  compute: () => boolean
): boolean {
  if (!dateAvailabilityCache || dateAvailabilityCache.inputsKey !== inputsKey) {
    dateAvailabilityCache = { inputsKey, results: new Map() };
  }
  const cached = dateAvailabilityCache.results.get(dateStr);
  if (cached !== undefined) return cached;
  const result = compute();
  dateAvailabilityCache.results.set(dateStr, result);
  return result;
}

/** Check if a date has at least one valid time slot (availability, not past, not booked, etc.) */
export function isDateAvailable(
  date: Date,
  availabilitySettings: AvailabilitySettings | null,
  selectedType: EventType | null,
  existingBookings: Booking[],
  minLeadTimeMinutes = 0,
  selectedServiceIds: string[] = [],
  serviceCatalog: ServiceDurationCatalogItem[] = [],
  providerTimezone?: string | null,
  viewerTimezone?: string | null,
  dateExceptions: date_exception[] = [],
  providerId?: string | null
): boolean {
  if (!selectedType) return false;
  if (!uses_scheduled_event_type_slots(selectedType) && !availabilitySettings?.timesheet) {
    return false;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const normalized = normalizeDate(date);
  if (normalized < today) return false;

  const fallback = getBrowserTimezone();
  const providerTz = providerTimezone?.trim() || viewerTimezone?.trim() || fallback;
  if (!is_event_type_booking_open(selectedType, providerTz)) {
    return false;
  }
  if (!is_date_within_event_type_booking_window(normalized, selectedType, providerTz)) {
    return false;
  }

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

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const inputsKey = buildAvailabilityInputsKey(
    availabilitySettings,
    selectedType,
    existingBookings,
    notice,
    effectiveDuration,
    providerTimezone,
    viewerTimezone,
    selectedServiceIds,
    dateExceptions,
    providerId
  );

  return getCachedDateAvailability(dateStr, inputsKey, () => {
    if (uses_scheduled_event_type_slots(selectedType)) {
      const viewerTz = viewerTimezone?.trim() || providerTimezone?.trim() || fallback;
      const slots = build_offered_schedule_timeslots({
        recurrence: event_type_recurrence_of(selectedType),
        timezone: providerTz,
        viewer_timezone: viewerTz,
        duration_minutes: effectiveDuration,
        selected_date: date,
        existing_bookings: existingBookings,
        capacity,
        event_type: selectedType,
        window_days: scheduled_booking_window_days(selectedType, providerTz),
        min_lead_time_minutes: notice,
      });
      return scheduled_day_has_visible_sessions(slots, capacity);
    }
    return hasBookableSlotForDay(
      selectedType,
      date,
      availabilitySettings,
      existingBookings,
      notice,
      effectiveDuration,
      providerTimezone,
      viewerTimezone,
      dateExceptions,
      providerId,
      capacity
    );
  });
}
