import type { AvailabilitySettings, Booking, EventType } from '@/src/types/bookingForm';
import type { date_exception } from '@/src/types/date_exceptions';
import {
  resolveEffectiveBookingDurationMinutes,
  type ServiceDurationCatalogItem,
} from './bookingDuration';
import { hasBookableSlotForDay, normalizeDate } from './bookingTime';

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
    .map((b) => `${b.id}:${b.start_at}:${b.end_at ?? ''}`)
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
  if (!availabilitySettings?.timesheet || !selectedType) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const normalized = normalizeDate(date);
  if (normalized < today) return false;

  const effectiveDuration = resolveEffectiveBookingDurationMinutes(
    selectedType,
    selectedServiceIds,
    serviceCatalog
  );

  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const inputsKey = buildAvailabilityInputsKey(
    availabilitySettings,
    selectedType,
    existingBookings,
    minLeadTimeMinutes,
    effectiveDuration,
    providerTimezone,
    viewerTimezone,
    selectedServiceIds,
    dateExceptions,
    providerId
  );

  return getCachedDateAvailability(dateStr, inputsKey, () =>
    hasBookableSlotForDay(
      selectedType,
      date,
      availabilitySettings,
      existingBookings,
      minLeadTimeMinutes,
      effectiveDuration,
      providerTimezone,
      viewerTimezone,
      dateExceptions,
      providerId
    )
  );
}
