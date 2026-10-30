import { parse_event_type_availability_mode } from '@/src/features/event-types/event_type_availability';
import { parse_event_type_format } from '@/src/features/event-types/event_type_format';
import { parse_event_type_recurrence } from '@/src/features/event-types/event_type_recurrence';
import type { EventType } from '@/src/types/bookingForm';

function optional_string(value: unknown): string | null | undefined {
  if (value == null) return value as null | undefined;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function optional_number(value: unknown): number | null | undefined {
  if (value == null) return value as null | undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function optional_boolean(value: unknown): boolean | null | undefined {
  if (value == null) return value as null | undefined;
  return Boolean(value);
}

/** Map an API / lookup event-type row into the booking-form EventType shape. */
export function map_event_type_for_booking_flow(row: unknown): EventType | null {
  if (!row || typeof row !== 'object') return null;
  const source = row as Record<string, unknown>;
  if (source.id == null || source.id === '') return null;

  const provider_ids = source.service_provider_ids;
  let service_provider_ids: string[] | null | undefined;
  if (Array.isArray(provider_ids)) {
    service_provider_ids = provider_ids
      .map((value) => String(value).trim())
      .filter(Boolean);
  } else if (provider_ids == null) {
    service_provider_ids = null;
  } else {
    service_provider_ids = [];
  }

  return {
    id: String(source.id),
    title:
      typeof source.title === 'string' && source.title.trim()
        ? source.title.trim()
        : 'Event',
    slug: optional_string(source.slug) ?? undefined,
    duration_minutes: optional_number(source.duration_minutes) ?? 30,
    owner_id: optional_string(source.owner_id),
    is_public: optional_boolean(source.is_public),
    location_type: optional_string(source.location_type),
    status:
      source.status === 'active' || source.status === 'draft'
        ? source.status
        : null,
    department_id:
      source.department_id == null || source.department_id === ''
        ? null
        : (typeof source.department_id === 'number' ||
            typeof source.department_id === 'string'
            ? source.department_id
            : String(source.department_id)),
    service_provider_ids,
    event_type_format: parse_event_type_format(source.event_type_format),
    capacity_per_slot: optional_number(source.capacity_per_slot),
    availability_mode: parse_event_type_availability_mode(source.availability_mode),
    recurrence: parse_event_type_recurrence(source.recurrence),
    allow_waitlist: optional_boolean(source.allow_waitlist),
    waitlist_capacity: optional_number(source.waitlist_capacity),
    show_seats_remaining: optional_boolean(source.show_seats_remaining),
    min_booking_notice_minutes: optional_number(source.min_booking_notice_minutes),
    max_booking_window_days: optional_number(source.max_booking_window_days),
  };
}

export function map_event_types_for_booking_flow(rows: unknown[]): EventType[] {
  return rows
    .map((row) => map_event_type_for_booking_flow(row))
    .filter((row): row is EventType => row != null);
}
