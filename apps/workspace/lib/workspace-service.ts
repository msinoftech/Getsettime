import { SupabaseClient } from '@supabase/supabase-js';
import { assignFreePlanToWorkspace } from '@app/db/subscription';
import { getTimezoneForCountry } from '@app/location';
import { ROLE_SERVICE_PROVIDER } from '@/src/constants/roles';
import { resolveMeetingOptionsForServiceProvider } from '@/src/utils/providerSettingsResolution';
import { workspace_meeting_options_to_location_types } from '@/src/utils/meeting_options';
import type { localization_settings } from '@/src/types/workspace';
import type { IpapiJsonResponse } from '@/lib/ipapi-geo';

export type RegistrationGeoInput = {
  ipapi?: IpapiJsonResponse | null;
  edgeCountry?: string | null;
  browserTimezone?: string | null;
};

export function buildLocalizationFromIpapi(
  ipapi: IpapiJsonResponse | null | undefined,
  edgeCountry?: string | null
): localization_settings | undefined {
  if (ipapi && !ipapi.error) {
    const { error: _apiError, ...snapshot } = ipapi;
    return {
      ...snapshot,
      fetched_at: new Date().toISOString(),
    };
  }
  if (edgeCountry) {
    return {
      country_code: edgeCountry,
      fetched_at: new Date().toISOString(),
      error: 'geo_unavailable',
    };
  }
  return undefined;
}

export function resolveRegistrationTimezone(geo: RegistrationGeoInput): string {
  const fromIpapi = geo.ipapi?.timezone?.trim();
  if (fromIpapi) return fromIpapi;
  const browser = geo.browserTimezone?.trim();
  if (browser) return browser;
  const country = geo.ipapi?.country_code?.toUpperCase() ?? geo.edgeCountry?.toUpperCase();
  if (country) {
    const mapped = getTimezoneForCountry(country);
    if (mapped) return mapped;
  }
  return '';
}

export function getDefaultConfigurationSettings(
  workspaceName: string,
  registrationGeo?: RegistrationGeoInput
) {
  const timezone = registrationGeo
    ? resolveRegistrationTimezone(registrationGeo)
    : '';
  const localization = registrationGeo
    ? buildLocalizationFromIpapi(registrationGeo.ipapi, registrationGeo.edgeCountry)
    : undefined;

  return {
    general: {
      logoUrl: null,
      accentColor: '#1de4a9',
      accountName: workspaceName,
      primaryColor: '#4b39f4',
      ...(timezone ? { timezone } : {}),
    },
    ...(localization ? { localization } : {}),
    intake_form: {
      name: true,
      email: true,
      phone: true,
      services: {
        enabled: false,
        allowed_service_ids: [],
      },
      custom_fields: [],
      additional_description: true,
    },
    availability: {},
    notifications: {
      'sms-reminder': true,
      'email-reminder': true,
      'auto-confirm-booking': true,
      'post-meeting-follow-up': true,
      'whatsapp': false,
      'whatsapp-user': true,
    },
  };
}

/** Default notification flags for new workspaces and service providers (onboarding). */
export function getDefaultNotificationSettings(): Record<string, boolean> {
  return { ...getDefaultConfigurationSettings('').notifications };
}

export interface CreateWorkspaceParams {
  userId: string;
  userName: string;
  userEmail: string;
  supabaseAdmin: SupabaseClient;
  registrationGeo?: RegistrationGeoInput;
}

export interface WorkspaceResult {
  workspaceId: number;
  isNewWorkspace: boolean;
}

export const DEFAULT_EVENT_TYPE_SLUG = '30mins-chat';

/** Canonical onboarding default: `30mins-chat`, else earliest event type in the workspace. */
export async function resolveDefaultEventTypeId(
  supabase: SupabaseClient,
  workspaceId: number
): Promise<number | null> {
  const wid = typeof workspaceId === 'number' ? workspaceId : Number(workspaceId);
  if (!Number.isFinite(wid)) return null;

  const { data: slugRow } = await supabase
    .from('event_types')
    .select('id')
    .eq('workspace_id', wid)
    .eq('slug', DEFAULT_EVENT_TYPE_SLUG)
    .maybeSingle();

  if (slugRow && typeof (slugRow as { id?: unknown }).id === 'number') {
    return (slugRow as { id: number }).id;
  }

  const { data: firstRow } = await supabase
    .from('event_types')
    .select('id')
    .eq('workspace_id', wid)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstRow && typeof (firstRow as { id?: unknown }).id === 'number') {
    return (firstRow as { id: number }).id;
  }

  return null;
}

/** Onboarding default event types must be bookable (public). */
export async function ensureDefaultEventTypePublic(
  supabase: SupabaseClient,
  workspaceId: number
): Promise<void> {
  const eventId = await resolveDefaultEventTypeId(supabase, workspaceId);
  if (eventId == null) return;

  const wid = typeof workspaceId === 'number' ? workspaceId : Number(workspaceId);
  const { error } = await supabase
    .from('event_types')
    .update({ is_public: true })
    .eq('id', eventId)
    .eq('workspace_id', wid);

  if (error) {
    console.warn('ensureDefaultEventTypePublic (non-critical):', error);
  }
}

export type accepted_invite_resolution = {
  workspaceId: number;
  role: string;
};

/** Latest accepted invite for this email (authoritative when JWT metadata lags). */
export async function resolveAcceptedInviteForEmail(
  supabaseAdmin: SupabaseClient,
  email: string
): Promise<accepted_invite_resolution | null> {
  const trimmed = email.trim();
  if (!trimmed) return null;

  const { data: rows, error } = await supabaseAdmin
    .from('invites')
    .select('workspace_id, role, email, used_at')
    .eq('used', true)
    .order('used_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('resolveAcceptedInviteForEmail:', error);
    return null;
  }

  const normalized = trimmed.toLowerCase();
  const match = (rows ?? []).find(
    (row) =>
      typeof row.email === 'string' && row.email.trim().toLowerCase() === normalized
  );
  if (!match) return null;

  const workspaceId = Number(match.workspace_id);
  const role = typeof match.role === 'string' ? match.role.trim() : '';
  if (!Number.isFinite(workspaceId) || workspaceId <= 0 || !role) return null;

  return { workspaceId, role };
}

/** Apply invite workspace + role to auth metadata (does not create a workspace row). */
export async function syncInvitedUserWorkspaceMetadata(
  userId: string,
  invite: accepted_invite_resolution,
  supabaseAdmin: SupabaseClient
): Promise<{ error: string | null }> {
  const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
  const existingMeta = (userData?.user?.user_metadata ?? {}) as Record<string, unknown>;

  const patch: Record<string, unknown> = {
    ...existingMeta,
    workspace_id: invite.workspaceId,
    role: invite.role,
    invited_at:
      typeof existingMeta.invited_at === 'string' && existingMeta.invited_at
        ? existingMeta.invited_at
        : new Date().toISOString(),
  };

  if (invite.role === ROLE_SERVICE_PROVIDER && existingMeta.onboarding_completed === undefined) {
    patch.onboarding_completed = false;
    patch.onboarding_last_completed_step = 0;
  }

  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    user_metadata: patch,
  });

  if (updateError) {
    console.error('syncInvitedUserWorkspaceMetadata:', updateError);
    return { error: updateError.message };
  }
  return { error: null };
}

/**
 * Get or create workspace for a user. Ensures one user has only one workspace.
 */
function parseMetadataWorkspaceId(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

export async function getOrCreateWorkspace(
  params: CreateWorkspaceParams
): Promise<{ data: WorkspaceResult | null; error: string | null }> {
  const { userId, userName, userEmail, supabaseAdmin, registrationGeo } = params;

  try {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const meta = (userData?.user?.user_metadata ?? {}) as Record<string, unknown>;

    const acceptedInvite = userEmail
      ? await resolveAcceptedInviteForEmail(supabaseAdmin, userEmail)
      : null;
    if (acceptedInvite) {
      return {
        data: { workspaceId: acceptedInvite.workspaceId, isNewWorkspace: false },
        error: null,
      };
    }

    const metaWorkspaceId = parseMetadataWorkspaceId(meta.workspace_id);
    if (Number.isFinite(metaWorkspaceId) && metaWorkspaceId > 0) {
      const { data: memberWorkspace } = await supabaseAdmin
        .from('workspaces')
        .select('id')
        .eq('id', metaWorkspaceId)
        .maybeSingle();
      if (memberWorkspace?.id) {
        return {
          data: { workspaceId: memberWorkspace.id, isNewWorkspace: false },
          error: null,
        };
      }
    }

    const invitedRole = typeof meta.role === 'string' ? meta.role : '';
    const invitedAt = meta.invited_at;
    const isInvitedMember =
      (typeof invitedAt === 'string' && invitedAt.trim() !== '') || invitedAt != null;
    if (
      isInvitedMember ||
      invitedRole === 'service_provider' ||
      invitedRole === 'manager' ||
      invitedRole === 'staff' ||
      invitedRole === 'customer'
    ) {
      return {
        data: null,
        error: 'Invited team members cannot create a personal workspace',
      };
    }

    // Check if workspace already exists for this user (workspace owner)
    const { data: existingWorkspace } = await supabaseAdmin
      .from('workspaces')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    if (existingWorkspace?.id) {
      await ensureDefaultEventTypePublic(supabaseAdmin, existingWorkspace.id);
      return {
        data: { workspaceId: existingWorkspace.id, isNewWorkspace: false },
        error: null,
      };
    }

    // Create new workspace
    const workspaceName = `${userName}'s Workspace`;
    const workspaceSlug = `${userEmail.split('@')[0]}-${Date.now()}`
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '');

    const { data: workspace, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .insert({
        name: workspaceName,
        slug: workspaceSlug,
        user_id: userId,
      })
      .select('id')
      .single();

    if (workspaceError || !workspace) {
      console.error('Workspace creation error:', workspaceError);
      return { data: null, error: 'Failed to create workspace' };
    }

    // Insert default configuration (includes localization + timezone from registration geo)
    const defaultSettings = getDefaultConfigurationSettings(workspaceName, registrationGeo);
    const { error: configError } = await supabaseAdmin
      .from('configurations')
      .insert({
        workspace_id: workspace.id,
        settings: defaultSettings,
      });

    if (configError) {
      console.error('Configuration creation error:', configError);
      await supabaseAdmin.from('workspaces').delete().eq('id', workspace.id);
      return { data: null, error: 'Failed to create configuration' };
    }

    try {
      await assignFreePlanToWorkspace(supabaseAdmin, workspace.id);
    } catch (subErr) {
      console.error('Subscription assignment error:', subErr);
      await supabaseAdmin.from('configurations').delete().eq('workspace_id', workspace.id);
      await supabaseAdmin.from('workspaces').delete().eq('id', workspace.id);
      return { data: null, error: 'Failed to assign subscription plan' };
    }

    // Create default event type
    const { error: eventTypeError } = await supabaseAdmin.from('event_types').insert({
      workspace_id: workspace.id,
      owner_id: userId,
      title: DEFAULT_EVENT_TYPE_SLUG,
      slug: DEFAULT_EVENT_TYPE_SLUG,
      duration_minutes: 30,
      buffer_before: null,
      buffer_after: null,
      location_type: null,
      location_value: null,
      is_public: true,
      status: 'active',
      settings: null,
    });

    if (eventTypeError) {
      console.warn('Default event type creation (non-critical):', eventTypeError);
    }

    return {
      data: { workspaceId: workspace.id, isNewWorkspace: true },
      error: null,
    };
  } catch (err) {
    console.error('getOrCreateWorkspace error:', err);
    return {
      data: null,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

async function resolveUniqueEventTypeSlugForWorkspace(
  supabase: SupabaseClient,
  workspaceId: number,
  baseSlug: string
): Promise<string> {
  const { data: rows, error } = await supabase
    .from('event_types')
    .select('slug')
    .eq('workspace_id', workspaceId);

  if (error) {
    console.warn('resolveUniqueEventTypeSlugForWorkspace:', error);
    return baseSlug;
  }

  const taken = new Set<string>();
  for (const row of rows ?? []) {
    const s = (row as { slug?: string }).slug;
    if (typeof s === 'string' && s.length > 0) taken.add(s);
  }

  let candidate = baseSlug;
  let n = 0;
  while (taken.has(candidate)) {
    n += 1;
    candidate = `${baseSlug}-${n}`;
  }
  return candidate;
}

/**
 * Creates a dedicated public event type for a service provider (onboarding completion).
 * Never reuses workspace-default rows owned by another user.
 */
export async function createServiceProviderEventType(
  supabase: SupabaseClient,
  params: { workspaceId: number; ownerId: string }
): Promise<{ data: { id: number } | null; error: string | null }> {
  const wid = params.workspaceId;
  const ownerId = params.ownerId.trim();
  if (!Number.isFinite(wid) || wid <= 0 || !ownerId) {
    return { data: null, error: 'Invalid workspace or owner' };
  }

  const { data: existing, error: existingErr } = await supabase
    .from('event_types')
    .select('id')
    .eq('workspace_id', wid)
    .eq('owner_id', ownerId)
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingErr) {
    console.error('createServiceProviderEventType lookup:', existingErr);
    return { data: null, error: existingErr.message };
  }

  if (existing && typeof (existing as { id?: unknown }).id === 'number') {
    return { data: { id: (existing as { id: number }).id }, error: null };
  }

  const slugBase = `${DEFAULT_EVENT_TYPE_SLUG}-${ownerId.replace(/-/g, '').slice(0, 8)}`;
  const slug = await resolveUniqueEventTypeSlugForWorkspace(supabase, wid, slugBase);

  const { data, error } = await supabase
    .from('event_types')
    .insert({
      workspace_id: wid,
      owner_id: ownerId,
      title: DEFAULT_EVENT_TYPE_SLUG,
      slug,
      duration_minutes: 30,
      buffer_before: null,
      buffer_after: null,
      location_type: null,
      location_value: null,
      is_public: true,
      status: 'active',
      settings: null,
    })
    .select('id')
    .single();

  if (error || !data) {
    console.error('createServiceProviderEventType insert:', error);
    return { data: null, error: error?.message ?? 'Failed to create event type' };
  }

  const id = (data as { id: number }).id;
  return { data: { id }, error: null };
}

/**
 * Sets location_type on the service provider's event type from meeting_options.providers[ownerId].
 */
export async function syncServiceProviderEventTypeLocation(
  supabase: SupabaseClient,
  workspaceId: number,
  ownerId: string
): Promise<{ error: string | null }> {
  const wid = typeof workspaceId === 'number' ? workspaceId : Number(workspaceId);
  const providerId = ownerId.trim();
  if (!Number.isFinite(wid) || wid <= 0 || !providerId) {
    return { error: 'Invalid workspace or owner' };
  }

  const { data: configRow, error: configErr } = await supabase
    .from('configurations')
    .select('settings')
    .eq('workspace_id', wid)
    .maybeSingle();

  if (configErr && configErr.code !== 'PGRST116') {
    return { error: configErr.message };
  }

  const settings = (configRow?.settings ?? {}) as Record<string, unknown>;
  const meetingOptions = resolveMeetingOptionsForServiceProvider(
    settings.meeting_options as Record<string, unknown> | undefined,
    providerId
  );
  const location_types =
    workspace_meeting_options_to_location_types(meetingOptions);
  if (location_types.length === 0) {
    return { error: null };
  }
  const location_type = location_types.join(',');

  const { error: updateErr } = await supabase
    .from('event_types')
    .update({ location_type, is_public: true })
    .eq('workspace_id', wid)
    .eq('owner_id', providerId);

  if (updateErr) {
    console.warn('syncServiceProviderEventTypeLocation:', updateErr);
    return { error: updateErr.message };
  }

  return { error: null };
}

/**
 * Ensures default per-provider notifications (and optional meeting_options) exist under settings.*.providers[userId].
 */
export async function ensureServiceProviderSettingsDefaults(
  supabase: SupabaseClient,
  workspaceId: number,
  providerUserId: string,
  options?: { meeting_options?: Record<string, boolean> }
): Promise<{ error: string | null }> {
  const wid = typeof workspaceId === 'number' ? workspaceId : Number(workspaceId);
  const ownerId = providerUserId.trim();
  if (!Number.isFinite(wid) || wid <= 0 || !ownerId) {
    return { error: 'Invalid workspace or provider' };
  }

  const { data: existingConfig, error: fetchError } = await supabase
    .from('configurations')
    .select('settings')
    .eq('workspace_id', wid)
    .maybeSingle();

  if (fetchError && fetchError.code !== 'PGRST116') {
    return { error: fetchError.message };
  }

  const existingSettings = (existingConfig?.settings ?? {}) as Record<string, unknown>;
  const existingNotifications = (existingSettings.notifications ?? {}) as Record<string, unknown>;
  const existingMeeting = (existingSettings.meeting_options ?? {}) as Record<string, unknown>;
  const notifProviders = (existingNotifications.providers ?? {}) as Record<string, unknown>;
  const meetingProviders = (existingMeeting.providers ?? {}) as Record<string, unknown>;

  const defaultNotifications = getDefaultNotificationSettings();
  const now = new Date().toISOString();
  let changed = false;

  const nextNotifProviders = { ...notifProviders };
  if (!nextNotifProviders[ownerId]) {
    nextNotifProviders[ownerId] = { ...defaultNotifications, lastUpdated: now };
    changed = true;
  }

  const nextMeetingProviders = { ...meetingProviders };
  if (options?.meeting_options && !nextMeetingProviders[ownerId]) {
    nextMeetingProviders[ownerId] = {
      ...options.meeting_options,
      lastUpdated: now,
    };
    changed = true;
  }

  if (!changed) return { error: null };

  const mergedSettings = {
    ...existingSettings,
    notifications: { ...existingNotifications, providers: nextNotifProviders },
    meeting_options: { ...existingMeeting, providers: nextMeetingProviders },
  };

  if (existingConfig) {
    const { error } = await supabase
      .from('configurations')
      .update({ settings: mergedSettings })
      .eq('workspace_id', wid);
    return { error: error?.message ?? null };
  }

  const { error } = await supabase.from('configurations').insert({
    workspace_id: wid,
    settings: mergedSettings,
  });
  return { error: error?.message ?? null };
}

/**
 * Update user metadata with workspace information.
 * When isNewWorkspace is true the user is the original creator and gets
 * the immutable `is_workspace_owner` flag.
 */
export async function updateUserWorkspaceMetadata(
  userId: string,
  workspaceId: number,
  additionalMetadata: Record<string, any>,
  supabaseAdmin: SupabaseClient,
  isNewWorkspace = false
): Promise<{ error: string | null }> {
  try {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const existingMeta = userData?.user?.user_metadata ?? {};

    const existingRole =
      typeof existingMeta.role === 'string' && existingMeta.role.trim() !== ''
        ? existingMeta.role
        : undefined;
    const additionalRole =
      typeof additionalMetadata.role === 'string' && additionalMetadata.role.trim() !== ''
        ? additionalMetadata.role
        : undefined;
    const role = isNewWorkspace
      ? 'workspace_admin'
      : (existingRole ?? additionalRole ?? 'workspace_admin');

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...existingMeta,
        ...additionalMetadata,
        workspace_id: workspaceId,
        role,
        ...(isNewWorkspace
          ? { is_workspace_owner: true, additional_roles: [ROLE_SERVICE_PROVIDER] }
          : {}),
      },
    });

    if (updateError) {
      console.error('User metadata update error:', updateError);
      return { error: 'Failed to update user metadata' };
    }

    return { error: null };
  } catch (err) {
    console.error('updateUserWorkspaceMetadata error:', err);
    return {
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}
