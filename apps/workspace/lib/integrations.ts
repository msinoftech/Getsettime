import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();

const supabaseAdmin = supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey)
  : null;

export type IntegrationType = 'google_calendar' | 'zoom';

/** Auth user id (Supabase) when integration belongs to a service provider; omitted for workspace-level. */
export const INTEGRATION_LINKED_AUTH_USER_KEY = 'linked_auth_user_id';

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

export function getLinkedAuthUserIdFromConfig(
  config: Record<string, unknown> | null | undefined
): string | null {
  const v = config?.[INTEGRATION_LINKED_AUTH_USER_KEY];
  return typeof v === 'string' && v.trim() !== '' ? v.trim() : null;
}

function rowToIntegration(
  data: IntegrationRow
): (Integration & { access_token: string }) | null {
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

async function listIntegrationsByProvider(
  workspaceId: number,
  type: IntegrationType
): Promise<IntegrationRow[]> {
  if (!supabaseAdmin) return [];
  const provider = TYPE_TO_PROVIDER[type];

  const { data, error } = await supabaseAdmin
    .from('integrations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('provider', provider);

  if (error || !data) return [];
  return data as IntegrationRow[];
}

function findIntegrationRow(
  rows: IntegrationRow[],
  linkedAuthUserId: string | null | undefined
): IntegrationRow | null {
  if (linkedAuthUserId === undefined) {
    const workspaceRow = rows.find(
      (r) => !getLinkedAuthUserIdFromConfig(r.config as Record<string, unknown>)
    );
    return workspaceRow ?? rows[0] ?? null;
  }

  if (linkedAuthUserId) {
    return (
      rows.find(
        (r) =>
          getLinkedAuthUserIdFromConfig(r.config as Record<string, unknown>) ===
          linkedAuthUserId
      ) ?? null
    );
  }

  return (
    rows.find(
      (r) => !getLinkedAuthUserIdFromConfig(r.config as Record<string, unknown>)
    ) ?? null
  );
}

/**
 * Get integration for a workspace by type.
 * Pass linkedAuthUserId for a service provider row; pass null for workspace-level; omit for legacy workspace-first lookup.
 */
export async function getIntegration(
  workspaceId: number,
  type: IntegrationType,
  options?: { linkedAuthUserId?: string | null }
): Promise<(Integration & { access_token: string }) | null> {
  const rows = await listIntegrationsByProvider(workspaceId, type);
  const row = findIntegrationRow(rows, options?.linkedAuthUserId);
  if (!row) return null;
  return rowToIntegration(row);
}

export interface SaveIntegrationResult {
  ok: boolean;
  error?: string;
}

/**
 * Save or update integration. Use linked_auth_user_id in metadata for per–service-provider rows.
 */
export async function saveIntegration(params: {
  workspace_id: number;
  type: IntegrationType;
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  metadata?: Record<string, unknown>;
  provider_user_id?: string;
  linked_auth_user_id?: string | null;
}): Promise<SaveIntegrationResult> {
  if (!supabaseAdmin) {
    const msg = 'Supabase admin client not configured (SUPABASE_SERVICE_ROLE_KEY missing?)';
    console.error(msg);
    return { ok: false, error: msg };
  }

  const {
    workspace_id,
    type,
    access_token,
    refresh_token,
    expires_at,
    metadata,
    provider_user_id,
    linked_auth_user_id,
  } = params;
  const provider = TYPE_TO_PROVIDER[type];

  const credentials = {
    access_token,
    ...(refresh_token != null && { refresh_token }),
    ...(expires_at != null && { expires_at }),
  };

  const config: Record<string, unknown> = { ...(metadata ?? {}) };
  if (linked_auth_user_id) {
    config[INTEGRATION_LINKED_AUTH_USER_KEY] = linked_auth_user_id;
  } else {
    delete config[INTEGRATION_LINKED_AUTH_USER_KEY];
  }

  const rows = await listIntegrationsByProvider(workspace_id, type);
  const existing = findIntegrationRow(
    rows,
    linked_auth_user_id === undefined ? undefined : linked_auth_user_id ?? null
  );

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
 * Delete integration by workspace, type, and optional service-provider scope.
 */
export async function deleteIntegration(
  workspaceId: number,
  type: IntegrationType,
  options?: { linkedAuthUserId?: string | null }
): Promise<boolean> {
  if (!supabaseAdmin) return false;

  const rows = await listIntegrationsByProvider(workspaceId, type);
  const row = findIntegrationRow(rows, options?.linkedAuthUserId ?? undefined);
  if (!row) return true;

  const { error } = await supabaseAdmin.from('integrations').delete().eq('id', row.id);
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
