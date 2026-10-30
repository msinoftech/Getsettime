import type { SupabaseClient } from '@supabase/supabase-js';

export type booking_insert_row = Record<string, unknown>;

function jsonb_bigint(value: unknown): number | null {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

export async function insert_booking_if_capacity(
  supabase: SupabaseClient,
  row: booking_insert_row,
  capacity: number
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; message: string }> {
  const { data, error } = await supabase.rpc('insert_booking_if_capacity', {
    p_row: {
      ...row,
      event_type_id: jsonb_bigint(row.event_type_id),
      department_id: jsonb_bigint(row.department_id),
      contact_id: jsonb_bigint(row.contact_id),
      payment_id: jsonb_bigint(row.payment_id),
      workspace_id: jsonb_bigint(row.workspace_id) ?? row.workspace_id,
    },
    p_capacity: Math.max(1, capacity),
  });

  if (error) {
    if (error.message.includes('BOOKING_SLOT_AT_CAPACITY')) {
      return {
        ok: false,
        message: 'This time slot is already booked. Please select another time.',
      };
    }
    return { ok: false, message: error.message };
  }

  if (!data || typeof data !== 'object') {
    return { ok: false, message: 'Failed to create booking.' };
  }

  return { ok: true, data: data as Record<string, unknown> };
}
