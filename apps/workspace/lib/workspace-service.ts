import { SupabaseClient } from '@supabase/supabase-js';
import { ROLE_SERVICE_PROVIDER } from '@/src/constants/roles';

export function getDefaultConfigurationSettings(workspaceName: string) {
  return {
    general: {
      logoUrl: null,
      accentColor: '#1de4a9',
      accountName: workspaceName,
      primaryColor: '#4b39f4',
    },
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
      "whatsapp": true,
      "whatsapp-user": true,
    },
  };
}

export interface CreateWorkspaceParams {
  userId: string;
  userName: string;
  userEmail: string;
  supabaseAdmin: SupabaseClient;
}

export interface WorkspaceResult {
  workspaceId: number;
  isNewWorkspace: boolean;
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
  const { userId, userName, userEmail, supabaseAdmin } = params;

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

    // Insert default configuration
    const defaultSettings = getDefaultConfigurationSettings(workspaceName);
    const { error: configError } = await supabaseAdmin
      .from('configurations')
      .insert({
        workspace_id: workspace.id,
        settings: defaultSettings,
      });

    if (configError) {
      console.error('Configuration creation error:', configError);
      // Clean up workspace
      await supabaseAdmin.from('workspaces').delete().eq('id', workspace.id);
      return { data: null, error: 'Failed to create configuration' };
    }

    // Create default event type
    const { error: eventTypeError } = await supabaseAdmin.from('event_types').insert({
      workspace_id: workspace.id,
      owner_id: userId,
      title: '30mins-chat',
      slug: '30mins-chat',
      duration_minutes: 30,
      buffer_before: null,
      buffer_after: null,
      location_type: null,
      location_value: null,
      is_public: true,
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
