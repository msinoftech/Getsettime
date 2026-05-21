import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';
import { createClient } from '@supabase/supabase-js';
import { appendActivityLog } from '@/lib/activity-log';
import { workspace_meeting_options_to_location } from '@/src/utils/meeting_options';
import { ROLE_SERVICE_PROVIDER } from '@/src/constants/roles';
import {
  ensureDefaultEventTypePublic,
  resolveDefaultEventTypeId,
  createServiceProviderEventType,
  syncServiceProviderEventTypeLocation,
} from '@/lib/workspace-service';
import {
  mergeAvailabilitySettings,
  sanitizeServiceProviderAvailabilityPatch,
} from '@/src/utils/mergeAvailabilitySettings';
import {
  mergeNotificationsSettings,
  mergeMeetingOptionsSettings,
  sanitizeServiceProviderNotificationsPatch,
  sanitizeServiceProviderMeetingOptionsPatch,
  wrapServiceProviderTopLevelNotifications,
  wrapServiceProviderTopLevelMeetingOptions,
} from '@/src/utils/mergeProviderSettings';
import {
  resolveNotificationsForServiceProvider,
  resolveMeetingOptionsForServiceProvider,
} from '@/src/utils/providerSettingsResolution';

const LOCKED_INTAKE_FORM_KEYS = [
  'name',
  'email',
  'phone',
  'additional_description',
] as const;

type LockedIntakeFormKey = typeof LOCKED_INTAKE_FORM_KEYS[number];

function lockIntakeFormFields(
  existingIntakeForm: unknown,
  mergedIntakeForm: unknown
): Record<string, unknown> {
  const existingObj =
    typeof existingIntakeForm === 'object' && existingIntakeForm !== null
      ? (existingIntakeForm as Record<string, unknown>)
      : {};
  const mergedObj =
    typeof mergedIntakeForm === 'object' && mergedIntakeForm !== null
      ? (mergedIntakeForm as Record<string, unknown>)
      : {};

  const locked: Record<string, unknown> = { ...mergedObj };
  for (const key of LOCKED_INTAKE_FORM_KEYS) {
    const existingValue = existingObj[key];
    locked[key] = typeof existingValue === 'boolean' ? existingValue : true;
  }
  return locked;
}

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || null;

  if (!token) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const verifyClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: { user }, error } = await verifyClient.auth.getUser(token);
  if (error || !user) {
    return null;
  }

  return user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('configurations')
      .select('settings')
      .eq('workspace_id', workspaceId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching settings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const settings = (data?.settings || {}) as Record<string, unknown>;
    const userRole = user.user_metadata?.role as string | undefined;
    const { searchParams } = new URL(req.url);
    const providerParam = searchParams.get('service_provider_id')?.trim() || '';
    const resolveProviderId =
      userRole === ROLE_SERVICE_PROVIDER
        ? user.id
        : providerParam || null;

    if (resolveProviderId) {
      const resolved = {
        ...settings,
        notifications: resolveNotificationsForServiceProvider(
          settings.notifications as Record<string, unknown>,
          resolveProviderId
        ),
        meeting_options: resolveMeetingOptionsForServiceProvider(
          settings.meeting_options as Record<string, unknown>,
          resolveProviderId
        ),
      };
      return NextResponse.json({ settings: resolved });
    }

    return NextResponse.json({ settings });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const body = await req.json();
    let newSettings = body?.settings;

    if (!newSettings || typeof newSettings !== 'object') {
      return NextResponse.json({ error: 'Invalid settings data' }, { status: 400 });
    }

    const userRole = user.user_metadata?.role as string | undefined;
    if (userRole === ROLE_SERVICE_PROVIDER) {
      if (newSettings.availability && typeof newSettings.availability === 'object') {
        const sanitized = sanitizeServiceProviderAvailabilityPatch(
          newSettings.availability as Record<string, unknown>,
          user.id
        );
        if (!sanitized) {
          return NextResponse.json(
            {
              error:
                'Service providers must save working hours via Save Timesheet during onboarding (provider availability only).',
            },
            { status: 403 }
          );
        }
        newSettings = { ...newSettings, availability: sanitized };
      }

      if (newSettings.notifications && typeof newSettings.notifications === 'object') {
        const raw = newSettings.notifications as Record<string, unknown>;
        const sanitized =
          sanitizeServiceProviderNotificationsPatch(raw, user.id) ??
          wrapServiceProviderTopLevelNotifications(raw, user.id);
        if (!sanitized) {
          return NextResponse.json(
            { error: 'Invalid service provider notification settings' },
            { status: 400 }
          );
        }
        newSettings = { ...newSettings, notifications: sanitized };
      }

      if (newSettings.meeting_options && typeof newSettings.meeting_options === 'object') {
        const raw = newSettings.meeting_options as Record<string, unknown>;
        const sanitized =
          sanitizeServiceProviderMeetingOptionsPatch(raw, user.id) ??
          wrapServiceProviderTopLevelMeetingOptions(raw, user.id);
        if (!sanitized) {
          return NextResponse.json(
            { error: 'Invalid service provider meeting options' },
            { status: 400 }
          );
        }
        newSettings = { ...newSettings, meeting_options: sanitized };
      }

      const blockedKeys = ['general', 'intake_form'] as const;
      for (const key of blockedKeys) {
        if (Object.prototype.hasOwnProperty.call(newSettings, key)) {
          delete (newSettings as Record<string, unknown>)[key];
        }
      }
    }

    const supabase = createSupabaseServerClient();

    // First, get existing configuration
    const { data: existingConfig, error: fetchError } = await supabase
      .from('configurations')
      .select('settings')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching existing settings:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Merge existing settings with new settings (new settings take precedence)
    const existingSettings = existingConfig?.settings || {};
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c18ea6a2-9a56-4a40-8939-326a1784f350',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:106',message:'Before merge',data:{existingSettings,newSettings,workspaceId},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    const mergedSettings = {
      ...existingSettings,
      ...newSettings,
      // Deep merge for nested objects
      general: {
        ...(existingSettings.general || {}),
        ...(newSettings.general || {}),
      },
      availability: mergeAvailabilitySettings(
        (existingSettings.availability || {}) as Record<string, unknown>,
        (newSettings.availability || {}) as Record<string, unknown>
      ),
      notifications: mergeNotificationsSettings(
        (existingSettings.notifications || {}) as Record<string, unknown>,
        (newSettings.notifications || {}) as Record<string, unknown>
      ),
      intake_form: {
        ...(existingSettings.intake_form || {}),
        ...(newSettings.intake_form || {}),
      },
      meeting_options: mergeMeetingOptionsSettings(
        (typeof existingSettings.meeting_options === 'object' &&
        existingSettings.meeting_options !== null
          ? (existingSettings.meeting_options as Record<string, unknown>)
          : {}) as Record<string, unknown>,
        (typeof newSettings.meeting_options === 'object' &&
        newSettings.meeting_options !== null
          ? (newSettings.meeting_options as Record<string, unknown>)
          : undefined)
      ),
    };
    mergedSettings.intake_form = lockIntakeFormFields(
      existingSettings.intake_form,
      mergedSettings.intake_form
    );
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/c18ea6a2-9a56-4a40-8939-326a1784f350',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'route.ts:122',message:'After merge',data:{mergedSettings},timestamp:Date.now(),sessionId:'debug-session',runId:'initial',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion

    // Update or insert configuration
    let data;
    let error;

    if (existingConfig) {
      // Update existing configuration
      const result = await supabase
        .from('configurations')
        .update({ settings: mergedSettings })
        .eq('workspace_id', workspaceId)
        .select('settings')
        .single();
      data = result.data;
      error = result.error;
    } else {
      // Insert new configuration
      const result = await supabase
        .from('configurations')
        .insert({
          workspace_id: workspaceId,
          settings: mergedSettings,
        })
        .select('settings')
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      console.error('Error saving settings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    const changedAvailability = Object.prototype.hasOwnProperty.call(newSettings, 'availability');
    const changedMeetingOptions = Object.prototype.hasOwnProperty.call(
      newSettings,
      'meeting_options'
    );
    const wid =
      typeof workspaceId === 'number' ? workspaceId : Number(workspaceId);

    const spAvailabilityOnly =
      userRole === ROLE_SERVICE_PROVIDER &&
      changedAvailability &&
      !changedMeetingOptions;

    if (Number.isFinite(wid) && (changedAvailability || changedMeetingOptions) && !spAvailabilityOnly) {
      await ensureDefaultEventTypePublic(supabase, wid);
    }

    await appendActivityLog(workspaceId, {
      type: changedAvailability ? 'availability' : 'settings',
      action: 'updated',
      title: changedAvailability ? 'Availability timesheet updated' : 'Workspace settings updated',
      description: changedAvailability
        ? 'Availability schedule or time slots were changed'
        : 'General workspace configuration was changed',
    });

    if (changedMeetingOptions && Number.isFinite(wid)) {
      const meetingForLocation =
        userRole === ROLE_SERVICE_PROVIDER
          ? resolveMeetingOptionsForServiceProvider(
              mergedSettings.meeting_options as Record<string, unknown>,
              user.id
            )
          : mergedSettings.meeting_options;
      const location_type = workspace_meeting_options_to_location(meetingForLocation);
      if (location_type) {
        if (userRole === ROLE_SERVICE_PROVIDER) {
          await createServiceProviderEventType(supabase, {
            workspaceId: wid,
            ownerId: user.id,
          });
          const { error: locErr } = await syncServiceProviderEventTypeLocation(
            supabase,
            wid,
            user.id
          );
          if (locErr) {
            console.warn('SP event_type location sync (non-critical):', locErr);
          }
        } else {
          const defaultEventId = await resolveDefaultEventTypeId(supabase, wid);
          if (defaultEventId != null) {
            const { error: etError } = await supabase
              .from('event_types')
              .update({ location_type, is_public: true })
              .eq('id', defaultEventId)
              .eq('workspace_id', wid);
            if (etError) {
              console.warn('Default event_type location sync (non-critical):', etError);
            }
          }
        }
      }
    }

    return NextResponse.json({ settings: data.settings });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

