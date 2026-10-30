import type { SupabaseClient } from '@supabase/supabase-js';
import { isUnlimitedBookingLimit } from './booking_limit';
import { getWorkspacePlanSnapshot } from './plans';
import { countWorkspaceAdminSeatsUsed } from './admin_count';
import { countWorkspaceServiceProviders } from './service_provider_count';
import type {
  booking_limit_period,
  booking_limit_remaining,
  workspace_plan_snapshot,
  workspace_usage,
} from './types';

const BOOKING_WARNING_PERCENT = 80;

/** UTC month start for monthly booking counts. */
export function getUtcMonthStartIso(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** All booking rows for workspace (includes cancelled/deleted). */
export async function countAllWorkspaceBookings(
  supabase: SupabaseClient,
  workspaceId: number
): Promise<number> {
  const { count, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/** Bookings created since UTC month start (includes cancelled/deleted). */
export async function countMonthlyBookings(
  supabase: SupabaseClient,
  workspaceId: number
): Promise<number> {
  const monthStart = getUtcMonthStartIso();
  const { count, error } = await supabase
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .gte('created_at', monthStart);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function countBookingsForPlanLimit(
  supabase: SupabaseClient,
  workspaceId: number,
  period: booking_limit_period
): Promise<number> {
  return period === 'lifetime'
    ? countAllWorkspaceBookings(supabase, workspaceId)
    : countMonthlyBookings(supabase, workspaceId);
}

/** Stub until locations module exists. */
export async function countWorkspaceLocations(
  _supabase: SupabaseClient,
  _workspaceId: number
): Promise<number> {
  return 0;
}

export async function getBookingLimitRemaining(
  supabase: SupabaseClient,
  workspaceId: number,
  snapshotOverride?: workspace_plan_snapshot
): Promise<booking_limit_remaining> {
  const snapshot =
    snapshotOverride ?? (await getWorkspacePlanSnapshot(supabase, workspaceId));
  const period = snapshot.plan.booking_limit_period;
  const limit = snapshot.plan.booking_limit;

  if (isUnlimitedBookingLimit(limit)) {
    return {
      unlimited: true,
      used: 0,
      limit,
      remaining: Number.MAX_SAFE_INTEGER,
      period,
    };
  }

  const used = await countBookingsForPlanLimit(supabase, workspaceId, period);
  return {
    unlimited: false,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    period,
  };
}

export function buildWorkspaceUsage(
  snapshot: workspace_plan_snapshot,
  counts: {
    bookings_used: number;
    service_provider_count: number;
    admin_count: number;
    location_count?: number;
  }
): workspace_usage {
  const booking_limit = snapshot.plan.booking_limit;
  const booking_limit_period = snapshot.plan.booking_limit_period;
  const unlimited_bookings = isUnlimitedBookingLimit(booking_limit);
  const { bookings_used, service_provider_count, admin_count } = counts;
  const location_count = counts.location_count ?? 0;

  const booking_percent_used = unlimited_bookings
    ? 0
    : booking_limit > 0
      ? Math.round((bookings_used / booking_limit) * 100)
      : 0;

  return {
    bookings_used,
    bookings_this_month: bookings_used,
    booking_limit,
    booking_limit_period,
    booking_percent_used,
    service_provider_count,
    service_provider_limit: snapshot.plan.service_provider_limit,
    admin_count,
    admin_limit: snapshot.plan.admin_limit,
    location_count,
    booking_warning_threshold:
      !unlimited_bookings && booking_percent_used >= BOOKING_WARNING_PERCENT,
    booking_limit_reached: !unlimited_bookings && bookings_used >= booking_limit,
  };
}

export async function getWorkspaceUsage(
  supabaseAdmin: SupabaseClient,
  workspaceId: number,
  snapshotOverride?: workspace_plan_snapshot
): Promise<workspace_usage> {
  const snapshot =
    snapshotOverride ?? (await getWorkspacePlanSnapshot(supabaseAdmin, workspaceId));
  const period = snapshot.plan.booking_limit_period;

  const [bookings_used, service_provider_count, admin_count, location_count] =
    await Promise.all([
      countBookingsForPlanLimit(supabaseAdmin, workspaceId, period),
      countWorkspaceServiceProviders(supabaseAdmin, workspaceId),
      countWorkspaceAdminSeatsUsed(supabaseAdmin, workspaceId),
      countWorkspaceLocations(supabaseAdmin, workspaceId),
    ]);

  return buildWorkspaceUsage(snapshot, {
    bookings_used,
    service_provider_count,
    admin_count,
    location_count,
  });
}
