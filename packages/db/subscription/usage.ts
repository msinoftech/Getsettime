import type { SupabaseClient } from '@supabase/supabase-js';
import { getWorkspacePlanSnapshot } from './plans';
import { countWorkspaceServiceProviders } from './service_provider_count';
import type { workspace_usage } from './types';

const BOOKING_USAGE_EXCLUDED_STATUSES = ['cancelled', 'deleted'] as const;
const BOOKING_WARNING_PERCENT = 80;

/** UTC month start for monthly booking counts. */
export function getUtcMonthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function countMonthlyBookings(
  supabase: SupabaseClient,
  workspaceId: number
): Promise<number> {
  const monthStart = getUtcMonthStartIso();
  let query = supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .gte('created_at', monthStart);

  for (const status of BOOKING_USAGE_EXCLUDED_STATUSES) {
    query = query.not('status', 'eq', status);
  }

  const { count, error } = await query;

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Stub until locations module exists. */
export async function countWorkspaceLocations(
  _supabase: SupabaseClient,
  _workspaceId: number
): Promise<number> {
  return 0;
}

export async function getWorkspaceUsage(
  supabaseAdmin: SupabaseClient,
  workspaceId: number
): Promise<workspace_usage> {
  const snapshot = await getWorkspacePlanSnapshot(supabaseAdmin, workspaceId);
  const booking_limit = snapshot.plan.booking_limit;

  const [bookings_this_month, service_provider_count, location_count] = await Promise.all([
    countMonthlyBookings(supabaseAdmin, workspaceId),
    countWorkspaceServiceProviders(supabaseAdmin, workspaceId),
    countWorkspaceLocations(supabaseAdmin, workspaceId),
  ]);

  const booking_percent_used =
    booking_limit > 0 ? Math.round((bookings_this_month / booking_limit) * 100) : 0;

  return {
    bookings_this_month,
    booking_limit,
    booking_percent_used,
    service_provider_count,
    service_provider_limit: snapshot.plan.service_provider_limit,
    location_count,
    booking_warning_threshold: booking_percent_used >= BOOKING_WARNING_PERCENT,
    booking_limit_reached: bookings_this_month >= booking_limit,
  };
}
