import type { SupabaseClient, User } from '@supabase/supabase-js';
import { user_belongs_to_workspace } from '@/lib/team_members_workspace';
import { userActsAsServiceProviderFromMetadata } from '@/lib/service_provider_role';

type ProviderEntry = { id: string; name: string };

function userMetadataForSpCheck(
  u: Pick<User, 'id' | 'user_metadata'>
) {
  const m = u.user_metadata as Record<string, unknown> | undefined;
  const additionalRolesRaw = m?.additional_roles;
  const additional_roles = Array.isArray(additionalRolesRaw)
    ? (additionalRolesRaw.filter((r): r is string => typeof r === 'string'))
    : [];
  return {
    id: u.id,
    role: typeof m?.role === 'string' ? m.role : null,
    is_workspace_owner: m?.is_workspace_owner === true,
    additional_roles,
  };
}

/**
 * Restricts `departments.meta_data.service_providers` to user IDs that
 * currently act as service providers in the workspace (intersection with live team data).
 */
export async function pruneDepartmentsToValidServiceProviders(
  adminClient: SupabaseClient,
  workspaceId: string | number
): Promise<void> {
  const { data: listResult, error: listError } = await adminClient.auth.admin.listUsers();
  if (listError) {
    console.error('pruneDepartments: listUsers', listError);
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
  const { data: depts, error: deErr } = await adminClient
    .from('departments')
    .select('id, meta_data')
    .eq('workspace_id', ws);

  if (deErr) {
    console.error('pruneDepartments: select', deErr);
    return;
  }
  if (!depts?.length) return;

  for (const row of depts) {
    const id = (row as { id: number }).id;
    const meta = ((row as { meta_data: Record<string, unknown> | null }).meta_data ??
      {}) as Record<string, unknown>;
    const raw = meta.service_providers;
    if (!Array.isArray(raw)) continue;

    const rlist = raw as unknown[];
    const next: ProviderEntry[] = [];
    for (const item of rlist) {
      if (!item || typeof item !== 'object' || !('id' in item)) continue;
      const rec = item as { id: unknown; name?: unknown };
      const pid = rec.id;
      if (typeof pid !== 'string' || !validIds.has(pid)) continue;
      const n = rec.name;
      next.push({
        id: pid,
        name: typeof n === 'string' ? n : '',
      });
    }

    const allRawAlreadyValid =
      rlist.length > 0 &&
      rlist.length ===
        rlist.filter(
          (item) =>
            item &&
            typeof item === 'object' &&
            typeof (item as { id: unknown }).id === 'string' &&
            validIds.has((item as { id: string }).id)
        ).length;

    if (allRawAlreadyValid && rlist.length === next.length) {
      const sameOrder = rlist.every(
        (item, i) =>
          item &&
          typeof item === 'object' &&
          (item as { id: string }).id === next[i]!.id
      );
      if (sameOrder) continue;
    }

    const newMeta = { ...meta, service_providers: next };
    const { error: upErr } = await adminClient
      .from('departments')
      .update({ meta_data: newMeta as Record<string, unknown> })
      .eq('id', id);
    if (upErr) {
      console.error('pruneDepartments: update', id, upErr);
    }
  }
}
