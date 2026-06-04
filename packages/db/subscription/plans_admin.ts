import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  plan_content,
  plan_content_context,
  plan_content_input,
  plan_input,
  plans,
  plans_with_content,
} from './types';
import { rowToPlan } from './plans';
import { rowToPlanContent } from './plan_content';

const DEFAULT_CONTENT_CONTEXT: plan_content_context = 'upgrade_modal';

function pickContentForContext(
  rows: Record<string, unknown>[] | null | undefined,
  context: plan_content_context
) {
  if (!rows?.length) return null;
  const match =
    rows.find((row) => String(row.context) === context) ??
    rows[0];
  return match ? rowToPlanContent(match) : null;
}

function attachContent(
  planRow: Record<string, unknown>,
  context: plan_content_context = DEFAULT_CONTENT_CONTEXT
): plans_with_content {
  const nested = planRow.plan_content as Record<string, unknown>[] | null | undefined;
  const { plan_content: _nested, ...rest } = planRow;
  const plan = rowToPlan(rest);
  return {
    ...plan,
    content: pickContentForContext(nested, context),
  };
}

function normalizeFeatures(features: string[] | undefined): string[] {
  if (!features) return [];
  return features.map((f) => f.trim()).filter(Boolean);
}

function buildContentRow(
  planId: number,
  input: plan_content_input
): Record<string, unknown> {
  const context = input.context ?? DEFAULT_CONTENT_CONTEXT;
  const now = new Date().toISOString();
  return {
    plan_id: planId,
    context,
    subtitle: input.subtitle ?? null,
    features: normalizeFeatures(input.features),
    cta_label: input.cta_label ?? null,
    cta_variant: input.cta_variant ?? 'primary',
    badge_label: input.badge_label ?? null,
    is_highlighted: input.is_highlighted ?? false,
    display_order: input.display_order ?? 0,
    updated_at: now,
  };
}

/** Superadmin-only: list all plans including inactive. */
export async function listAllPlansWithContent(
  supabaseAdmin: SupabaseClient,
  context: plan_content_context = DEFAULT_CONTENT_CONTEXT
): Promise<plans_with_content[]> {
  const { data, error } = await supabaseAdmin
    .from('plans')
    .select('*, plan_content(*)')
    .order('display_order', { ascending: true })
    .order('price', { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) =>
    attachContent(row as Record<string, unknown>, context)
  );
}

/** Superadmin-only: create plan and optional marketing content. */
export async function createPlanWithContent(
  supabaseAdmin: SupabaseClient,
  input: plan_input
): Promise<plans_with_content> {
  const now = new Date().toISOString();
  const { content, ...planFields } = input;

  const { data: planRow, error: planError } = await supabaseAdmin
    .from('plans')
    .insert({
      name: planFields.name,
      slug: planFields.slug,
      price: planFields.price,
      booking_limit: planFields.booking_limit,
      workspace_limit: planFields.workspace_limit ?? 1,
      admin_limit: planFields.admin_limit ?? 1,
      service_provider_limit: planFields.service_provider_limit ?? 2,
      extra_service_provider_seat_price: planFields.extra_service_provider_seat_price ?? 0,
      google_calendar_sync: planFields.google_calendar_sync ?? true,
      email_notifications: planFields.email_notifications ?? true,
      public_booking_page: planFields.public_booking_page ?? true,
      whatsapp_automation: planFields.whatsapp_automation ?? false,
      online_payments: planFields.online_payments ?? false,
      additional_locations: planFields.additional_locations ?? false,
      is_active: planFields.is_active ?? true,
      billing_interval: planFields.billing_interval ?? null,
      display_order: planFields.display_order ?? 0,
      updated_at: now,
    })
    .select('*')
    .single();

  if (planError) throw new Error(planError.message);
  if (!planRow) throw new Error('Failed to create plan');

  const plan = rowToPlan(planRow as Record<string, unknown>);

  if (content) {
    await upsertPlanContent(supabaseAdmin, plan.id, content);
  }

  const { data: fullRow, error: fetchError } = await supabaseAdmin
    .from('plans')
    .select('*, plan_content(*)')
    .eq('id', plan.id)
    .single();

  if (fetchError) throw new Error(fetchError.message);
  return attachContent(fullRow as Record<string, unknown>);
}

/** Superadmin-only: update plan fields and optional marketing content. */
export async function updatePlanWithContent(
  supabaseAdmin: SupabaseClient,
  planId: number,
  input: Partial<plan_input>
): Promise<plans_with_content> {
  const now = new Date().toISOString();
  const { content, ...planFields } = input;

  const patch: Record<string, unknown> = { updated_at: now };
  const keys: (keyof Omit<plan_input, 'content'>)[] = [
    'name',
    'slug',
    'price',
    'booking_limit',
    'workspace_limit',
    'admin_limit',
    'service_provider_limit',
    'extra_service_provider_seat_price',
    'google_calendar_sync',
    'email_notifications',
    'public_booking_page',
    'whatsapp_automation',
    'online_payments',
    'additional_locations',
    'is_active',
    'billing_interval',
    'display_order',
  ];

  for (const key of keys) {
    if (planFields[key] !== undefined) {
      patch[key] = planFields[key];
    }
  }

  if (Object.keys(patch).length > 1) {
    const { error: planError } = await supabaseAdmin
      .from('plans')
      .update(patch)
      .eq('id', planId);

    if (planError) throw new Error(planError.message);
  }

  if (content) {
    await upsertPlanContent(supabaseAdmin, planId, content);
  }

  const { data: fullRow, error: fetchError } = await supabaseAdmin
    .from('plans')
    .select('*, plan_content(*)')
    .eq('id', planId)
    .single();

  if (fetchError) throw new Error(fetchError.message);
  if (!fullRow) throw new Error('Plan not found');
  return attachContent(fullRow as Record<string, unknown>);
}

/** Superadmin-only: upsert marketing content for a plan. */
export async function upsertPlanContent(
  supabaseAdmin: SupabaseClient,
  planId: number,
  input: plan_content_input
): Promise<plan_content> {
  const context = input.context ?? DEFAULT_CONTENT_CONTEXT;
  const row = buildContentRow(planId, input);

  const { data, error } = await supabaseAdmin
    .from('plan_content')
    .upsert(row, { onConflict: 'plan_id,context' })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Failed to upsert plan content');
  return rowToPlanContent(data as Record<string, unknown>);
}

/** Superadmin-only: soft-deactivate a plan. */
export async function deactivatePlan(
  supabaseAdmin: SupabaseClient,
  planId: number
): Promise<plans> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('plans')
    .update({ is_active: false, updated_at: now })
    .eq('id', planId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('Plan not found');
  return rowToPlan(data as Record<string, unknown>);
}
