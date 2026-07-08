import type { SupabaseClient } from '@supabase/supabase-js';

export type customer_booking_rules = {
  allow_customer_reschedule: boolean;
  allow_customer_cancellation: boolean;
};

export function resolve_customer_booking_rules(
  general: Record<string, unknown> | null | undefined
): customer_booking_rules {
  return {
    allow_customer_reschedule: general?.allow_customer_reschedule !== false,
    allow_customer_cancellation: general?.allow_customer_cancellation !== false,
  };
}

export async function load_customer_booking_rules_for_workspace(
  supabase: SupabaseClient,
  workspaceId: string | number
): Promise<customer_booking_rules> {
  const { data } = await supabase
    .from('configurations')
    .select('settings')
    .eq('workspace_id', workspaceId)
    .single();

  const settings = (data?.settings ?? {}) as Record<string, unknown>;
  const general =
    settings.general && typeof settings.general === 'object'
      ? (settings.general as Record<string, unknown>)
      : {};

  return resolve_customer_booking_rules(general);
}
