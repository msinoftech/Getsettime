import type { SupabaseClient } from '@supabase/supabase-js';
import { is_dynamic_booking_step_order_enabled } from '@app/config';
import {
  parse_booking_step_order,
  resolve_static_booking_step_order,
  type booking_step_id,
} from './booking_step';

export { parse_booking_step_order, resolve_static_booking_step_order };

export async function resolve_booking_step_order(params: {
  supabase: SupabaseClient;
  admin_professions_id?: number | null;
}): Promise<booking_step_id[]> {
  const fallback = resolve_static_booking_step_order();
  if (!is_dynamic_booking_step_order_enabled()) {
    return fallback;
  }

  const profession_id = params.admin_professions_id;
  if (profession_id == null || !Number.isFinite(profession_id) || profession_id <= 0) {
    return fallback;
  }

  const { data, error } = await params.supabase
    .from('professions_list')
    .select('booking_step_order')
    .eq('id', profession_id)
    .maybeSingle();

  if (error || !data) return fallback;
  return parse_booking_step_order(data.booking_step_order) ?? fallback;
}
