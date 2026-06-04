import type { SupabaseClient } from '@supabase/supabase-js';
import { formatBookingLimitFeature } from './booking_limit';
import type {
  plan_content,
  plan_content_context,
  plans,
  plans_with_content,
} from './types';
import { rowToPlan } from './plans';

function parseFeatures(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function rowToPlanContent(row: Record<string, unknown>): plan_content {
  return {
    id: Number(row.id),
    plan_id: Number(row.plan_id),
    context: row.context as plan_content_context,
    subtitle: row.subtitle != null ? String(row.subtitle) : null,
    features: parseFeatures(row.features),
    cta_label: row.cta_label != null ? String(row.cta_label) : null,
    cta_variant: row.cta_variant === 'dark' ? 'dark' : 'primary',
    badge_label: row.badge_label != null ? String(row.badge_label) : null,
    is_highlighted: Boolean(row.is_highlighted),
    display_order: Number(row.display_order ?? 0),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function pickContentForContext(
  rows: Record<string, unknown>[] | null | undefined,
  context: plan_content_context
): plan_content | null {
  if (!rows?.length) return null;
  const match =
    rows.find((row) => String(row.context) === context) ??
    rows[0];
  return match ? rowToPlanContent(match) : null;
}

function attachContent(
  planRow: Record<string, unknown>,
  context: plan_content_context
): plans_with_content {
  const nested = planRow.plan_content as Record<string, unknown>[] | null | undefined;
  const { plan_content: _nested, ...rest } = planRow;
  const plan = rowToPlan(rest);
  return {
    ...plan,
    content: pickContentForContext(nested, context),
  };
}

/** Read-only: active plans with optional marketing content for a surface. */
export async function listActivePlansWithContent(
  supabase: SupabaseClient,
  context: plan_content_context = 'upgrade_modal'
): Promise<plans_with_content[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*, plan_content(*)')
    .eq('is_active', true)
    .order('display_order', { ascending: true })
    .order('price', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) =>
    attachContent(row as Record<string, unknown>, context)
  );
}

/** Read-only: marketing content for one plan and surface. */
export async function getPlanContentForPlan(
  supabase: SupabaseClient,
  planId: number,
  context: plan_content_context = 'upgrade_modal'
): Promise<plan_content | null> {
  const { data, error } = await supabase
    .from('plan_content')
    .select('*')
    .eq('plan_id', planId)
    .eq('context', context)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToPlanContent(data as Record<string, unknown>);
}

export function planFeaturesFromEntitlements(plan: plans): string[] {
  const features = [
    formatBookingLimitFeature(plan.booking_limit),
    `${plan.admin_limit} admin`,
    `Up to ${plan.service_provider_limit} service providers`,
  ];
  if (plan.google_calendar_sync) features.push('Google Calendar sync');
  if (plan.email_notifications) features.push('Email notifications');
  if (plan.public_booking_page) features.push('Public booking page');
  if (plan.whatsapp_automation) features.push('WhatsApp automation');
  if (plan.online_payments) features.push('Online payments');
  if (plan.additional_locations) features.push('Multiple locations');
  return features;
}

export function resolvePlanFeatures(plan: plans_with_content): string[] {
  if (plan.content?.features?.length) {
    return plan.content.features;
  }
  return planFeaturesFromEntitlements(plan);
}
