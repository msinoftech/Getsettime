import type { SupabaseClient, User } from '@supabase/supabase-js';
import { replaceUserDepartmentsForWorkspaceUser } from '@/lib/user_workspace_assignments';

/**
 * Coerces `user_metadata.departments` (or any number array) to positive integer ids.
 */
export function normalizeDepartmentIdsFromUserMetadata(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => (typeof x === 'number' ? x : Number(x)))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/**
 * Syncs a team member's department assignments to `user_departments`.
 * Replaces JSON-era `departments.meta_data.service_providers` behavior.
 */
export async function syncDepartmentServiceProvidersWithTeamDepartments(
  adminClient: SupabaseClient,
  workspaceId: string | number,
  _member: Pick<User, 'id' | 'email' | 'user_metadata'>,
  selectedDepartmentIds: number[]
): Promise<void> {
  const { error } = await replaceUserDepartmentsForWorkspaceUser(
    adminClient,
    workspaceId,
    _member.id,
    selectedDepartmentIds
  );
  if (error) {
    console.error('syncDepartmentServiceProvidersWithTeamDepartments:', error);
  }
}
