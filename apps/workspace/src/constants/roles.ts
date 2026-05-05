/**
 * Workspace role constants. Definitions live in `@app/db` for sharing with superadmin.
 */
import {
  ASSIGNABLE_ROLES,
  ROLE_CUSTOMER,
  ROLE_MANAGER,
  ROLE_SERVICE_PROVIDER,
  ROLE_STAFF,
  ROLE_VALUES,
  ROLE_WORKSPACE_ADMIN,
  formatRoleLabel,
  type WorkspaceAssignableRole,
} from '@app/db';

export {
  ASSIGNABLE_ROLES,
  ROLE_CUSTOMER,
  ROLE_MANAGER,
  ROLE_SERVICE_PROVIDER,
  ROLE_STAFF,
  ROLE_VALUES,
  ROLE_WORKSPACE_ADMIN,
  formatRoleLabel,
};

export type Role = WorkspaceAssignableRole;

/** Roles that cannot be assigned to a workspace owner (primary or additional). */
export const OWNER_DISALLOWED_ROLES: readonly string[] = [
  ROLE_CUSTOMER,
  ROLE_STAFF,
] as const;

/** Roles (aside from owner) allowed to manage team members. */
export const MANAGE_ROLES: readonly string[] = [
  ROLE_WORKSPACE_ADMIN,
  ROLE_MANAGER,
] as const;
