import type { SupabaseClient } from '@supabase/supabase-js';
import { getWorkspacePlanSnapshot } from '@app/db/subscription';
import { sendWelcomeEmail } from '@/lib/email-service';

function getAppOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL;
  if (!raw) return 'http://localhost:3000';
  if (raw.startsWith('http')) return raw.replace(/\/$/, '');
  return `https://${raw.replace(/\/$/, '')}`;
}

/** Non-blocking welcome email after new workspace creation. */
export async function sendWorkspaceWelcomeEmail(params: {
  to: string;
  workspaceId: number;
  adminName: string;
  supabaseAdmin: SupabaseClient;
}): Promise<void> {
  const { to, workspaceId, adminName, supabaseAdmin } = params;
  const origin = getAppOrigin();

  const { data: workspace } = await supabaseAdmin
    .from('workspaces')
    .select('name')
    .eq('id', workspaceId)
    .maybeSingle();

  const snapshot = await getWorkspacePlanSnapshot(supabaseAdmin, workspaceId);
  const workspaceName =
    (workspace?.name as string | undefined)?.trim() || 'Your workspace';

  await sendWelcomeEmail({
    to,
    workspaceName,
    adminName: adminName.trim() || 'there',
    dashboardUrl: `${origin}/`,
    upgradeUrl: `${origin}/billings`,
    planName: snapshot.plan.name,
    bookingLimit: snapshot.plan.booking_limit,
    adminLimit: snapshot.plan.admin_limit,
    serviceProviderLimit: snapshot.plan.service_provider_limit,
  });
}
