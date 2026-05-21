import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@app/db';
import { ROLE_SERVICE_PROVIDER } from '@/src/constants/roles';
import {
  createServiceProviderEventType,
  ensureServiceProviderSettingsDefaults,
} from '@/lib/workspace-service';
import type { provider_availability_entry } from '@/src/utils/availabilityResolution';
import type { DaySchedule } from '@/src/types/workspace';
import { mergeAvailabilitySettings } from '@/src/utils/mergeAvailabilitySettings';

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
    const timesheet = body?.timesheet;
    const individual = body?.individual;
    if (!timesheet || typeof timesheet !== 'object') {
      return NextResponse.json({ error: 'timesheet is required' }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseServerClient();

    const { data: existingConfig, error: fetchError } = await supabaseAdmin
      .from('configurations')
      .select('settings')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const existingSettings = (existingConfig?.settings ?? {}) as Record<string, unknown>;
    const existingAvailability = (existingSettings.availability ?? {}) as Record<string, unknown>;
    const existingProviders = (existingAvailability.providers ?? {}) as Record<
      string,
      provider_availability_entry
    >;
    const existingEntry = existingProviders[user.id];

    const providerEntry: provider_availability_entry = {
      ...(existingEntry ?? {}),
      timesheet: timesheet as Record<string, DaySchedule>,
      ...(individual && typeof individual === 'object'
        ? { individual: individual as Record<string, boolean> }
        : {}),
      lastUpdated: new Date().toISOString(),
    };

    const mergedAvailability = mergeAvailabilitySettings(existingAvailability, {
      providers: {
        ...existingProviders,
        [user.id]: providerEntry,
      },
    });

    const mergedSettings = {
      ...existingSettings,
      availability: mergedAvailability,
    };

    let saveError;
    if (existingConfig) {
      const { error } = await supabaseAdmin
        .from('configurations')
        .update({ settings: mergedSettings })
        .eq('workspace_id', workspaceId);
      saveError = error;
    } else {
      const { error } = await supabaseAdmin
        .from('configurations')
        .insert({ workspace_id: workspaceId, settings: mergedSettings });
      saveError = error;
    }

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }

    await createServiceProviderEventType(supabaseAdmin, {
      workspaceId,
      ownerId: user.id,
    });

    await ensureServiceProviderSettingsDefaults(supabaseAdmin, workspaceId, user.id);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error('provider-availability POST:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
