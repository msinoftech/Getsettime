import type { SupabaseClient } from '@supabase/supabase-js';
import { assertBookingAllowed, getBookingLimitRemaining, PlanLimitError } from '@app/db/subscription';
import type { event_type_recurrence } from '@/src/types/event_types';
import {
  OFFERED_SCHEDULE_MISMATCH_MESSAGE,
  expand_recurrence_occurrences,
  occurrence_start_matches,
  recurrence_schedule_end_at,
  rolling_occurrence_window_days,
} from '@/lib/booking_recurrence';
import { insert_booking_if_capacity } from '@/lib/insert_booking_if_capacity';
import { parse_event_type_recurrence } from '@/src/features/event-types/event_type_recurrence';
import {
  event_type_session_duration_minutes,
  event_type_slot_capacity,
  scheduled_booking_window_days,
  type booking_event_type_flow_fields,
} from '@/src/features/booking-flow';
import type { booking_occurrence_instant } from '@/lib/booking_recurrence';
import { getLocalTimePartsInTimezone } from '@/lib/date-timezone';

export type booking_series_row = {
  id: string;
  workspace_id: number | string;
  event_type_id: number | string | null;
  service_provider_id: string | null;
  department_id: number | string | null;
  contact_id: number | null;
  timezone: string | null;
  recurrence: event_type_recurrence;
  series_start_at: string;
  series_end_at: string | null;
  status: 'active' | 'cancelled';
  location: Record<string, unknown> | null;
};

export type create_booking_series_input = {
  workspace_id: number | string;
  event_type_id?: string | null;
  service_provider_id?: string | null;
  service_provider_name?: string | null;
  department_id?: number | string | null;
  host_user_id?: string | null;
  contact_id?: number | null;
  invitee_name: string;
  invitee_email?: string | null;
  invitee_phone?: string | null;
  timezone: string;
  recurrence: event_type_recurrence | null;
  series_start_at: string;
  series_end_at?: string | null;
  duration_minutes: number;
  max_booking_window_days?: number | null;
  capacity: number;
  status: string;
  location?: Record<string, unknown> | null;
  payment_id?: string | null;
  metadata?: Record<string, unknown> | null;
  customer_timezone?: string | null;
  provider_timezone?: string | null;
};

function json_row_value(value: unknown): string {
  if (value == null) return '';
  return String(value);
}

function numeric_id(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

async function load_series_event_type(
  supabase: SupabaseClient,
  series: Pick<booking_series_row, 'event_type_id' | 'workspace_id'>
): Promise<booking_event_type_flow_fields | null> {
  if (series.event_type_id == null || series.event_type_id === '') return null;
  const { data } = await supabase
    .from('event_types')
    .select(
      'duration_minutes, event_type_format, capacity_per_slot, recurrence, max_booking_window_days'
    )
    .eq('id', series.event_type_id)
    .eq('workspace_id', series.workspace_id)
    .maybeSingle();
  return (data as booking_event_type_flow_fields | null) ?? null;
}

function days_from_now(iso: string, now_iso: string): number {
  const ms = new Date(iso).getTime() - new Date(now_iso).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return Math.ceil(ms / 86_400_000);
}

function duration_minutes_from_range(start_at: string, end_at: string | null | undefined): number {
  if (!end_at) return 30;
  const minutes = Math.round(
    (new Date(end_at).getTime() - new Date(start_at).getTime()) / 60_000
  );
  return minutes >= 1 ? minutes : 30;
}

export async function load_booking_series(
  supabase: SupabaseClient,
  series_id: string,
  workspace_id: number | string
): Promise<booking_series_row | null> {
  const { data } = await supabase
    .from('booking_series')
    .select('*')
    .eq('id', series_id)
    .eq('workspace_id', workspace_id)
    .maybeSingle();
  return (data as booking_series_row | null) ?? null;
}

export async function modify_series_start_time(params: {
  supabase: SupabaseClient;
  series: booking_series_row;
  next_start_at: string;
  duration_minutes: number;
  capacity: number;
  max_booking_window_days?: number | null;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const timezone = params.series.timezone?.trim() || 'UTC';
  const parts = getLocalTimePartsInTimezone(params.next_start_at, timezone);
  const start_time = `${String(parts.hours).padStart(2, '0')}:${String(parts.minutes).padStart(2, '0')}`;
  const recurrence = {
    ...parse_event_type_recurrence(params.series.recurrence),
    start_time,
  };
  return update_series_future_occurrences({
    supabase: params.supabase,
    series: params.series,
    recurrence,
    timezone,
    duration_minutes: params.duration_minutes,
    capacity: params.capacity,
    max_booking_window_days: params.max_booking_window_days,
  });
}

const SLOT_AT_CAPACITY_MESSAGE =
  'This time slot is already booked. Please select another time.';

/** Every remaining session in the published schedule (anchor date does not trim the list). */
export function resolve_series_booking_occurrences(params: {
  recurrence: event_type_recurrence | null | undefined;
  timezone: string;
  duration_minutes: number;
  selected_start_at: string;
  max_booking_window_days?: number | null;
  now_iso?: string;
}):
  | { ok: true; occurrences: booking_occurrence_instant[]; schedule: booking_occurrence_instant[] }
  | { ok: false; message: string } {
  const recurrence = parse_event_type_recurrence(params.recurrence);
  const window_days = Math.max(
    rolling_occurrence_window_days(params.max_booking_window_days),
    scheduled_booking_window_days(
      { recurrence, max_booking_window_days: params.max_booking_window_days },
      params.timezone
    )
  );
  const schedule = expand_recurrence_occurrences({
    recurrence,
    timezone: params.timezone,
    duration_minutes: params.duration_minutes,
    window_days,
  });

  if (schedule.length === 0) {
    return { ok: false, message: 'No bookable occurrences in the selected series window.' };
  }

  const selected_is_scheduled = schedule.some((occurrence) =>
    occurrence_start_matches(occurrence.start_at, params.selected_start_at)
  );
  if (!selected_is_scheduled) {
    return { ok: false, message: OFFERED_SCHEDULE_MISMATCH_MESSAGE };
  }

  const now_ms = new Date(params.now_iso ?? new Date().toISOString()).getTime();
  const occurrences = schedule.filter(
    (occurrence) => new Date(occurrence.start_at).getTime() >= now_ms
  );

  if (occurrences.length === 0) {
    return { ok: false, message: 'No upcoming sessions remain in this series schedule.' };
  }

  return { ok: true, occurrences, schedule };
}

export async function create_booking_series_with_occurrences(
  supabase: SupabaseClient,
  input: create_booking_series_input
): Promise<
  | { ok: true; series: booking_series_row; bookings: Record<string, unknown>[] }
  | { ok: false; message: string }
> {
  const recurrence = parse_event_type_recurrence(input.recurrence);
  const resolved = resolve_series_booking_occurrences({
    recurrence,
    timezone: input.timezone,
    duration_minutes: input.duration_minutes,
    selected_start_at: input.series_start_at,
    max_booking_window_days: input.max_booking_window_days,
  });
  if (!resolved.ok) return resolved;
  const { occurrences, schedule } = resolved;

  const workspaceId = Number(input.workspace_id);
  if (!Number.isFinite(workspaceId) || workspaceId <= 0) {
    return { ok: false, message: 'Invalid workspace for booking series.' };
  }

  try {
    await assertBookingAllowed(supabase, workspaceId, occurrences.length);
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return { ok: false, message: err.message };
    }
    throw err;
  }

  const { data: series, error: series_error } = await supabase
    .from('booking_series')
    .insert({
      workspace_id: input.workspace_id,
      event_type_id: numeric_id(input.event_type_id),
      service_provider_id: input.service_provider_id ?? null,
      department_id: numeric_id(input.department_id),
      contact_id: numeric_id(input.contact_id),
      timezone: input.timezone,
      recurrence,
      series_start_at: schedule[0].start_at,
      // Full schedule end, not the rolling window end, so later extensions and
      // the UI agree on when the series finishes.
      series_end_at: recurrence_schedule_end_at({
        recurrence,
        timezone: input.timezone,
        duration_minutes: input.duration_minutes,
      }),
      status: 'active',
      location: input.location ?? null,
    })
    .select()
    .single();

  if (series_error || !series) {
    return { ok: false, message: series_error?.message || 'Failed to create booking series.' };
  }

  const created: Record<string, unknown>[] = [];
  for (const occurrence of occurrences) {
    const is_selected = occurrence_start_matches(
      occurrence.start_at,
      input.series_start_at
    );
    const inserted = await insert_booking_if_capacity(
      supabase,
      {
        workspace_id: input.workspace_id,
        event_type_id: numeric_id(input.event_type_id),
        service_provider_id: json_row_value(input.service_provider_id) || null,
        service_provider_name: json_row_value(input.service_provider_name) || null,
        department_id: numeric_id(input.department_id),
        host_user_id: json_row_value(input.host_user_id) || null,
        invitee_name: input.invitee_name,
        invitee_email: json_row_value(input.invitee_email) || null,
        invitee_phone: json_row_value(input.invitee_phone) || null,
        contact_id: numeric_id(input.contact_id),
        start_at: occurrence.start_at,
        end_at: occurrence.end_at,
        customer_timezone: json_row_value(input.customer_timezone) || null,
        provider_timezone: json_row_value(input.provider_timezone) || null,
        status: input.status,
        location: input.location ?? null,
        payment_id: input.payment_id ?? null,
        metadata: input.metadata ?? null,
        public_code: crypto.randomUUID(),
        series_id: series.id,
      },
      input.capacity
    );

    if (!inserted.ok) {
      if (!is_selected && inserted.message === SLOT_AT_CAPACITY_MESSAGE) {
        continue;
      }
      await supabase.from('bookings').update({ status: 'cancelled' }).eq('series_id', series.id);
      await supabase.from('booking_series').update({ status: 'cancelled' }).eq('id', series.id);
      return { ok: false, message: inserted.message };
    }
    created.push(inserted.data);
  }

  if (created.length === 0) {
    await supabase.from('booking_series').update({ status: 'cancelled' }).eq('id', series.id);
    return { ok: false, message: 'No bookable occurrences in the selected series window.' };
  }

  return { ok: true, series: series as booking_series_row, bookings: created };
}

export async function cancel_booking_series(
  supabase: SupabaseClient,
  series_id: string,
  workspace_id: number | string,
  now_iso = new Date().toISOString()
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error: series_error } = await supabase
    .from('booking_series')
    .update({ status: 'cancelled', updated_at: now_iso })
    .eq('id', series_id)
    .eq('workspace_id', workspace_id);

  if (series_error) {
    return { ok: false, message: series_error.message };
  }

  const { error: bookings_error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('series_id', series_id)
    .eq('workspace_id', workspace_id)
    .gt('start_at', now_iso)
    .neq('status', 'cancelled');

  if (bookings_error) {
    return { ok: false, message: bookings_error.message };
  }
  return { ok: true };
}

export async function cancel_series_occurrence(
  supabase: SupabaseClient,
  booking_id: string,
  workspace_id: number | string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', booking_id)
    .eq('workspace_id', workspace_id);
  if (error) return { ok: false, message: error.message };
  return { ok: true };
}

export async function update_series_future_occurrences(params: {
  supabase: SupabaseClient;
  series: booking_series_row;
  recurrence: event_type_recurrence;
  timezone: string;
  duration_minutes: number;
  capacity: number;
  max_booking_window_days?: number | null;
  now_iso?: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const now_iso = params.now_iso ?? new Date().toISOString();
  const { error: update_series_error } = await params.supabase
    .from('booking_series')
    .update({
      recurrence: params.recurrence,
      timezone: params.timezone,
      updated_at: now_iso,
    })
    .eq('id', params.series.id)
    .eq('workspace_id', params.series.workspace_id);

  if (update_series_error) {
    return { ok: false, message: update_series_error.message };
  }

  const { data: future_rows, error: future_error } = await params.supabase
    .from('bookings')
    .select('id, start_at, status')
    .eq('series_id', params.series.id)
    .eq('workspace_id', params.series.workspace_id)
    .gt('start_at', now_iso)
    .order('start_at', { ascending: true });

  if (future_error) {
    return { ok: false, message: future_error.message };
  }

  const expandable = (future_rows ?? []).filter((row) => row.status !== 'cancelled');
  const furthest_existing = expandable[expandable.length - 1]?.start_at;
  const next_occurrences = expand_recurrence_occurrences({
    recurrence: params.recurrence,
    timezone: params.timezone,
    duration_minutes: params.duration_minutes,
    series_start_at: now_iso,
    // Already-generated occurrences may sit beyond the booking window; keep them
    // in range so a reschedule moves them instead of cancelling them.
    window_days: Math.max(
      rolling_occurrence_window_days(params.max_booking_window_days),
      furthest_existing ? days_from_now(String(furthest_existing), now_iso) + 1 : 0
    ),
    from_date: now_iso.slice(0, 10),
  }).filter((occurrence) => occurrence.start_at > now_iso);

  const count = Math.min(expandable.length, next_occurrences.length);
  for (let i = 0; i < count; i += 1) {
    const { error } = await params.supabase
      .from('bookings')
      .update({
        start_at: next_occurrences[i].start_at,
        end_at: next_occurrences[i].end_at,
      })
      .eq('id', expandable[i].id);
    if (error) return { ok: false, message: error.message };
  }

  if (expandable.length > next_occurrences.length) {
    const extra_ids = expandable.slice(next_occurrences.length).map((row) => row.id);
    if (extra_ids.length > 0) {
      const { error } = await params.supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .in('id', extra_ids);
      if (error) return { ok: false, message: error.message };
    }
  }

  return { ok: true };
}

export async function extend_active_series_windows(
  supabase: SupabaseClient
): Promise<{ extended: number; errors: string[]; skipped_plan_limit: number }> {
  const { data: series_rows, error } = await supabase
    .from('booking_series')
    .select('*')
    .eq('status', 'active');

  if (error) {
    return { extended: 0, errors: [error.message], skipped_plan_limit: 0 };
  }

  let extended = 0;
  let skipped_plan_limit = 0;
  const errors: string[] = [];
  const now_iso = new Date().toISOString();
  const workspaceRemaining = new Map<number, number | 'unlimited'>();

  const loadRemaining = async (workspaceId: number): Promise<number | 'unlimited'> => {
    if (workspaceRemaining.has(workspaceId)) {
      return workspaceRemaining.get(workspaceId)!;
    }
    const info = await getBookingLimitRemaining(supabase, workspaceId);
    const value: number | 'unlimited' = info.unlimited ? 'unlimited' : info.remaining;
    workspaceRemaining.set(workspaceId, value);
    return value;
  };

  for (const series of series_rows ?? []) {
    const recurrence = parse_event_type_recurrence(series.recurrence);
    const timezone = typeof series.timezone === 'string' && series.timezone.trim()
      ? series.timezone
      : 'UTC';
    const { data: last_row } = await supabase
      .from('bookings')
      .select('id, start_at, end_at, invitee_name, invitee_email, invitee_phone, contact_id, event_type_id, service_provider_id, service_provider_name, department_id, host_user_id, customer_timezone, provider_timezone, status, location, metadata')
      .eq('series_id', series.id)
      .order('start_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const last_start = last_row?.start_at ? String(last_row.start_at) : series.series_start_at;
    const window_days = rolling_occurrence_window_days(90);
    const event_type = await load_series_event_type(supabase, series);
    const duration_minutes = event_type_session_duration_minutes(
      event_type,
      last_row?.start_at
        ? duration_minutes_from_range(
            String(last_row.start_at),
            last_row.end_at ? String(last_row.end_at) : null
          )
        : 30
    );
    const capacity = event_type ? event_type_slot_capacity(event_type) : 1;
    const next = expand_recurrence_occurrences({
      recurrence,
      timezone,
      duration_minutes,
      series_start_at: last_start,
      window_days,
      from_date: last_start.slice(0, 10),
    }).filter((occurrence) => occurrence.start_at > last_start && occurrence.start_at > now_iso);

    if (next.length === 0 || !last_row) continue;

    const workspaceId = Number(series.workspace_id);
    if (!Number.isFinite(workspaceId) || workspaceId <= 0) continue;

    let remaining = await loadRemaining(workspaceId);
    if (remaining !== 'unlimited' && remaining <= 0) {
      skipped_plan_limit += 1;
      continue;
    }

    const template = last_row as Record<string, unknown>;
    const maxInsert =
      remaining === 'unlimited' ? 12 : Math.min(12, remaining);

    for (const occurrence of next.slice(0, maxInsert)) {
      if (remaining !== 'unlimited' && remaining <= 0) break;

      const inserted = await insert_booking_if_capacity(
        supabase,
        {
          workspace_id: series.workspace_id,
          event_type_id: template.event_type_id,
          service_provider_id: template.service_provider_id,
          service_provider_name: template.service_provider_name,
          department_id: template.department_id,
          host_user_id: template.host_user_id,
          invitee_name: template.invitee_name,
          invitee_email: template.invitee_email,
          invitee_phone: template.invitee_phone,
          contact_id: template.contact_id,
          start_at: occurrence.start_at,
          end_at: occurrence.end_at,
          customer_timezone: template.customer_timezone,
          provider_timezone: template.provider_timezone,
          status: template.status === 'cancelled' ? 'pending' : template.status,
          location: template.location,
          metadata: template.metadata,
          public_code: crypto.randomUUID(),
          series_id: series.id,
        },
        capacity
      );
      if (inserted.ok) {
        extended += 1;
        if (remaining !== 'unlimited') {
          remaining -= 1;
          workspaceRemaining.set(workspaceId, remaining);
        }
      } else {
        errors.push(inserted.message);
      }
    }
  }

  return { extended, errors, skipped_plan_limit };
}
