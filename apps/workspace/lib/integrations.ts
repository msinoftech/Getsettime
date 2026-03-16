import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = (
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
  ''
).trim();

const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export type IntegrationType = 'google_calendar' | 'zoom';

const TYPE_TO_PROVIDER: Record<IntegrationType, string> = {
  google_calendar: 'google_calendar',
  zoom: 'zoom',
};

export interface Integration {
  id?: number;
  workspace_id: number;
  provider: string;
  provider_user_id?: string | null;
  credentials: { access_token: string; refresh_token?: string; expires_at?: number };
  config?: Record<string, unknown>;
}

export interface IntegrationRow {
  id: number;
  workspace_id: number | null;
  provider: string;
  provider_user_id: string | null;
  credentials: Record<string, unknown> | null;
  config: Record<string, unknown> | null;
}

/**
 * Get integration for a workspace by type
 */
export async function getIntegration(
  workspaceId: number,
  type: IntegrationType
): Promise<(Integration & { access_token: string }) | null> {
  if (!supabaseAdmin) return null;
  const provider = TYPE_TO_PROVIDER[type];

  const { data, error } = await supabaseAdmin
    .from('integrations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('provider', provider)
    .maybeSingle();

  if (error || !data) return null;
  const creds = (data.credentials as Record<string, unknown>) ?? {};
  const accessToken = creds.access_token as string;
  if (!accessToken) return null;

  return {
    id: data.id,
    workspace_id: data.workspace_id!,
    provider: data.provider,
    provider_user_id: data.provider_user_id,
    credentials: creds as { access_token: string; refresh_token?: string; expires_at?: number },
    config: (data.config as Record<string, unknown>) ?? undefined,
    access_token: accessToken,
  };
}

export interface SaveIntegrationResult {
  ok: boolean;
  error?: string;
}

/**
 * Save or update integration (workspace-scoped)
 */
export async function saveIntegration(params: {
  workspace_id: number;
  type: IntegrationType;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  metadata?: Record<string, unknown>;
  provider_user_id?: string;
}): Promise<SaveIntegrationResult> {
  if (!supabaseAdmin) {
    const msg = 'Supabase admin client not configured (SUPABASE_SERVICE_ROLE_KEY missing?)';
    console.error(msg);
    return { ok: false, error: msg };
  }

  const { workspace_id, type, access_token, refresh_token, expires_at, metadata, provider_user_id } = params;
  const provider = TYPE_TO_PROVIDER[type];

  const credentials = {
    access_token,
    ...(refresh_token != null && { refresh_token }),
    ...(expires_at != null && { expires_at }),
  };

  const config = metadata ?? {};

  const { data: existing, error: selectError } = await supabaseAdmin
    .from('integrations')
    .select('id')
    .eq('workspace_id', workspace_id)
    .eq('provider', provider)
    .maybeSingle();

  if (selectError) {
    const msg = `Select failed: ${selectError.message} (${selectError.code})`;
    console.error('saveIntegration select error:', msg, selectError.details);
    return { ok: false, error: msg };
  }

  if (existing) {
    const { error } = await supabaseAdmin
      .from('integrations')
      .update({
        provider_user_id: provider_user_id ?? null,
        credentials,
        config,
      })
      .eq('id', existing.id);

    if (error) {
      const msg = `Update failed: ${error.message} (${error.code})`;
      console.error('saveIntegration update error:', msg, error.details);
      return { ok: false, error: msg };
    }
    return { ok: true };
  }

  const { error } = await supabaseAdmin.from('integrations').insert({
    workspace_id,
    provider,
    provider_user_id: provider_user_id ?? null,
    credentials,
    config,
  });

  if (error) {
    const msg = `Insert failed: ${error.message} (${error.code})`;
    console.error('saveIntegration insert error:', msg, error.details);
    return { ok: false, error: msg };
  }
  return { ok: true };
}

/**
 * Delete integration by workspace and type
 */
export async function deleteIntegration(workspaceId: number, type: IntegrationType): Promise<boolean> {
  if (!supabaseAdmin) return false;
  const provider = TYPE_TO_PROVIDER[type];

  const { error } = await supabaseAdmin
    .from('integrations')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('provider', provider);

  return !error;
}

/**
 * Get all integrations for a workspace
 */
export async function getWorkspaceIntegrations(workspaceId: number): Promise<IntegrationRow[]> {
  if (!supabaseAdmin) return [];

  const { data, error } = await supabaseAdmin
    .from('integrations')
    .select('*')
    .eq('workspace_id', workspaceId);

  if (error || !data) return [];
  return data as IntegrationRow[];
}

