import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendReminderEmail } from '@/lib/email-service';
import { getPublicSiteOrigin } from '@/lib/request-site-origin';
import {
  admin_whatsapp_phones_for_booking,
  resolve_provider_notification_contact,
  sole_workspace_department_display_name,
} from '@/lib/booking_service_provider_phone';
import { post_booking_whatsapp_notification } from '@/lib/post_booking_whatsapp_notification';
import {
  type workspace_notifications_settings,
  is_whatsapp_admin_enabled,
  is_whatsapp_user_enabled,
} from '@/lib/workspace-notification-flags';
import { appendActivityLog } from '@/lib/activity-log';

type Channel = 'email' | 'whatsapp';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: booking_id } = await context.params;
    if (!booking_id || typeof booking_id !== 'string') {
      return NextResponse.json({ error: 'Booking id is required' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || null;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let body: { channel?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const channel = body.channel?.toLowerCase() as Channel;
    if (channel !== 'email' && channel !== 'whatsapp') {
      return NextResponse.json(
        { error: 'channel must be "email" or "whatsapp"' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id as string | undefined;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(
        'id,workspace_id,public_code,invitee_name,invitee_email,invitee_phone,service_provider_id,department_id,event_type_id,metadata,start_at,end_at,status,contact_id,contacts(name,phone,email),event_types(title,buffer_before,buffer_after)'
      )
      .eq('id', booking_id)
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (bookingError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (String(booking.status ?? '').toLowerCase() === 'deleted') {
      return NextResponse.json({ error: 'Booking no longer exists' }, { status: 404 });
    }

    const { data: configRow } = await supabase
      .from('configurations')
      .select('settings')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    const notifications =
      (configRow?.settings as Record<string, unknown> | undefined)?.notifications as
        | workspace_notifications_settings
        | undefined;

    const notifications_full = configRow?.settings as Record<string, unknown> | undefined;
    const email_reminder_on =
      (notifications_full?.['email-reminder'] as boolean | undefined) ?? true;

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    const serviceClient = serviceKey
      ? createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
      : null;

    let eventTitle = 'Appointment';
    let durationMinutes = 30;
    let arriveEarlyMin = 10;
    let arriveEarlyMax = 15;
    const et = Array.isArray(booking.event_types)
      ? booking.event_types[0]
      : booking.event_types;
    if (et && typeof et === 'object') {
      const t = et as { title?: string; buffer_before?: number; buffer_after?: number };
      if (t.title) eventTitle = t.title;
    }
    if (booking.event_type_id && serviceClient) {
      const { data: etRow } = await serviceClient
        .from('event_types')
        .select('title, duration_minutes, buffer_before, buffer_after')
        .eq('id', booking.event_type_id)
        .eq('workspace_id', workspaceId)
        .single();
      if (etRow) {
        eventTitle = etRow.title || eventTitle;
        durationMinutes = etRow.duration_minutes ?? durationMinutes;
        arriveEarlyMin = Number(etRow.buffer_before ?? arriveEarlyMin);
        arriveEarlyMax = Number(etRow.buffer_after ?? arriveEarlyMax);
      }
    }

    let departmentName: string | undefined;
    if (booking.department_id && serviceClient) {
      const { data: dept } = await serviceClient
        .from('departments')
        .select('name')
        .eq('id', booking.department_id)
        .eq('workspace_id', workspaceId)
        .single();
      departmentName = dept?.name || undefined;
    }
    if (!departmentName?.trim() && serviceClient) {
      try {
        const sole = await sole_workspace_department_display_name(serviceClient, workspaceId);
        if (sole) departmentName = sole;
      } catch {
        /* ignore */
      }
    }

    let providerName: string | undefined;
    if (serviceClient) {
      const resolved = await resolve_provider_notification_contact(
        serviceClient,
        serviceClient,
        String(workspaceId),
        (booking.service_provider_id as string | null) || null
      );
      providerName = resolved.provider_name;
    }

    const meta = booking.metadata as Record<string, unknown> | null | undefined;
    const noteStr =
      meta && typeof meta.notes !== 'undefined' ? String(meta.notes ?? '') : '';
    const startT = booking.start_at ?? '';
    const endT = booking.end_at || booking.start_at || '';

    if (channel === 'email') {
      if (!email_reminder_on) {
        return NextResponse.json(
          { error: 'Email reminders are disabled in workspace notifications' },
          { status: 400 }
        );
      }
      const email =
        booking.invitee_email?.trim() ||
        (booking.contacts as { email?: string } | null)?.email?.trim();
      if (!email) {
        return NextResponse.json(
          { error: 'Invitee email is missing for this booking' },
          { status: 400 }
        );
      }
      await sendReminderEmail({
        inviteeName: booking.invitee_name?.trim() || 'Invitee',
        inviteeEmail: email,
        eventTypeName: eventTitle,
        ...(departmentName?.trim() ? { departmentName: departmentName.trim() } : {}),
        ...(providerName?.trim() ? { providerName: providerName.trim() } : {}),
        startTime: startT,
        endTime: endT,
        duration: durationMinutes,
        ...(noteStr.trim() ? { notes: noteStr } : {}),
      });

      await appendActivityLog(workspaceId, {
        type: 'booking',
        action: 'updated',
        title: 'Reminder sent manually',
        description: `${booking.invitee_name || 'Someone'} (${booking_id}) — email`,
      });
      return NextResponse.json({ success: true, channel: 'email' });
    }

    /** WhatsApp */
    const wa_admin = is_whatsapp_admin_enabled(notifications ?? null);
    const wa_user = is_whatsapp_user_enabled(notifications ?? null);

    let admin_phones: string[] = [];
    if (wa_admin && serviceClient) {
      try {
        admin_phones = await admin_whatsapp_phones_for_booking(supabase, booking_id, {
          workspace_id: String(workspaceId),
          admin_supabase: serviceClient,
        });
      } catch {
        admin_phones = [];
      }
    }

    const inviteePhoneTrimmed = booking.invitee_phone?.trim();
    const contactsRow = booking.contacts as { phone?: string } | undefined;
    const phoneFromContact = contactsRow?.phone?.trim();
    const inviteeEffective = inviteePhoneTrimmed || phoneFromContact || '';

    const origin = getPublicSiteOrigin(req);

    let message = '';
    if (!origin.trim()) {
      return NextResponse.json(
        {
          error: 'App URL is not configured (NEXT_PUBLIC_APP_URL); cannot send WhatsApp from this deployment.',
        },
        { status: 500 }
      );
    }

    const bookingRef =
      typeof booking.public_code === 'string' && booking.public_code.trim()
        ? booking.public_code.trim()
        : String(booking.id);

    const when = startT ? new Date(startT).toLocaleString(undefined) : '';

    message = eventTitle.includes('appointment')
      ? `Reminder: your appointment is scheduled for ${when}. See you soon!`
      : `Reminder: your ${eventTitle} is on ${when}. See you soon!`;

    const admin_ok = wa_admin && admin_phones.length > 0;
    const user_ok = wa_user && Boolean(inviteeEffective);

    if (!admin_ok && !user_ok) {
      return NextResponse.json(
        {
          error:
            'WhatsApp is disabled for admin and invitee in notification settings, or phone numbers could not be resolved.',
        },
        { status: 400 }
      );
    }

    const phone_for_api =
      inviteeEffective ||
      (admin_phones[0]?.trim()) ||
      '';

    if (!phone_for_api) {
      return NextResponse.json(
        {
          error: 'No reachable phone number for WhatsApp reminder',
        },
        { status: 400 }
      );
    }

    const result_whatsapp = await post_booking_whatsapp_notification(origin.replace(/\/$/, ''), {
      name: booking.invitee_name?.trim() || 'Invitee',
      email: booking.invitee_email?.trim() || null,
      phone: phone_for_api,
      message,
      service: eventTitle,
      ...(departmentName?.trim() ? { department: departmentName.trim() } : {}),
      ...(providerName?.trim() ? { provider: providerName.trim() } : {}),
      start: startT,
      end: endT,
      note: noteStr,
      arrive_early_min: arriveEarlyMin,
      arrive_early_max: arriveEarlyMax,
      booking_reference: bookingRef,
      send_to_user: user_ok && Boolean(inviteeEffective.trim()),
      send_to_admin: admin_ok,
      ...(admin_ok && admin_phones.length ? { admin_phone: admin_phones } : {}),
      skip_contact_form_email: true,
      notification_kind: 'reminder',
    });

    if (!result_whatsapp.ok) {
      return NextResponse.json(
        { error: result_whatsapp.error || 'WhatsApp send failed' },
        { status: 502 }
      );
    }

    await appendActivityLog(workspaceId, {
      type: 'booking',
      action: 'updated',
      title: 'Reminder sent manually',
      description: `${booking.invitee_name || 'Someone'} (${booking_id}) — WhatsApp`,
    });
    return NextResponse.json({ success: true, channel: 'whatsapp' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Server error';
    console.error('send-reminder:', err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
