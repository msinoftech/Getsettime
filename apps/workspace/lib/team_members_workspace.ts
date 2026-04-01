import type { User } from '@supabase/supabase-js';

/**
 * Same workspace membership rule as GET /api/team-members (metadata workspace_id, string/number tolerant).
 */
export function user_belongs_to_workspace(
  u: Pick<User, 'user_metadata'>,
  workspaceId: string | number
): boolean {
  const userWorkspaceId = u.user_metadata?.workspace_id as string | number | undefined;
  if (userWorkspaceId === undefined || userWorkspaceId === null || userWorkspaceId === '') {
    return false;
  }
  return (
    userWorkspaceId == workspaceId || Number(userWorkspaceId) === Number(workspaceId)
  );
}
