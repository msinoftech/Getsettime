import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { isValidPhone, toE164, sendSMS } from '@/lib/twilio-sms';
import { sendReminderEmail, sendFollowUpEmail } from '@/lib/email-service';
import { sendWhatsAppTemplate } from '@/lib/whatsapp';

const BATCH_WINDOW_MINUTES = 15;
const SMS_REMINDER_MINUTES = 60;
const EMAIL_REMINDER_MINUTES = 24 * 60; // 24 hours

interface NotificationSettings {
  'email-reminder'?: boolean;
  'sms-reminder'?: boolean;
  'post-meeting-follow-up'?: boolean;
  'auto-confirm-booking'?: boolean;
}

interface CounterStats {
  sent: number;
  skipped: number;
  failed: number;
}

function getServiceRoleClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) return true;
  const customHeader = req.headers.get('x-cron-secret');
  return customHeader === cronSecret;
}

function formatBookingTime(startAt: string): string {
  const opts: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  };
  return new Date(startAt).toLocaleString('en-US', opts);
}

function resolveContact(booking: Record<string, unknown>): {
  email: string | null;
  phone: string | null;
  name: string;
} {
  const contacts = booking.contacts as
    | { phone?: string | null; email?: string | null; name?: string | null }[]
    | { phone?: string | null; email?: string | null; name?: string | null }
    | null;

  const contact = Array.isArray(contacts) ? contacts[0] : contacts;

  const email =
    (booking.invitee_email as string | null)?.trim() ||
    contact?.email?.trim() ||
    null;

  const phone =
    (booking.invitee_phone as string | null)?.trim() ||
    contact?.phone?.trim() ||
    null;

  const name =
    (booking.invitee_name as string | null)?.trim() ||
    contact?.name?.trim() ||
    'there';

  return { email, phone, name };
}

function resolveEventTitle(booking: Record<string, unknown>): string {
  const eventTypes = booking.event_types as
    | { title?: string }[]
    | { title?: string }
    | null;
  const et = Array.isArray(eventTypes) ? eventTypes[0] : eventTypes;
  return et?.title || 'Appointment';
}

async function getWorkspaceNotificationSettings(
  supabase: SupabaseClient,
  workspaceId: string,
): Promise<NotificationSettings> {
  const { data } = await supabase
    .from('configurations')
    .select('settings')
    .eq('workspace_id', workspaceId)
    .single();

  const notifications = (data?.settings as Record<string, unknown>)?.notifications as
    | NotificationSettings
    | undefined;

  return {
    'email-reminder': notifications?.['email-reminder'] ?? true,
    'sms-reminder': notifications?.['sms-reminder'] ?? true,
    'post-meeting-follow-up': notifications?.['post-meeting-follow-up'] ?? true,
  };
}

// ─── 24h Email Reminders ────────────────────────────────────────────────────

async function process24hEmailReminders(
  supabase: SupabaseClient,
  now: Date,
  settingsCache: Map<string, NotificationSettings>,
  errors: string[],
): Promise<CounterStats> {
  const stats: CounterStats = { sent: 0, skipped: 0, failed: 0 };

  const windowStart = new Date(now.getTime() + EMAIL_REMINDER_MINUTES * 60_000);
  const windowEnd = new Date(windowStart.getTime() + BATCH_WINDOW_MINUTES * 60_000);

  console.log(`[cron] 24h email window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, workspace_id, invitee_name, invitee_email, invitee_phone, start_at, end_at, event_type_id, contact_id, metadata, contacts(phone, email, name), event_types(title, duration_minutes)')
    .gte('start_at', windowStart.toISOString())
    .lte('start_at', windowEnd.toISOString())
    .neq('status', 'cancelled')
    .is('email_reminder_sent_at', null)
    .is('email_reminder_skipped_at', null);

  if (error) {
    console.error('[cron] 24h email query error:', error);
    errors.push(`24h email query: ${error.message}`);
    return stats;
  }

  console.log(`[cron] 24h email: found ${bookings?.length ?? 0} bookings`);

  for (const booking of bookings ?? []) {
    const wsId = booking.workspace_id as string;
    if (!settingsCache.has(wsId)) {
      settingsCache.set(wsId, await getWorkspaceNotificationSettings(supabase, wsId));
    }
    const settings = settingsCache.get(wsId)!;

    if (!settings['email-reminder']) {
      await supabase.from('bookings').update({ email_reminder_skipped_at: new Date().toISOString() }).eq('id', booking.id);
      stats.skipped++;
      continue;
    }

    const { email, name } = resolveContact(booking as Record<string, unknown>);
    if (!email) {
      await supabase.from('bookings').update({ email_reminder_skipped_at: new Date().toISOString() }).eq('id', booking.id);
      stats.skipped++;
      continue;
    }

    const eventTitle = resolveEventTitle(booking as Record<string, unknown>);
    const et = Array.isArray(booking.event_types) ? booking.event_types[0] : booking.event_types;
    const duration = (et as { duration_minutes?: number } | null)?.duration_minutes || 30;

    try {
      await sendReminderEmail({
        inviteeName: name,
        inviteeEmail: email,
        eventTypeName: eventTitle,
        startTime: booking.start_at!,
        endTime: booking.end_at || booking.start_at!,
        duration,
        notes: (booking.metadata as Record<string, unknown>)?.notes as string | undefined,
      });
      await supabase.from('bookings').update({ email_reminder_sent_at: new Date().toISOString() }).eq('id', booking.id);
      stats.sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`24h email booking ${booking.id}: ${msg}`);
      stats.failed++;
    }
  }

  return stats;
}

// ─── 1h SMS Reminders ───────────────────────────────────────────────────────

async function process1hSmsReminders(
  supabase: SupabaseClient,
  now: Date,
  settingsCache: Map<string, NotificationSettings>,
  errors: string[],
): Promise<CounterStats> {
  const stats: CounterStats = { sent: 0, skipped: 0, failed: 0 };

  const windowStart = new Date(now.getTime() + SMS_REMINDER_MINUTES * 60_000);
  const windowEnd = new Date(windowStart.getTime() + BATCH_WINDOW_MINUTES * 60_000);

  console.log(`[cron] 1h SMS window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, workspace_id, invitee_name, invitee_phone, invitee_email, start_at, end_at, event_type_id, contact_id, contacts(phone, email, name), event_types(title)')
    .gte('start_at', windowStart.toISOString())
    .lte('start_at', windowEnd.toISOString())
    .neq('status', 'cancelled')
    .is('sms_reminder_sent_at', null)
    .is('sms_reminder_skipped_at', null);

  if (error) {
    console.error('[cron] 1h SMS query error:', error);
    errors.push(`1h SMS query: ${error.message}`);
    return stats;
  }

  console.log(`[cron] 1h SMS: found ${bookings?.length ?? 0} bookings`, bookings?.map((b) => b.id) ?? []);

  for (const booking of bookings ?? []) {
    const wsId = booking.workspace_id as string;
    if (!settingsCache.has(wsId)) {
      settingsCache.set(wsId, await getWorkspaceNotificationSettings(supabase, wsId));
    }
    const settings = settingsCache.get(wsId)!;

    if (!settings['sms-reminder']) {
      await supabase.from('bookings').update({ sms_reminder_skipped_at: new Date().toISOString() }).eq('id', booking.id);
      stats.skipped++;
      continue;
    }

    const { phone, name } = resolveContact(booking as Record<string, unknown>);
    if (!phone || !isValidPhone(phone)) {
      await supabase.from('bookings').update({ sms_reminder_skipped_at: new Date().toISOString() }).eq('id', booking.id);
      stats.skipped++;
      continue;
    }

    const e164 = toE164(phone);
    if (!e164) {
      await supabase.from('bookings').update({ sms_reminder_skipped_at: new Date().toISOString() }).eq('id', booking.id);
      stats.skipped++;
      continue;
    }

    const eventTitle = resolveEventTitle(booking as Record<string, unknown>);
    const when = formatBookingTime(booking.start_at!);
    const message = `Hi ${name}, reminder: your ${eventTitle} is on ${when}. See you soon!`;

    const ok = await sendSMS(e164, message);
    if (ok) {
      await supabase.from('bookings').update({ sms_reminder_sent_at: new Date().toISOString() }).eq('id', booking.id);
      stats.sent++;
    } else {
      errors.push(`SMS booking ${booking.id} (${e164})`);
      stats.failed++;
    }
  }

  return stats;
}

// ─── 1h WhatsApp Reminders ──────────────────────────────────────────────────

async function process1hWhatsAppReminders(
  supabase: SupabaseClient,
  now: Date,
  settingsCache: Map<string, NotificationSettings>,
  errors: string[],
): Promise<CounterStats> {
  const stats: CounterStats = { sent: 0, skipped: 0, failed: 0 };

  const windowStart = new Date(now.getTime() + SMS_REMINDER_MINUTES * 60_000);
  const windowEnd = new Date(windowStart.getTime() + BATCH_WINDOW_MINUTES * 60_000);

  console.log(`[cron] 1h WhatsApp window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, workspace_id, invitee_name, invitee_phone, invitee_email, start_at, end_at, event_type_id, contact_id, contacts(phone, email, name), event_types(title)')
    .gte('start_at', windowStart.toISOString())
    .lte('start_at', windowEnd.toISOString())
    .neq('status', 'cancelled')
    .is('whatsapp_reminder_sent_at', null)
    .is('whatsapp_reminder_skipped_at', null);

  if (error) {
    console.error('[cron] 1h WhatsApp query error:', error);
    errors.push(`1h WhatsApp query: ${error.message}`);
    return stats;
  }

  console.log(`[cron] 1h WhatsApp: found ${bookings?.length ?? 0} bookings`);

  const templateName = process.env.WHATSAPP_REMINDER_TEMPLATE || 'contact_information';
  const languageCode = process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en';

  for (const booking of bookings ?? []) {
    const wsId = booking.workspace_id as string;
    if (!settingsCache.has(wsId)) {
      settingsCache.set(wsId, await getWorkspaceNotificationSettings(supabase, wsId));
    }
    const settings = settingsCache.get(wsId)!;

    if (!settings['sms-reminder']) {
      await supabase.from('bookings').update({ whatsapp_reminder_skipped_at: new Date().toISOString() }).eq('id', booking.id);
      stats.skipped++;
      continue;
    }

    const { phone, name, email } = resolveContact(booking as Record<string, unknown>);
    if (!phone) {
      await supabase.from('bookings').update({ whatsapp_reminder_skipped_at: new Date().toISOString() }).eq('id', booking.id);
      stats.skipped++;
      continue;
    }

    const eventTitle = resolveEventTitle(booking as Record<string, unknown>);
    const when = formatBookingTime(booking.start_at!);

    try {
      await sendWhatsAppTemplate(phone, templateName, languageCode, [
        {
          type: 'body',
          parameters: [
            { type: 'text', text: name },
            { type: 'text', text: name },
            { type: 'text', text: email || 'N/A' },
            { type: 'text', text: phone },
            { type: 'text', text: `Reminder: your ${eventTitle} is on ${when}. See you soon!` },
          ],
        },
      ]);
      await supabase.from('bookings').update({ whatsapp_reminder_sent_at: new Date().toISOString() }).eq('id', booking.id);
      stats.sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cron] WhatsApp failed for booking ${booking.id}:`, msg);
      errors.push(`WhatsApp booking ${booking.id}: ${msg}`);
      stats.failed++;
    }
  }

  return stats;
}

// ─── Post-Meeting Follow-Up ─────────────────────────────────────────────────

async function processPostMeetingFollowUps(
  supabase: SupabaseClient,
  now: Date,
  settingsCache: Map<string, NotificationSettings>,
  errors: string[],
): Promise<CounterStats> {
  const stats: CounterStats = { sent: 0, skipped: 0, failed: 0 };

  const windowStart = new Date(now.getTime() - BATCH_WINDOW_MINUTES * 60_000);
  const windowEnd = now;

  console.log(`[cron] Follow-up window: ${windowStart.toISOString()} → ${windowEnd.toISOString()}`);

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, workspace_id, invitee_name, invitee_email, invitee_phone, start_at, end_at, event_type_id, contact_id, metadata, contacts(phone, email, name), event_types(title, duration_minutes)')
    .gte('end_at', windowStart.toISOString())
    .lte('end_at', windowEnd.toISOString())
    .eq('status', 'completed')
    .is('followup_email_sent_at', null)
    .is('followup_email_skipped_at', null);

  if (error) {
    console.error('[cron] Follow-up query error:', error);
    errors.push(`Follow-up query: ${error.message}`);
    return stats;
  }

  console.log(`[cron] Follow-up: found ${bookings?.length ?? 0} bookings`);

  for (const booking of bookings ?? []) {
    const wsId = booking.workspace_id as string;
    if (!settingsCache.has(wsId)) {
      settingsCache.set(wsId, await getWorkspaceNotificationSettings(supabase, wsId));
    }
    const settings = settingsCache.get(wsId)!;

    if (!settings['post-meeting-follow-up']) {
      await supabase.from('bookings').update({ followup_email_skipped_at: new Date().toISOString() }).eq('id', booking.id);
      stats.skipped++;
      continue;
    }

    const { email, name } = resolveContact(booking as Record<string, unknown>);
    if (!email) {
      await supabase.from('bookings').update({ followup_email_skipped_at: new Date().toISOString() }).eq('id', booking.id);
      stats.skipped++;
      continue;
    }

    const eventTitle = resolveEventTitle(booking as Record<string, unknown>);
    const et = Array.isArray(booking.event_types) ? booking.event_types[0] : booking.event_types;
    const duration = (et as { duration_minutes?: number } | null)?.duration_minutes || 30;

    try {
      await sendFollowUpEmail({
        inviteeName: name,
        inviteeEmail: email,
        eventTypeName: eventTitle,
        startTime: booking.start_at!,
        endTime: booking.end_at || booking.start_at!,
        duration,
        notes: (booking.metadata as Record<string, unknown>)?.notes as string | undefined,
      });
      await supabase.from('bookings').update({ followup_email_sent_at: new Date().toISOString() }).eq('id', booking.id);
      stats.sent++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Follow-up booking ${booking.id}: ${msg}`);
      stats.failed++;
    }
  }

  return stats;
}

// ─── Main GET Handler ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  console.log('[cron] Booking notifications endpoint hit');

  if (!isAuthorized(req)) {
    console.warn('[cron] Unauthorized request');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const supabase = getServiceRoleClient();
  const settingsCache = new Map<string, NotificationSettings>();
  const errors: string[] = [];

  const [emailReminders, smsReminders, whatsappReminders, followupEmails] = await Promise.all([
    process24hEmailReminders(supabase, now, settingsCache, errors),
    process1hSmsReminders(supabase, now, settingsCache, errors),
    process1hWhatsAppReminders(supabase, now, settingsCache, errors),
    processPostMeetingFollowUps(supabase, now, settingsCache, errors),
  ]);

  const result = {
    email_reminders: emailReminders,
    sms_reminders: smsReminders,
    whatsapp_reminders: whatsappReminders,
    followup_emails: followupEmails,
    ...(errors.length > 0 && { errors }),
  };

  console.log('[cron] Notification run complete:', JSON.stringify(result));

  return NextResponse.json(result);
}
