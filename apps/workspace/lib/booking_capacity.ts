import {
  event_type_slot_capacity,
  is_group_event_type,
  type booking_event_type_flow_fields,
} from '@/src/features/booking-flow';
import { parse_event_type_recurrence } from '@/src/features/event-types/event_type_recurrence';

export type slot_occupancy_booking = {
  id?: string | number | null;
  start_at: string;
  end_at?: string | null;
  status?: string | null;
  service_provider_id?: string | null;
  event_type_id?: string | number | null;
  event_type_format?: string | null;
  capacity_per_slot?: number | null;
  recurrence_audience?: string | null;
  /** External calendar busy blocks the provider for any event type. */
  occupancy_source?: 'calendar' | 'booking';
};

export type slot_occupancy_context = {
  event_type_id: string | number;
  capacity: number;
  is_group: boolean;
};

const GROUP_SLOT_UNKNOWN_EVENT_TYPE_ID = '__group_slot__';

export function is_occupancy_status_active(status: string | null | undefined): boolean {
  const normalized = String(status ?? '').toLowerCase();
  return (
    normalized !== 'cancelled' &&
    normalized !== 'deleted' &&
    normalized !== 'emergency'
  );
}

export function ranges_overlap(
  start_a: Date,
  end_a: Date,
  start_b: Date,
  end_b: Date
): boolean {
  return start_a < end_b && end_a > start_b;
}

export function slot_occupancy_context_from_event_type(
  event_type:
    | (booking_event_type_flow_fields & {
        id?: string | number | null;
        event_type_id?: string | number | null;
      })
    | null
    | undefined
): slot_occupancy_context | null {
  if (!event_type) return null;
  const capacity = event_type_slot_capacity(event_type);
  const is_group = is_group_event_type(event_type) || capacity > 1;
  const resolved_id = event_type.id ?? event_type.event_type_id;

  if (!is_group) {
    if (resolved_id == null || resolved_id === '') return null;
    return { event_type_id: resolved_id, capacity, is_group: false };
  }

  return {
    event_type_id: resolved_id ?? GROUP_SLOT_UNKNOWN_EVENT_TYPE_ID,
    capacity,
    is_group: true,
  };
}

function resolve_group_occupancy_context(
  context: slot_occupancy_context | null | undefined,
  capacity: number
): slot_occupancy_context | null {
  if (context) return context;
  if (capacity <= 1) return null;
  return {
    event_type_id: GROUP_SLOT_UNKNOWN_EVENT_TYPE_ID,
    capacity,
    is_group: true,
  };
}

/** Whether an overlapping booking blocks a group session outright (not shared capacity). */
export function booking_is_exclusive_occupant(
  booking: slot_occupancy_booking,
  context: slot_occupancy_context | null | undefined
): boolean {
  if (!context?.is_group) return true;
  if (booking.occupancy_source === 'calendar') return true;
  if (booking.event_type_id == null || booking.event_type_id === '') return false;
  return String(booking.event_type_id) !== String(context.event_type_id);
}

export type slot_occupancy_result = {
  blocked: boolean;
  same_event_count: number;
};

function booking_time_range(booking: slot_occupancy_booking): {
  start: Date;
  end: Date;
} {
  const start = new Date(booking.start_at);
  const end = booking.end_at ? new Date(booking.end_at) : start;
  return { start, end };
}

/** Synced calendar holds often differ by seconds from the booking row. */
function occupancy_ranges_overlap(
  start_a: Date,
  end_a: Date,
  start_b: Date,
  end_b: Date
): boolean {
  if (ranges_overlap(start_a, end_a, start_b, end_b)) return true;
  const tolerance_ms = 5 * 60_000;
  return (
    Math.abs(start_a.getTime() - start_b.getTime()) < tolerance_ms ||
    Math.abs(end_a.getTime() - end_b.getTime()) < tolerance_ms
  );
}

function booking_conflicts_with_group_session(
  booking: slot_occupancy_booking,
  context: slot_occupancy_context
): boolean {
  if (booking.event_type_format === 'one_on_one') return true;
  if (context.event_type_id === GROUP_SLOT_UNKNOWN_EVENT_TYPE_ID) return false;
  if (booking.event_type_id == null || booking.event_type_id === '') return false;
  return String(booking.event_type_id) !== String(context.event_type_id);
}

function calendar_mirrors_booking(
  calendar: slot_occupancy_booking,
  bookings: slot_occupancy_booking[]
): boolean {
  const calendar_range = booking_time_range(calendar);
  return bookings.some((booking) => {
    if (booking.occupancy_source === 'calendar') return false;
    if (!is_occupancy_status_active(booking.status)) return false;
    const booking_range = booking_time_range(booking);
    return occupancy_ranges_overlap(
      calendar_range.start,
      calendar_range.end,
      booking_range.start,
      booking_range.end
    );
  });
}

export function evaluate_slot_occupancy(
  slot_start: Date,
  slot_end: Date,
  existing: slot_occupancy_booking[],
  context: slot_occupancy_context | null | undefined,
  capacity = 1
): slot_occupancy_result {
  let same_event_count = 0;
  const resolved_context = resolve_group_occupancy_context(
    context,
    Math.max(1, capacity)
  );
  const real_bookings = existing.filter(
    (booking) => booking.occupancy_source !== 'calendar'
  );
  const calendar_blocks = existing.filter(
    (booking) => booking.occupancy_source === 'calendar'
  );

  for (const booking of real_bookings) {
    if (!is_occupancy_status_active(booking.status)) continue;
    const { start: booking_start, end: booking_end } = booking_time_range(booking);
    if (!ranges_overlap(slot_start, slot_end, booking_start, booking_end)) continue;

    if (resolved_context?.is_group) {
      if (booking_conflicts_with_group_session(booking, resolved_context)) {
        return { blocked: true, same_event_count };
      }
      same_event_count += 1;
      continue;
    }

    if (booking_is_exclusive_occupant(booking, resolved_context)) {
      return { blocked: true, same_event_count };
    }

    same_event_count += 1;
  }

  if (resolved_context?.is_group) {
    return { blocked: false, same_event_count };
  }

  for (const booking of calendar_blocks) {
    if (!is_occupancy_status_active(booking.status)) continue;
    const { start: booking_start, end: booking_end } = booking_time_range(booking);
    if (!ranges_overlap(slot_start, slot_end, booking_start, booking_end)) continue;

    if (calendar_mirrors_booking(booking, real_bookings)) continue;

    return { blocked: true, same_event_count };
  }

  return { blocked: false, same_event_count };
}

export function is_time_range_at_capacity_for_event(
  slot_start: Date,
  slot_end: Date,
  existing: slot_occupancy_booking[],
  context: slot_occupancy_context | null | undefined,
  capacity = 1
): boolean {
  const effective_capacity = Math.max(1, capacity);
  const result = evaluate_slot_occupancy(
    slot_start,
    slot_end,
    existing,
    context,
    effective_capacity
  );
  if (result.blocked) return true;
  return result.same_event_count >= effective_capacity;
}

export function remaining_seats_for_event(
  slot_start: Date,
  slot_end: Date,
  existing: slot_occupancy_booking[],
  context: slot_occupancy_context | null | undefined,
  capacity = 1
): number {
  const effective_capacity = Math.max(1, capacity);
  const result = evaluate_slot_occupancy(
    slot_start,
    slot_end,
    existing,
    context,
    effective_capacity
  );
  if (result.blocked) return 0;
  return Math.max(0, effective_capacity - result.same_event_count);
}

/** @deprecated Use is_time_range_at_capacity_for_event with slot context. */
export function overlapping_booking_count(
  start_at: string,
  end_at: string,
  existing: slot_occupancy_booking[]
): number {
  const slot_start = new Date(start_at);
  const slot_end = new Date(end_at);
  let count = 0;
  for (const booking of existing) {
    if (!is_occupancy_status_active(booking.status)) continue;
    const booking_start = new Date(booking.start_at);
    const booking_end = booking.end_at ? new Date(booking.end_at) : booking_start;
    if (ranges_overlap(slot_start, slot_end, booking_start, booking_end)) {
      count += 1;
    }
  }
  return count;
}

/** @deprecated Use is_time_range_at_capacity_for_event with slot context. */
export function is_slot_at_capacity(
  start_at: string,
  end_at: string,
  existing: slot_occupancy_booking[],
  capacity: number
): boolean {
  return (
    overlapping_booking_count(start_at, end_at, existing) >= Math.max(1, capacity)
  );
}

/** @deprecated Use remaining_seats_for_event with slot context. */
export function remaining_seats(
  start_at: string,
  end_at: string,
  existing: slot_occupancy_booking[],
  capacity: number
): number {
  return Math.max(
    0,
    Math.max(1, capacity) - overlapping_booking_count(start_at, end_at, existing)
  );
}

export function flatten_embed_booking_row(
  row: Record<string, unknown>
): slot_occupancy_booking {
  const nested_event_types = row.event_types;
  const event_types = Array.isArray(nested_event_types)
    ? (nested_event_types[0] as Record<string, unknown> | undefined)
    : (nested_event_types as Record<string, unknown> | null | undefined);
  const recurrence = parse_event_type_recurrence(event_types?.recurrence);

  return {
    id: row.id as string | number | null | undefined,
    start_at: String(row.start_at ?? ''),
    end_at: (row.end_at as string | null | undefined) ?? null,
    status: (row.status as string | null | undefined) ?? null,
    event_type_id: row.event_type_id as string | number | null | undefined,
    service_provider_id:
      typeof row.service_provider_id === 'string'
        ? row.service_provider_id
        : row.service_provider_id != null
          ? String(row.service_provider_id)
          : null,
    occupancy_source: 'booking',
    event_type_format:
      (event_types?.event_type_format as string | null | undefined) ??
      (row.event_type_format as string | null | undefined) ??
      null,
    capacity_per_slot:
      (event_types?.capacity_per_slot as number | null | undefined) ??
      (row.capacity_per_slot as number | null | undefined) ??
      null,
    recurrence_audience: recurrence.audience,
  };
}

export function calendar_busy_without_booking_overlap<
  T extends { start_at: string; end_at: string }
>(bookings: slot_occupancy_booking[], calendar_busy: T[]): T[] {
  return calendar_busy.filter((busy) => {
    const busy_start = new Date(busy.start_at);
    const busy_end = new Date(busy.end_at);
    return !bookings.some((booking) => {
      if (booking.occupancy_source === 'calendar') return false;
      const { start: booking_start, end: booking_end } = booking_time_range(booking);
      return occupancy_ranges_overlap(
        busy_start,
        busy_end,
        booking_start,
        booking_end
      );
    });
  });
}
