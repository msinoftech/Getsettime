import type { SupabaseClient, User } from '@supabase/supabase-js';

function userBelongsToWorkspace(
  u: Pick<User, 'user_metadata'>,
  workspaceId: number
): boolean {
  const userWorkspaceId = u.user_metadata?.workspace_id as string | number | undefined;
  if (userWorkspaceId === undefined || userWorkspaceId === null || userWorkspaceId === '') {
    return false;
  }
  return userWorkspaceId == workspaceId || Number(userWorkspaceId) === workspaceId;
}

function userActsAsServiceProvider(u: Pick<User, 'user_metadata'>): boolean {
  const m = u.user_metadata as Record<string, unknown> | undefined;
  if (!m) return false;
  if (m.deactivated === true) return false;
  if (m.role === 'service_provider') return true;
  if (
    m.is_workspace_owner === true &&
    Array.isArray(m.additional_roles) &&
    m.additional_roles.includes('service_provider')
  ) {
    return true;
  }
  return false;
}

function isMissingRpcError(message: string | undefined): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes('count_workspace_service_providers') ||
    lower.includes('could not find the function') ||
    lower.includes('schema cache')
  );
}

async function countWorkspaceServiceProvidersViaListUsers(
  supabaseAdmin: SupabaseClient,
  workspaceId: number
): Promise<number> {
  let page = 1;
  const perPage = 200;
  let count = 0;

  for (;;) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(error.message);
    }
    const users = data?.users ?? [];
    for (const u of users) {
      if (userBelongsToWorkspace(u, workspaceId) && userActsAsServiceProvider(u)) {
        count += 1;
      }
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return count;
}

/** Indexed workspace SP count via RPC; falls back to listUsers when migration is not applied. */
export async function countWorkspaceServiceProviders(
  supabaseAdmin: SupabaseClient,
  workspaceId: number
): Promise<number> {
  const { data, error } = await supabaseAdmin.rpc('count_workspace_service_providers', {
    p_workspace_id: workspaceId,
  });

  if (!error) {
    const n = typeof data === 'number' ? data : Number(data);
    return Number.isFinite(n) ? n : 0;
  }

  if (!isMissingRpcError(error.message)) {
    throw new Error(error.message);
  }

  console.warn(
    'countWorkspaceServiceProviders: RPC missing, falling back to listUsers (apply create_count_workspace_service_providers_rpc migration)'
  );
  return countWorkspaceServiceProvidersViaListUsers(supabaseAdmin, workspaceId);
}
