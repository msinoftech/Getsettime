import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@app/db';
import { ROLE_SERVICE_PROVIDER } from '@/src/constants/roles';
import {
  getDefaultNotificationSettings,
  createServiceProviderEventType,
  ensureServiceProviderSettingsDefaults,
  syncServiceProviderEventTypeLocation,
} from '@/lib/workspace-service';
import {
  mergeNotificationsSettings,
  mergeMeetingOptionsSettings,
} from '@/src/utils/mergeProviderSettings';
import type {
  provider_meeting_options_entry,
  provider_notifications_entry,
} from '@/src/utils/providerSettingsResolution';

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || null;
  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const verifyClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error,
  } = await verifyClient.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const role = user.user_metadata?.role as string | undefined;
    if (role !== ROLE_SERVICE_PROVIDER) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const workspaceIdRaw = user.user_metadata?.workspace_id;
    const workspaceId =
      typeof workspaceIdRaw === 'number'
        ? workspaceIdRaw
        : typeof workspaceIdRaw === 'string'
          ? parseInt(workspaceIdRaw, 10)
          : NaN;

    if (!Number.isFinite(workspaceId) || workspaceId <= 0) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const body = await req.json();
    const notificationsIn = body?.notifications;
    const meetingOptionsIn = body?.meeting_options;
    const initDefaultsOnly = body?.init_defaults === true;

    if (
      !initDefaultsOnly &&
      (!notificationsIn || typeof notificationsIn !== 'object') &&
      (!meetingOptionsIn || typeof meetingOptionsIn !== 'object')
    ) {
      return NextResponse.json(
        { error: 'notifications and/or meeting_options required' },
        { status: 400 }
      );
    }

    const supabaseAdmin = createSupabaseServerClient();

    if (initDefaultsOnly) {
      const { error } = await ensureServiceProviderSettingsDefaults(
        supabaseAdmin,
        workspaceId,
        user.id
      );
      if (error) {
        return NextResponse.json({ error }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    const { data: existingConfig, error: fetchError } = await supabaseAdmin
      .from('configurations')
      .select('settings')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const existingSettings = (existingConfig?.settings ?? {}) as Record<string, unknown>;
    const existingNotifications = (existingSettings.notifications ?? {}) as Record<string, unknown>;
    const existingMeeting = (existingSettings.meeting_options ?? {}) as Record<string, unknown>;
    const existingNotifProviders = (existingNotifications.providers ?? {}) as Record<
      string,
      provider_notifications_entry
    >;
    const existingMeetingProviders = (existingMeeting.providers ?? {}) as Record<
      string,
      provider_meeting_options_entry
    >;

    const now = new Date().toISOString();
    let mergedNotifications = existingNotifications;
    let mergedMeeting = existingMeeting;

    if (notificationsIn && typeof notificationsIn === 'object') {
      const { providers: _p, ...notifFields } = notificationsIn as Record<string, unknown>;
      const entry: provider_notifications_entry = {
        ...(existingNotifProviders[user.id] ?? getDefaultNotificationSettings()),
        ...(notifFields as provider_notifications_entry),
        lastUpdated: now,
      };
      mergedNotifications = mergeNotificationsSettings(existingNotifications, {
        providers: { ...existingNotifProviders, [user.id]: entry },
      });
    } else {
      await ensureServiceProviderSettingsDefaults(supabaseAdmin, workspaceId, user.id);
    }

    if (meetingOptionsIn && typeof meetingOptionsIn === 'object') {
      const { providers: _p, ...moFields } = meetingOptionsIn as Record<string, unknown>;
      const entry: provider_meeting_options_entry = {
        ...(existingMeetingProviders[user.id] ?? {}),
        ...(moFields as provider_meeting_options_entry),
        lastUpdated: now,
      };
      mergedMeeting = mergeMeetingOptionsSettings(existingMeeting, {
        providers: { ...existingMeetingProviders, [user.id]: entry },
      });
    }

    const mergedSettings = {
      ...existingSettings,
      notifications: mergedNotifications,
      meeting_options: mergedMeeting,
    };

    let saveError;
    if (existingConfig) {
      const { error } = await supabaseAdmin
        .from('configurations')
        .update({ settings: mergedSettings })
        .eq('workspace_id', workspaceId);
      saveError = error;
    } else {
      const { error } = await supabaseAdmin.from('configurations').insert({
        workspace_id: workspaceId,
        settings: mergedSettings,
      });
      saveError = error;
    }

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }

    if (meetingOptionsIn && typeof meetingOptionsIn === 'object') {
      await createServiceProviderEventType(supabaseAdmin, {
        workspaceId,
        ownerId: user.id,
      });
      await syncServiceProviderEventTypeLocation(supabaseAdmin, workspaceId, user.id);
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('provider-settings POST:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
