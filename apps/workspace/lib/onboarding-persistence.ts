import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@app/db';
import type { NextRequest } from 'next/server';
import {
  ROLE_SERVICE_PROVIDER,
  ROLE_WORKSPACE_ADMIN,
} from '@/src/constants/roles';
import {
  createServiceProviderEventType,
  ensureServiceProviderSettingsDefaults,
  syncServiceProviderEventTypeLocation,
  getDefaultNotificationSettings,
  ensureDefaultEventTypePublic,
  resolveDefaultEventTypeId,
} from '@/lib/workspace-service';
import { mergeAvailabilitySettings } from '@/src/utils/mergeAvailabilitySettings';
import {
  mergeNotificationsSettings,
  mergeMeetingOptionsSettings,
} from '@/src/utils/mergeProviderSettings';
import type { DaySchedule } from '@/src/types/workspace';
import type { provider_availability_entry } from '@/src/utils/availabilityResolution';
import type {
  provider_meeting_options_entry,
  provider_notifications_entry,
} from '@/src/utils/providerSettingsResolution';
import { workspace_meeting_options_to_location_types } from '@/src/utils/meeting_options';

export type onboarding_auth_context = {
  userId: string;
  role: string;
  workspaceId: number;
  meta: Record<string, unknown>;
  token: string;
};

type resolved_department = { id: number; name: string; created: boolean };

function parse_workspace_id(raw: unknown): number | null {
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? parseInt(raw, 10)
        : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function get_or_create_workspace_profession_id(
  supabase: SupabaseClient,
  name: string,
  professionsListId: number | null = null
): Promise<{ id: number | null; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) return { id: null, error: 'Profession name is empty' };

  const lower = trimmed.toLowerCase();

  const backfill = async (professionId: number, current: number | null | undefined) => {
    if (professionsListId == null || current != null) return;
    await supabase
      .from('professions')
      .update({ admin_professions_id: professionsListId })
      .eq('id', professionId)
      .is('admin_professions_id', null);
  };

  const { data: exact } = await supabase
    .from('professions')
    .select('id, admin_professions_id')
    .eq('name', trimmed)
    .maybeSingle();
  if (exact?.id != null) {
    await backfill(exact.id, exact.admin_professions_id as number | null);
    return { id: exact.id };
  }

  const { data: rows, error: listErr } = await supabase.from('professions').select('id, name, admin_professions_id');
  if (listErr) return { id: null, error: listErr.message };

  const hit = (rows ?? []).find((r) => (r.name as string).toLowerCase() === lower);
  if (hit?.id != null) {
    await backfill(hit.id as number, hit.admin_professions_id as number | null);
    return { id: hit.id as number };
  }

  const insertPayload: Record<string, unknown> = { name: trimmed, enabled: true };
  if (professionsListId != null) insertPayload.admin_professions_id = professionsListId;

  const { data: inserted, error } = await supabase
    .from('professions')
    .insert(insertPayload)
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: again } = await supabase
        .from('professions')
        .select('id')
        .ilike('name', trimmed)
        .maybeSingle();
      if (again?.id != null) return { id: again.id as number };
    }
    return { id: null, error: error.message };
  }

  return { id: inserted?.id != null ? (inserted.id as number) : null };
}

export async function resolve_onboarding_auth_context(
  req: NextRequest
): Promise<onboarding_auth_context | { error: string; status: number }> {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || null;
  if (!token) return { error: 'Unauthorized', status: 401 };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) return { error: 'Unauthorized', status: 401 };

  const verifyClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user: jwtUser },
    error: jwtErr,
  } = await verifyClient.auth.getUser(token);
  if (jwtErr || !jwtUser) return { error: 'Unauthorized', status: 401 };

  const supabaseAdmin = createSupabaseServerClient();
  const { data: authRow, error: adminErr } = await supabaseAdmin.auth.admin.getUserById(jwtUser.id);
  if (adminErr || !authRow?.user) return { error: 'Unauthorized', status: 401 };

  const meta = (authRow.user.user_metadata ?? {}) as Record<string, unknown>;
  const role = typeof meta.role === 'string' ? meta.role : '';
  if (role !== ROLE_WORKSPACE_ADMIN && role !== ROLE_SERVICE_PROVIDER) {
    return { error: 'Forbidden', status: 403 };
  }

  if (meta.onboarding_completed === true) {
    return { error: 'Onboarding already completed', status: 409 };
  }

  const workspaceId = parse_workspace_id(meta.workspace_id);
  if (workspaceId == null) {
    return { error: 'Workspace ID not found', status: 400 };
  }

  return { userId: jwtUser.id, role, workspaceId, meta, token };
}

async function update_onboarding_progress(
  supabaseAdmin: SupabaseClient,
  userId: string,
  lastCompletedStep: number,
  extra?: Record<string, unknown>
): Promise<{ error: string | null }> {
  const { data: authRow, error: fetchErr } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (fetchErr || !authRow?.user) return { error: fetchErr?.message ?? 'User not found' };

  const existing = (authRow.user.user_metadata ?? {}) as Record<string, unknown>;
  const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...existing,
      onboarding_last_completed_step: lastCompletedStep,
      ...extra,
    },
  });
  return { error: error?.message ?? null };
}

async function resolve_department_by_name(
  supabase: SupabaseClient,
  workspaceId: number,
  rawName: string,
  existing: { id: number; name: string; flag: boolean }[]
): Promise<resolved_department | null> {
  const trimmedName = rawName.trim();
  if (!trimmedName) return null;
  const lower = trimmedName.toLowerCase();

  const reuse = existing.find((d) => d.name.toLowerCase() === lower);
  if (reuse) {
    if (reuse.flag === false) {
      const { data: restored, error } = await supabase
        .from('departments')
        .update({ flag: true, status: 'active' })
        .eq('id', reuse.id)
        .select('id, name')
        .single();
      if (error || !restored) return null;
      return { id: restored.id as number, name: restored.name as string, created: false };
    }
    return { id: reuse.id, name: reuse.name, created: false };
  }

  const { data, error } = await supabase
    .from('departments')
    .insert({
      workspace_id: workspaceId,
      name: trimmedName,
      description: null,
      meta_data: { services: [] },
      status: 'active',
    })
    .select('id, name')
    .single();

  if (error || !data) return null;
  return { id: data.id as number, name: data.name as string, created: true };
}

async function link_user_departments(
  supabase: SupabaseClient,
  workspaceId: number,
  userId: string,
  departmentIds: number[]
): Promise<{ error: string | null }> {
  const { data: existingLinks, error: linkFetchErr } = await supabase
    .from('user_departments')
    .select('department_id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);

  if (linkFetchErr) return { error: linkFetchErr.message };

  const alreadyLinked = new Set((existingLinks ?? []).map((r) => r.department_id));
  const toInsert = departmentIds
    .filter((id) => !alreadyLinked.has(id))
    .map((department_id) => ({ user_id: userId, department_id, workspace_id: workspaceId }));

  if (toInsert.length === 0) return { error: null };

  const { error: insErr } = await supabase.from('user_departments').insert(toInsert);
  return { error: insErr?.message ?? null };
}

async function persist_departments_for_user(
  supabaseAdmin: SupabaseClient,
  ctx: onboarding_auth_context,
  names: string[]
): Promise<{ error: string | null }> {
  const uniqueNames: string[] = [];
  const seen = new Set<string>();
  for (const n of names.map((x) => x.trim()).filter(Boolean)) {
    const lower = n.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    uniqueNames.push(n);
  }

  if (uniqueNames.length === 0) {
    return { error: 'At least one department is required' };
  }

  const { data: existingRows, error: existingErr } = await supabaseAdmin
    .from('departments')
    .select('id, name, flag')
    .eq('workspace_id', ctx.workspaceId);

  if (existingErr) return { error: existingErr.message };

  const existing = (existingRows ?? []) as { id: number; name: string; flag: boolean }[];
  const resolved: resolved_department[] = [];

  for (const deptName of uniqueNames) {
    const row = await resolve_department_by_name(supabaseAdmin, ctx.workspaceId, deptName, existing);
    if (!row) return { error: `Failed to create department "${deptName}"` };
    resolved.push(row);
    if (!existing.some((d) => d.id === row.id)) {
      existing.push({ id: row.id, name: row.name, flag: true });
    }
  }

  const linkErr = await link_user_departments(
    supabaseAdmin,
    ctx.workspaceId,
    ctx.userId,
    resolved.map((r) => r.id)
  );
  return { error: linkErr.error };
}

async function persist_admin_profession(
  supabaseAdmin: SupabaseClient,
  workspaceId: number,
  body: {
    professions_list_id?: number;
    custom_profession?: string;
  }
): Promise<{ error: string | null }> {
  const updateData: { type?: string; profession_id?: number } = {};

  if (body.professions_list_id != null) {
    const lid = Number(body.professions_list_id);
    if (!Number.isFinite(lid) || lid <= 0) return { error: 'Invalid professions_list_id' };

    const { data: listRow, error: listErr } = await supabaseAdmin
      .from('professions_list')
      .select('name, enabled')
      .eq('id', lid)
      .maybeSingle();

    if (listErr || !listRow?.name) return { error: 'Profession catalog entry not found' };
    if (listRow.enabled === false) return { error: 'This profession is not available for selection' };

    const resolved = await get_or_create_workspace_profession_id(supabaseAdmin, listRow.name, lid);
    if (resolved.id == null) return { error: resolved.error ?? 'Could not assign profession' };

    updateData.type = listRow.name;
    updateData.profession_id = resolved.id;
  } else if (body.custom_profession?.trim()) {
    const label = body.custom_profession.trim();
    const resolved = await get_or_create_workspace_profession_id(supabaseAdmin, label);
    if (resolved.id == null) return { error: resolved.error ?? 'Could not assign profession' };
    updateData.type = label;
    updateData.profession_id = resolved.id;
  } else {
    return { error: 'Profession is required' };
  }

  const { error } = await supabaseAdmin
    .from('workspaces')
    .update(updateData)
    .eq('id', workspaceId);

  return { error: error?.message ?? null };
}

async function save_admin_availability(
  supabaseAdmin: SupabaseClient,
  workspaceId: number,
  timesheet: Record<string, DaySchedule>
): Promise<{ error: string | null }> {
  const { data: existingConfig, error: fetchError } = await supabaseAdmin
    .from('configurations')
    .select('settings')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    return { error: fetchError.message };
  }

  const existingSettings = (existingConfig?.settings ?? {}) as Record<string, unknown>;
  const mergedSettings = {
    ...existingSettings,
    availability: mergeAvailabilitySettings(
      (existingSettings.availability ?? {}) as Record<string, unknown>,
      { timesheet }
    ),
  };

  if (existingConfig) {
    const { error } = await supabaseAdmin
      .from('configurations')
      .update({ settings: mergedSettings })
      .eq('workspace_id', workspaceId);
    return { error: error?.message ?? null };
  }

  const { error } = await supabaseAdmin.from('configurations').insert({
    workspace_id: workspaceId,
    settings: mergedSettings,
  });
  return { error: error?.message ?? null };
}

async function save_provider_availability(
  supabaseAdmin: SupabaseClient,
  ctx: onboarding_auth_context,
  timesheet: Record<string, DaySchedule>
): Promise<{ error: string | null }> {
  const { data: existingConfig, error: fetchError } = await supabaseAdmin
    .from('configurations')
    .select('settings')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    return { error: fetchError.message };
  }

  const existingSettings = (existingConfig?.settings ?? {}) as Record<string, unknown>;
  const existingAvailability = (existingSettings.availability ?? {}) as Record<string, unknown>;
  const existingProviders = (existingAvailability.providers ?? {}) as Record<string, unknown>;
  const existingEntry = existingProviders[ctx.userId] as Record<string, unknown> | undefined;

  const providerEntry = {
    ...(existingEntry ?? {}),
    timesheet,
    lastUpdated: new Date().toISOString(),
  };

  const mergedSettings = {
    ...existingSettings,
    availability: mergeAvailabilitySettings(existingAvailability, {
      providers: {
        ...existingProviders,
        [ctx.userId]: providerEntry,
      } as Record<string, provider_availability_entry>,
    }),
  };

  let saveError;
  if (existingConfig) {
    const { error } = await supabaseAdmin
      .from('configurations')
      .update({ settings: mergedSettings })
      .eq('workspace_id', ctx.workspaceId);
    saveError = error;
  } else {
    const { error } = await supabaseAdmin.from('configurations').insert({
      workspace_id: ctx.workspaceId,
      settings: mergedSettings,
    });
    saveError = error;
  }

  if (saveError) return { error: saveError.message };

  const { error: etErr } = await createServiceProviderEventType(supabaseAdmin, {
    workspaceId: ctx.workspaceId,
    ownerId: ctx.userId,
  });
  if (etErr) return { error: etErr };

  const { error: defaultsErr } = await ensureServiceProviderSettingsDefaults(
    supabaseAdmin,
    ctx.workspaceId,
    ctx.userId
  );
  return { error: defaultsErr };
}

export async function apply_onboarding_step1(
  ctx: onboarding_auth_context,
  body: {
    department_names: string[];
    professions_list_id?: number;
    custom_profession?: string;
  }
): Promise<{ error: string | null }> {
  const supabaseAdmin = createSupabaseServerClient();

  if (ctx.role === ROLE_WORKSPACE_ADMIN) {
    const profErr = await persist_admin_profession(supabaseAdmin, ctx.workspaceId, {
      professions_list_id: body.professions_list_id,
      custom_profession: body.custom_profession,
    });
    if (profErr.error) return profErr;
  }

  const deptErr = await persist_departments_for_user(
    supabaseAdmin,
    ctx,
    body.department_names
  );
  if (deptErr.error) return deptErr;

  const extra: Record<string, unknown> = {};
  if (ctx.role === ROLE_SERVICE_PROVIDER) {
    extra.pending_department_ids = null;
    extra.pending_department_names = null;
  }

  return update_onboarding_progress(supabaseAdmin, ctx.userId, 1, extra);
}

export async function apply_onboarding_step2(
  ctx: onboarding_auth_context
): Promise<{ error: string | null }> {
  const supabaseAdmin = createSupabaseServerClient();

  if (ctx.role === ROLE_SERVICE_PROVIDER) {
    const { error } = await ensureServiceProviderSettingsDefaults(
      supabaseAdmin,
      ctx.workspaceId,
      ctx.userId
    );
    if (error) return { error };
  }

  return update_onboarding_progress(supabaseAdmin, ctx.userId, 2);
}

export async function apply_onboarding_step3(
  ctx: onboarding_auth_context,
  timesheet: Record<string, DaySchedule>
): Promise<{ error: string | null }> {
  const supabaseAdmin = createSupabaseServerClient();

  const saveErr =
    ctx.role === ROLE_SERVICE_PROVIDER
      ? await save_provider_availability(supabaseAdmin, ctx, timesheet)
      : await save_admin_availability(supabaseAdmin, ctx.workspaceId, timesheet);

  if (saveErr.error) return saveErr;

  return update_onboarding_progress(supabaseAdmin, ctx.userId, 3);
}

const SP_DEFAULT_NOTIFICATIONS = {
  'sms-reminder': true,
  'email-reminder': true,
  'auto-confirm-booking': true,
  'post-meeting-follow-up': true,
  whatsapp: true,
  'whatsapp-user': true,
} as const;

async function save_admin_meeting_options(
  supabaseAdmin: SupabaseClient,
  workspaceId: number,
  meetingOptions: Record<string, boolean>
): Promise<{ error: string | null }> {
  const { data: existingConfig, error: fetchError } = await supabaseAdmin
    .from('configurations')
    .select('settings')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    return { error: fetchError.message };
  }

  const existingSettings = (existingConfig?.settings ?? {}) as Record<string, unknown>;
  const mergedSettings = {
    ...existingSettings,
    meeting_options: mergeMeetingOptionsSettings(
      (existingSettings.meeting_options ?? {}) as Record<string, unknown>,
      meetingOptions
    ),
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

  if (saveError) return { error: saveError.message };

  await ensureDefaultEventTypePublic(supabaseAdmin, workspaceId);
  const location_types = workspace_meeting_options_to_location_types(meetingOptions);
  if (location_types.length > 0) {
    const defaultEventId = await resolveDefaultEventTypeId(supabaseAdmin, workspaceId);
    if (defaultEventId != null) {
      await supabaseAdmin
        .from('event_types')
        .update({ location_type: location_types.join(','), is_public: true })
        .eq('id', defaultEventId)
        .eq('workspace_id', workspaceId);
    }
  }

  return { error: null };
}

async function save_provider_meeting_options(
  supabaseAdmin: SupabaseClient,
  ctx: onboarding_auth_context,
  meetingOptions: Record<string, boolean>
): Promise<{ error: string | null }> {
  const { data: existingConfig, error: fetchError } = await supabaseAdmin
    .from('configurations')
    .select('settings')
    .eq('workspace_id', ctx.workspaceId)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    return { error: fetchError.message };
  }

  const existingSettings = (existingConfig?.settings ?? {}) as Record<string, unknown>;
  const existingNotifications = (existingSettings.notifications ?? {}) as Record<string, unknown>;
  const existingMeeting = (existingSettings.meeting_options ?? {}) as Record<string, unknown>;
  const notifProviders = (existingNotifications.providers ?? {}) as Record<string, unknown>;
  const meetingProviders = (existingMeeting.providers ?? {}) as Record<string, unknown>;
  const now = new Date().toISOString();

  const defaultNotifications = getDefaultNotificationSettings();
  const notifEntry: provider_notifications_entry = {
    ...(notifProviders[ctx.userId] as provider_notifications_entry | undefined),
    ...SP_DEFAULT_NOTIFICATIONS,
    lastUpdated: now,
  };
  const meetingEntry: provider_meeting_options_entry = {
    ...(meetingProviders[ctx.userId] as provider_meeting_options_entry | undefined),
    ...meetingOptions,
    lastUpdated: now,
  };

  const mergedSettings = {
    ...existingSettings,
    notifications: mergeNotificationsSettings(existingNotifications, {
      providers: {
        ...notifProviders,
        [ctx.userId]: notifEntry,
      } as Record<string, provider_notifications_entry>,
    }),
    meeting_options: mergeMeetingOptionsSettings(existingMeeting, {
      providers: {
        ...meetingProviders,
        [ctx.userId]: meetingEntry,
      } as Record<string, provider_meeting_options_entry>,
    }),
  };

  let saveError;
  if (existingConfig) {
    const { error } = await supabaseAdmin
      .from('configurations')
      .update({ settings: mergedSettings })
      .eq('workspace_id', ctx.workspaceId);
    saveError = error;
  } else {
    const { error } = await supabaseAdmin.from('configurations').insert({
      workspace_id: ctx.workspaceId,
      settings: mergedSettings,
    });
    saveError = error;
  }

  if (saveError) return { error: saveError.message };

  const { error: etErr } = await createServiceProviderEventType(supabaseAdmin, {
    workspaceId: ctx.workspaceId,
    ownerId: ctx.userId,
  });
  return { error: etErr };
}

export async function apply_onboarding_complete(
  ctx: onboarding_auth_context,
  meetingOptions: Record<string, boolean>
): Promise<{ error: string | null }> {
  const supabaseAdmin = createSupabaseServerClient();

  const lastDoneRaw = ctx.meta.onboarding_last_completed_step;
  const lastDone =
    typeof lastDoneRaw === 'number'
      ? lastDoneRaw
      : typeof lastDoneRaw === 'string'
        ? parseInt(lastDoneRaw, 10)
        : 0;

  if (!Number.isFinite(lastDone) || lastDone < 3) {
    return { error: 'Complete steps 1–3 before finishing onboarding' };
  }

  const meetingErr =
    ctx.role === ROLE_SERVICE_PROVIDER
      ? await save_provider_meeting_options(supabaseAdmin, ctx, meetingOptions)
      : await save_admin_meeting_options(supabaseAdmin, ctx.workspaceId, meetingOptions);

  if (meetingErr.error) return meetingErr;

  if (ctx.role === ROLE_SERVICE_PROVIDER) {
    const { error: etErr } = await createServiceProviderEventType(supabaseAdmin, {
      workspaceId: ctx.workspaceId,
      ownerId: ctx.userId,
    });
    if (etErr) return { error: etErr };
  }

  const extra: Record<string, unknown> = { onboarding_completed: true };
  if (ctx.role === ROLE_SERVICE_PROVIDER) {
    extra.pending_department_ids = null;
    extra.pending_department_names = null;
  }

  const progressErr = await update_onboarding_progress(supabaseAdmin, ctx.userId, 4, extra);
  if (progressErr.error) return progressErr;

  return { error: null };
}

export async function sync_sp_event_type_location_deferred(
  ctx: onboarding_auth_context
): Promise<void> {
  if (ctx.role !== ROLE_SERVICE_PROVIDER) return;
  const supabaseAdmin = createSupabaseServerClient();
  await syncServiceProviderEventTypeLocation(supabaseAdmin, ctx.workspaceId, ctx.userId);
}
