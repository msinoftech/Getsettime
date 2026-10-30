import type { Timeslot } from '@/src/types/bookingForm';
import type { event_type_recurrence } from '@/src/types/event_types';
import {
  remaining_seats_for_event,
  slot_occupancy_context_from_event_type,
  type slot_occupancy_booking,
} from '@/lib/booking_capacity';
import { expand_recurrence_occurrences } from '@/lib/booking_recurrence';
import { formatUtcInTimezone } from '@/lib/date-timezone';
import {
  event_type_slot_capacity,
  scheduled_booking_window_days,
  type booking_event_type_flow_fields,
} from '@/src/features/booking-flow';

export function build_offered_schedule_timeslots(params: {
  recurrence: event_type_recurrence | null | undefined;
  timezone: string;
  viewer_timezone: string;
  duration_minutes: number;
  selected_date: Date;
  existing_bookings: slot_occupancy_booking[];
  capacity?: number;
  event_type?: booking_event_type_flow_fields & { id?: string | number | null };
  window_days?: number;
  min_lead_time_minutes?: number;
}): Timeslot[] {
  const y = params.selected_date.getFullYear();
  const m = String(params.selected_date.getMonth() + 1).padStart(2, '0');
  const d = String(params.selected_date.getDate()).padStart(2, '0');
  const date_str = `${y}-${m}-${d}`;
  const capacity = params.capacity ?? event_type_slot_capacity(params.event_type);
  const occupancy_context = slot_occupancy_context_from_event_type(params.event_type);
  const min_lead = params.min_lead_time_minutes ?? 0;
  const cutoff = Date.now() + min_lead * 60_000;

  const window_days =
    params.window_days ??
    scheduled_booking_window_days(params.event_type ?? {}, params.timezone);

  return expand_recurrence_occurrences({
    recurrence: params.recurrence,
    timezone: params.timezone,
    duration_minutes: params.duration_minutes,
    window_days,
    from_date: date_str,
  })
    .filter((occurrence) => occurrence.date === date_str)
    .map((occurrence) => {
      const slot_start = new Date(occurrence.start_at);
      const slot_end = new Date(occurrence.end_at);
      const remaining = remaining_seats_for_event(
        slot_start,
        slot_end,
        params.existing_bookings,
        occupancy_context,
        capacity
      );
      const past = new Date(occurrence.start_at).getTime() < cutoff;
      const full = remaining <= 0;
      return {
        time: formatUtcInTimezone(occurrence.start_at, params.viewer_timezone, {
          timeZoneName: undefined,
        }),
        startUtc: occurrence.start_at,
        disabled: past || full,
        reason: past ? 'past' : full ? 'booked' : undefined,
        ...(capacity > 1 ? { seatsRemaining: remaining } : {}),
      };
    });
}

export { event_type_slot_capacity };
