import type { SupabaseClient } from '@supabase/supabase-js';
import type { plans, workspace_plan_snapshot, workspace_subscriptions } from './types';

const FREE_PLAN_SLUG = 'free';

export function rowToPlan(row: Record<string, unknown>): plans {
  return {
    id: Number(row.id),
    name: String(row.name),
    slug: String(row.slug),
    price: Number(row.price),
    booking_limit: Number(row.booking_limit),
    workspace_limit: Number(row.workspace_limit),
    admin_limit: Number(row.admin_limit),
    service_provider_limit: Number(row.service_provider_limit),
    extra_service_provider_seat_price: Number(row.extra_service_provider_seat_price ?? 0),
    google_calendar_sync: Boolean(row.google_calendar_sync),
    email_notifications: Boolean(row.email_notifications),
    public_booking_page: Boolean(row.public_booking_page),
    whatsapp_automation: Boolean(row.whatsapp_automation),
    online_payments: Boolean(row.online_payments),
    additional_locations: Boolean(row.additional_locations),
    is_active: Boolean(row.is_active),
    billing_interval: row.billing_interval != null ? String(row.billing_interval) : null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    display_order: Number(row.display_order ?? 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at ?? row.created_at),
  };
}

function rowToSubscription(row: Record<string, unknown>): workspace_subscriptions {
  return {
    id: Number(row.id),
    workspace_id: Number(row.workspace_id),
    plan_id: Number(row.plan_id),
    status: row.status as workspace_subscriptions['status'],
    started_at: String(row.started_at),
    expires_at: row.expires_at != null ? String(row.expires_at) : null,
    stripe_subscription_id:
      row.stripe_subscription_id != null ? String(row.stripe_subscription_id) : null,
    trial_ends_at: row.trial_ends_at != null ? String(row.trial_ends_at) : null,
    cancelled_at: row.cancelled_at != null ? String(row.cancelled_at) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getPlanBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<plans | null> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToPlan(data as Record<string, unknown>);
}

export async function getActiveWorkspaceSubscription(
  supabase: SupabaseClient,
  workspaceId: number
): Promise<workspace_plan_snapshot | null> {
  const { data: subRow, error: subError } = await supabase
    .from('workspace_subscriptions')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .maybeSingle();

  if (subError) throw new Error(subError.message);
  if (!subRow) return null;

  const subscription = rowToSubscription(subRow as Record<string, unknown>);
  const { data: planRow, error: planError } = await supabase
    .from('plans')
    .select('*')
    .eq('id', subscription.plan_id)
    .maybeSingle();

  if (planError) throw new Error(planError.message);
  if (!planRow) return null;

  return {
    subscription,
    plan: rowToPlan(planRow as Record<string, unknown>),
  };
}

export async function getWorkspacePlanSnapshot(
  supabase: SupabaseClient,
  workspaceId: number
): Promise<workspace_plan_snapshot> {
  const snapshot = await getActiveWorkspaceSubscription(supabase, workspaceId);
  if (snapshot) return snapshot;

  const freePlan = await getPlanBySlug(supabase, FREE_PLAN_SLUG);
  if (!freePlan) {
    throw new Error('Free plan is not configured');
  }

  return {
    plan: freePlan,
    subscription: {
      id: 0,
      workspace_id: workspaceId,
      plan_id: freePlan.id,
      status: 'active',
      started_at: new Date().toISOString(),
      expires_at: null,
      stripe_subscription_id: null,
      trial_ends_at: null,
      cancelled_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
}

export async function assignFreePlanToWorkspace(
  supabaseAdmin: SupabaseClient,
  workspaceId: number
): Promise<workspace_plan_snapshot> {
  const existing = await getActiveWorkspaceSubscription(supabaseAdmin, workspaceId);
  if (existing) return existing;

  const freePlan = await getPlanBySlug(supabaseAdmin, FREE_PLAN_SLUG);
  if (!freePlan) {
    throw new Error('Free plan is not configured');
  }

  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('workspace_subscriptions')
    .insert({
      workspace_id: workspaceId,
      plan_id: freePlan.id,
      status: 'active',
      started_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error) {
    if (error.code === '23505') {
      const retry = await getActiveWorkspaceSubscription(supabaseAdmin, workspaceId);
      if (retry) return retry;
    }
    throw new Error(error.message);
  }

  return {
    plan: freePlan,
    subscription: rowToSubscription(data as Record<string, unknown>),
  };
}

export async function listActivePlans(supabase: SupabaseClient): Promise<plans[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('price', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToPlan(row as Record<string, unknown>));
}
