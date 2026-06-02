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

/** Paginated auth.admin.listUsers; counts active service providers in workspace. */
export async function countWorkspaceServiceProviders(
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
