import type { SupabaseClient } from '@supabase/supabase-js';
import { getWorkspaceUsage } from '@app/db/subscription';
import {
  escapeHtmlForEmail,
  resolveSuperadminNotifyEmail,
} from '@/lib/superadmin-notify-email';
import nodemailer from 'nodemailer';

function createSmtpTransporter(): nodemailer.Transporter | null {
  const host = (process.env.SMTP_HOST || '').trim();
  const user = (process.env.SMTP_USER || '').trim();
  const password = (process.env.SMTP_PASSWORD || process.env.SMTP_PASS || '').trim();
  if (!host || !user || !password) return null;
  return nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass: password },
  });
}

/** Email workspace admin + superadmin once when booking quota hits 100%. */
export async function notifyBookingLimitReachedIfNeeded(
  supabaseAdmin: SupabaseClient,
  workspaceId: number
): Promise<void> {
  const usage = await getWorkspaceUsage(supabaseAdmin, workspaceId);
  if (!usage.booking_limit_reached) return;

  const { data: subRow } = await supabaseAdmin
    .from('workspace_subscriptions')
    .select('id, limit_notification_sent_at')
    .eq('workspace_id', workspaceId)
    .eq('status', 'active')
    .maybeSingle();

  if (subRow?.limit_notification_sent_at) return;

  const { data: ws } = await supabaseAdmin
    .from('workspaces')
    .select('name, slug')
    .eq('id', workspaceId)
    .maybeSingle();

  const { data: configRow } = await supabaseAdmin
    .from('configurations')
    .select('settings')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  const settings = (configRow?.settings ?? {}) as {
    general?: { business_email?: string; accountName?: string };
  };
  const adminEmail =
    settings.general?.business_email?.trim() ||
    process.env.SMTP_USER?.trim() ||
    null;

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '');
  const billingsUrl = appUrl ? `${appUrl}/billings` : '/billings';
  const transporter = createSmtpTransporter();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;

  const subject = `Booking limit reached — upgrade to continue`;
  const html = `
<p>Your workspace <strong>${escapeHtmlForEmail(ws?.name ?? 'Workspace')}</strong> has used all bookings included in your current plan.</p>
<p>Upgrade your plan to keep accepting appointments.</p>
<p><a href="${escapeHtmlForEmail(billingsUrl)}">Upgrade plan</a></p>
`;

  if (transporter && adminEmail && from) {
    await transporter.sendMail({
      from: `"GetSetTime" <${from}>`,
      to: adminEmail,
      subject,
      html,
    }).catch((err) => console.error('Booking limit admin email failed:', err));
  }

  const superTo = resolveSuperadminNotifyEmail();
  if (transporter && superTo && from) {
    await transporter.sendMail({
      from: `"GetSetTime" <${from}>`,
      to: superTo,
      subject: `Workspace ${ws?.name ?? workspaceId} reached booking limit`,
      html: `<p>Workspace ID ${workspaceId} (${escapeHtmlForEmail(ws?.slug ?? '')}) reached its plan booking limit.</p>`,
    }).catch((err) => console.error('Booking limit superadmin email failed:', err));
  }

  if (subRow?.id) {
    await supabaseAdmin
      .from('workspace_subscriptions')
      .update({ limit_notification_sent_at: new Date().toISOString() })
      .eq('id', subRow.id);
  }
}
