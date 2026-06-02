import type { SupabaseClient } from '@supabase/supabase-js';
import { PlanLimitError } from './errors';
import { getWorkspacePlanSnapshot } from './plans';
import { countMonthlyBookings } from './usage';
import type { plan_check_result, plan_feature_key, plans } from './types';

const FEATURE_COLUMN: Record<plan_feature_key, keyof plans> = {
  whatsapp_automation: 'whatsapp_automation',
  online_payments: 'online_payments',
  additional_locations: 'additional_locations',
  google_calendar_sync: 'google_calendar_sync',
  email_notifications: 'email_notifications',
  public_booking_page: 'public_booking_page',
};

export async function checkPlanFeature(
  supabase: SupabaseClient,
  workspaceId: number,
  feature: plan_feature_key
): Promise<plan_check_result> {
  const snapshot = await getWorkspacePlanSnapshot(supabase, workspaceId);
  const column = FEATURE_COLUMN[feature];
  const allowed = Boolean(snapshot.plan[column]);

  return {
    allowed,
    plan: snapshot.plan.slug,
    upgradeRequired: !allowed,
  };
}

export async function assertBookingAllowed(
  supabase: SupabaseClient,
  workspaceId: number
): Promise<void> {
  const snapshot = await getWorkspacePlanSnapshot(supabase, workspaceId);
  const count = await countMonthlyBookings(supabase, workspaceId);

  if (count >= snapshot.plan.booking_limit) {
    throw new PlanLimitError(
      `Monthly booking limit reached (${count} of ${snapshot.plan.booking_limit}). Upgrade your plan to continue accepting appointments.`,
      'PLAN_LIMIT',
      snapshot.plan.slug,
      true
    );
  }
}

export async function assertServiceProviderAllowed(
  supabaseAdmin: SupabaseClient,
  workspaceId: number,
  additionalProviders = 1
): Promise<void> {
  const snapshot = await getWorkspacePlanSnapshot(supabaseAdmin, workspaceId);
  const { countWorkspaceServiceProviders } = await import('./service_provider_count');
  const current = await countWorkspaceServiceProviders(supabaseAdmin, workspaceId);

  if (current + additionalProviders > snapshot.plan.service_provider_limit) {
    throw new PlanLimitError(
      `Service provider limit reached (${current} of ${snapshot.plan.service_provider_limit}). Upgrade your plan to add more providers.`,
      'PLAN_LIMIT',
      snapshot.plan.slug,
      true
    );
  }
}

export async function assertPlanFeatureAllowed(
  supabase: SupabaseClient,
  workspaceId: number,
  feature: plan_feature_key
): Promise<void> {
  const result = await checkPlanFeature(supabase, workspaceId, feature);
  if (!result.allowed) {
    throw new PlanLimitError(
      `This feature is available on paid plans.`,
      'FEATURE_GATED',
      result.plan,
      true
    );
  }
}
