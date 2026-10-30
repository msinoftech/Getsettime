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

/** Active member with workspace admin access (primary role or additional role). */
export function userHasWorkspaceAdminAccess(
  metadata: Record<string, unknown> | undefined | null
): boolean {
  if (!metadata) return false;
  if (metadata.deactivated === true) return false;
  if (metadata.role === 'workspace_admin') return true;
  const additional = metadata.additional_roles;
  return Array.isArray(additional) && additional.includes('workspace_admin');
}

async function countActiveWorkspaceAdminsViaListUsers(
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
      if (
        userBelongsToWorkspace(u, workspaceId) &&
        userHasWorkspaceAdminAccess(u.user_metadata as Record<string, unknown> | undefined)
      ) {
        count += 1;
      }
    }
    if (users.length < perPage) break;
    page += 1;
  }

  return count;
}

async function countPendingWorkspaceAdminInvites(
  supabaseAdmin: SupabaseClient,
  workspaceId: number
): Promise<number> {
  const now = new Date().toISOString();
  const { count, error } = await supabaseAdmin
    .from('invites')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('role', 'workspace_admin')
    .eq('used', false)
    .gt('expires_at', now);

  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

/** Active workspace admins plus unused, non-expired workspace_admin invites. */
export async function countWorkspaceAdminSeatsUsed(
  supabaseAdmin: SupabaseClient,
  workspaceId: number
): Promise<number> {
  const [activeAdmins, pendingInvites] = await Promise.all([
    countActiveWorkspaceAdminsViaListUsers(supabaseAdmin, workspaceId),
    countPendingWorkspaceAdminInvites(supabaseAdmin, workspaceId),
  ]);
  return activeAdmins + pendingInvites;
}
