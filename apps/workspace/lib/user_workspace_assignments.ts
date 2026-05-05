import type { SupabaseClient } from '@supabase/supabase-js';

/** Replace all department assignments for a workspace member (user_departments). */
export async function replaceUserDepartmentsForWorkspaceUser(
  adminClient: SupabaseClient,
  workspaceId: string | number,
  userId: string,
  departmentIds: number[]
): Promise<{ error: Error | null }> {
  const ws = Number(workspaceId);
  const { error: delErr } = await adminClient
    .from('user_departments')
    .delete()
    .eq('workspace_id', ws)
    .eq('user_id', userId);
  if (delErr) {
    return { error: new Error(delErr.message) };
  }
  const uniq = [
    ...new Set(departmentIds.filter((n) => Number.isInteger(n) && n > 0)),
  ];
  if (uniq.length === 0) return { error: null };
  const rows = uniq.map((department_id) => ({
    user_id: userId,
    department_id,
    workspace_id: ws,
  }));
  const { error: insErr } = await adminClient.from('user_departments').insert(rows);
  if (insErr) return { error: new Error(insErr.message) };
  return { error: null };
}
