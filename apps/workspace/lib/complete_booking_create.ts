import type { SupabaseClient } from '@supabase/supabase-js';
import {
  event_type_max_window_days,
  event_type_slot_capacity,
  uses_offered_schedule_slots,
  type booking_event_type_flow_fields,
} from '@/src/features/booking-flow';
import { parse_event_type_recurrence } from '@/src/features/event-types/event_type_recurrence';
import { create_booking_series_with_occurrences } from '@/lib/booking_series_service';
import {
  OFFERED_SCHEDULE_MISMATCH_MESSAGE,
  find_scheduled_occurrence,
} from '@/lib/booking_recurrence';
import { insert_booking_if_capacity } from '@/lib/insert_booking_if_capacity';

export type loaded_event_type_for_booking = booking_event_type_flow_fields & {
  id: string | number;
  location_type?: string | null;
  status?: string | null;
  duration_minutes?: number | null;
};

export async function load_event_type_for_booking(
  supabase: SupabaseClient,
  workspace_id: string | number,
  event_type_id: string | null | undefined
): Promise<loaded_event_type_for_booking | null> {
  if (!event_type_id) return null;
  const { data } = await supabase
    .from('event_types')
    .select(
      'id, location_type, status, duration_minutes, event_type_format, capacity_per_slot, availability_mode, recurrence, allow_waitlist, waitlist_capacity, show_seats_remaining, min_booking_notice_minutes, max_booking_window_days'
    )
    .eq('id', event_type_id)
    .eq('workspace_id', workspace_id)
    .maybeSingle();
  return (data as loaded_event_type_for_booking | null) ?? null;
}

export async function insert_validated_booking(params: {
  supabase: SupabaseClient;
  event_type: loaded_event_type_for_booking | null;
  book_series?: boolean;
  timezone: string;
  duration_minutes: number;
  row: Record<string, unknown>;
}): Promise<
  | { ok: true; data: Record<string, unknown>; series_id?: string }
  | { ok: false; message: string }
> {
  const capacity = event_type_slot_capacity(params.event_type);
  const create_series = params.book_series === true;

  if (uses_offered_schedule_slots(params.event_type) && params.event_type) {
    const offered = find_scheduled_occurrence({
      recurrence: parse_event_type_recurrence(params.event_type.recurrence),
      timezone: params.timezone,
      duration_minutes: params.duration_minutes,
      start_at: String(params.row.start_at),
      window_days: event_type_max_window_days(params.event_type),
    });
    if (!offered) {
      return { ok: false, message: OFFERED_SCHEDULE_MISMATCH_MESSAGE };
    }
  }

  if (create_series && params.event_type) {
    const created = await create_booking_series_with_occurrences(params.supabase, {
      workspace_id: params.row.workspace_id as string | number,
      event_type_id: params.row.event_type_id ? String(params.row.event_type_id) : null,
      service_provider_id: params.row.service_provider_id
        ? String(params.row.service_provider_id)
        : null,
      service_provider_name: params.row.service_provider_name
        ? String(params.row.service_provider_name)
        : null,
      department_id: (params.row.department_id as string | number | null) ?? null,
      host_user_id: params.row.host_user_id ? String(params.row.host_user_id) : null,
      contact_id: (params.row.contact_id as number | null) ?? null,
      invitee_name: String(params.row.invitee_name ?? ''),
      invitee_email: params.row.invitee_email ? String(params.row.invitee_email) : null,
      invitee_phone: params.row.invitee_phone ? String(params.row.invitee_phone) : null,
      timezone: params.timezone,
      recurrence: parse_event_type_recurrence(params.event_type.recurrence),
      series_start_at: String(params.row.start_at),
      duration_minutes: params.duration_minutes,
      max_booking_window_days: event_type_max_window_days(params.event_type),
      capacity,
      status: String(params.row.status ?? 'pending'),
      location: (params.row.location as Record<string, unknown> | null) ?? null,
      payment_id:
        params.row.payment_id != null ? String(params.row.payment_id) : null,
      metadata: (params.row.metadata as Record<string, unknown> | null) ?? null,
      customer_timezone: params.row.customer_timezone
        ? String(params.row.customer_timezone)
        : null,
      provider_timezone: params.row.provider_timezone
        ? String(params.row.provider_timezone)
        : null,
    });
    if (!created.ok) return created;
    return {
      ok: true,
      data: created.bookings[0],
      series_id: created.series.id,
    };
  }

  return insert_booking_if_capacity(params.supabase, params.row, capacity);
}

export { uses_offered_schedule_slots };
