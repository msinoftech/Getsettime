import type { User } from '@supabase/supabase-js';
import { ROLE_SERVICE_PROVIDER } from '@/src/constants/roles';

/**
 * Subset of user metadata used to decide if someone is a service provider
 * (same rules as the team and booking UIs).
 */
export interface UserMetadataForServiceProvider {
  role?: string | null;
  is_workspace_owner?: boolean;
  additional_roles?: string[] | null;
}

/**
 * True if the user should be listed as a service provider: primary role
 * `service_provider`, or workspace owner with that role in additional_roles.
 */
export function userActsAsServiceProviderFromMetadata(
  meta: UserMetadataForServiceProvider | null | undefined
): boolean {
  if (!meta) return false;
  if (meta.role === ROLE_SERVICE_PROVIDER) return true;
  if (
    meta.is_workspace_owner === true &&
    Array.isArray(meta.additional_roles) &&
    meta.additional_roles.includes(ROLE_SERVICE_PROVIDER)
  ) {
    return true;
  }
  return false;
}

/** Reads `user_metadata` the same way as `/api/team-members` and applies {@link userActsAsServiceProviderFromMetadata}. */
export function userActsAsServiceProviderFromSupabaseUser(
  u: Pick<User, 'user_metadata'>
): boolean {
  const m = u.user_metadata as Record<string, unknown> | undefined;
  const additionalRolesRaw = m?.additional_roles;
  const additional_roles = Array.isArray(additionalRolesRaw)
    ? (additionalRolesRaw.filter((r): r is string => typeof r === 'string'))
    : [];
  return userActsAsServiceProviderFromMetadata({
    role: typeof m?.role === 'string' ? m.role : null,
    is_workspace_owner: m?.is_workspace_owner === true,
    additional_roles,
  });
}
