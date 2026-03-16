import { SupabaseClient } from '@supabase/supabase-js';

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

/**
 * Get or create workspace for a user. Ensures one user has only one workspace.
 */
export async function getOrCreateWorkspace(
  params: CreateWorkspaceParams
): Promise<{ data: WorkspaceResult | null; error: string | null }> {
  const { userId, userName, userEmail, supabaseAdmin } = params;

  try {
    // Check if workspace already exists for this user
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
      is_public: false,
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
 * Update user metadata with workspace information
 */
export async function updateUserWorkspaceMetadata(
  userId: string,
  workspaceId: number,
  additionalMetadata: Record<string, any>,
  supabaseAdmin: SupabaseClient
): Promise<{ error: string | null }> {
  try {
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
    const existingMeta = userData?.user?.user_metadata ?? {};

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...existingMeta,
        ...additionalMetadata,
        workspace_id: workspaceId,
        role: 'workspace_admin',
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
