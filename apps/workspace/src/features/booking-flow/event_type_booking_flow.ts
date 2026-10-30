import { parse_event_type_availability_mode } from '@/src/features/event-types/event_type_availability';
import {
  parse_event_type_format,
  resolve_capacity_per_slot,
} from '@/src/features/event-types/event_type_format';
import { parse_event_type_recurrence } from '@/src/features/event-types/event_type_recurrence';
import type {
  event_type_availability_mode,
  event_type_format,
  event_type_recurrence,
} from '@/src/types/event_types';

export const BOOKING_EVENT_TYPE_PUBLIC_SELECT =
  'id, title, slug, duration_minutes, owner_id, is_public, location_type, status, department_id, service_provider_ids, event_type_format, capacity_per_slot, availability_mode, recurrence, allow_waitlist, waitlist_capacity, show_seats_remaining, min_booking_notice_minutes, max_booking_window_days';

export type booking_event_type_flow_fields = {
  event_type_format?: event_type_format | string | null;
  capacity_per_slot?: number | null;
  availability_mode?: event_type_availability_mode | string | null;
  recurrence?: event_type_recurrence | null;
  allow_waitlist?: boolean | null;
  waitlist_capacity?: number | null;
  show_seats_remaining?: boolean | null;
  min_booking_notice_minutes?: number | null;
  max_booking_window_days?: number | null;
  duration_minutes?: number | null;
};

export function event_type_format_of(
  event_type: booking_event_type_flow_fields | null | undefined
): event_type_format {
  return parse_event_type_format(event_type?.event_type_format);
}

export function event_type_recurrence_of(
  event_type: booking_event_type_flow_fields | null | undefined
): event_type_recurrence {
  return parse_event_type_recurrence(event_type?.recurrence);
}

export function event_type_slot_capacity(
  event_type: booking_event_type_flow_fields | null | undefined
): number {
  const format = event_type_format_of(event_type);
  const audience = event_type_recurrence_of(event_type).audience;
  const resolved = resolve_capacity_per_slot(
    format,
    event_type?.capacity_per_slot,
    audience
  );
  return resolved.ok ? resolved.value : 1;
}

export function event_type_min_notice_minutes(
  event_type: booking_event_type_flow_fields | null | undefined
): number {
  const raw = event_type?.min_booking_notice_minutes;
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0
    ? Math.trunc(raw)
    : 0;
}

export function event_type_max_window_days(
  event_type: booking_event_type_flow_fields | null | undefined
): number {
  const raw = event_type?.max_booking_window_days;
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 1
    ? Math.trunc(raw)
    : 30;
}

export function event_type_shows_seats_remaining(
  event_type: booking_event_type_flow_fields | null | undefined
): boolean {
  return event_type?.show_seats_remaining === true && event_type_slot_capacity(event_type) > 1;
}

export function is_one_time_event_type(
  event_type: booking_event_type_flow_fields | null | undefined
): boolean {
  return event_type_format_of(event_type) === 'recurring';
}

export function is_group_event_type(
  event_type: booking_event_type_flow_fields | null | undefined
): boolean {
  const format = event_type_format_of(event_type);
  if (format === 'group_class') return true;
  return format === 'recurring' && event_type_recurrence_of(event_type).audience === 'group';
}

/** One-on-one uses calendar busy; group/class capacity is enforced on booking rows only. */
export function should_block_booking_on_external_calendar(
  event_type: booking_event_type_flow_fields | null | undefined
): boolean {
  if (!event_type) return true;
  if (is_group_event_type(event_type)) return false;
  return event_type_slot_capacity(event_type) <= 1;
}

export function should_create_customer_series(
  event_type: booking_event_type_flow_fields | null | undefined
): boolean {
  const format = event_type_format_of(event_type);
  if (format === 'recurring') return true;
  return format === 'group_class' && event_type_recurrence_of(event_type).enabled;
}

/** Fixed session times from recurrence (One Time, or group/class custom schedule). */
export function uses_scheduled_event_type_slots(
  event_type: booking_event_type_flow_fields | null | undefined
): boolean {
  const format = event_type_format_of(event_type);
  if (format === 'recurring') return true;
  if (format !== 'group_class') return false;

  if (parse_event_type_availability_mode(event_type?.availability_mode) === 'custom') {
    return true;
  }

  return event_type_recurrence_of(event_type).enabled;
}

export function uses_offered_schedule_slots(
  event_type: booking_event_type_flow_fields | null | undefined
): boolean {
  return uses_scheduled_event_type_slots(event_type);
}

/**
 * Sessions published by an offered schedule have a fixed length, so selected
 * services must not stretch them; other formats keep the effective duration.
 */
export function event_type_session_duration_minutes(
  event_type: booking_event_type_flow_fields | null | undefined,
  effective_minutes: number
): number {
  if (!uses_scheduled_event_type_slots(event_type)) return effective_minutes;
  const raw = event_type?.duration_minutes;
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 1
    ? Math.trunc(raw)
    : effective_minutes;
}
