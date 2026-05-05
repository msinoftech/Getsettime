import type { SupabaseClient, User } from '@supabase/supabase-js';
import { user_belongs_to_workspace } from '@/lib/team_members_workspace';
import { userActsAsServiceProviderFromMetadata } from '@/lib/service_provider_role';

function userMetadataForSpCheck(u: Pick<User, 'id' | 'user_metadata'>) {
  const m = u.user_metadata as Record<string, unknown> | undefined;
  const additionalRolesRaw = m?.additional_roles;
  const additional_roles = Array.isArray(additionalRolesRaw)
    ? additionalRolesRaw.filter((r): r is string => typeof r === 'string')
    : [];
  return {
    id: u.id,
    role: typeof m?.role === 'string' ? m.role : null,
    is_workspace_owner: m?.is_workspace_owner === true,
    additional_roles,
  };
}

/**
 * Removes `user_departments` rows for users who no longer act as service providers in the workspace.
 */
export async function pruneDepartmentsToValidServiceProviders(
  adminClient: SupabaseClient,
  workspaceId: string | number
): Promise<void> {
  const { data: listResult, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    console.error('pruneUserDepartments: listUsers', listError);
    return;
  }
  const users = listResult?.users;
  if (!users?.length) return;

  const validIds = new Set<string>();
  for (const u of users) {
    if (!user_belongs_to_workspace(u, workspaceId)) continue;
    const info = userMetadataForSpCheck(u);
    if (
      userActsAsServiceProviderFromMetadata({
        role: info.role,
        is_workspace_owner: info.is_workspace_owner,
        additional_roles: info.additional_roles,
      })
    ) {
      validIds.add(u.id);
    }
  }

  const ws = Number(workspaceId);
  const { data: rows, error: selErr } = await adminClient
    .from('user_departments')
    .select('id, user_id')
    .eq('workspace_id', ws);
  if (selErr) {
    console.error('pruneUserDepartments: select', selErr);
    return;
  }
  const toDelete = (rows ?? [])
    .filter((r) => typeof r.user_id === 'string' && !validIds.has(r.user_id))
    .map((r) => r.id);
  for (const id of toDelete) {
    const { error: delErr } = await adminClient.from('user_departments').delete().eq('id', id);
    if (delErr) {
      console.error('pruneUserDepartments: delete', id, delErr);
    }
  }
}
