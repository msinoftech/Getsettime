/**
 * Canonical auth `user_metadata.role` values shared by workspace and superadmin apps.
 * Workspace UI uses ASSIGNABLE_ROLES; superadmin additionally manages ROLE_SUPERADMIN.
 */

/** Platform operator (superadmin dashboard only; not assignable inside a workspace). */
export const ROLE_SUPERADMIN = 'superadmin';

/** Canonical role values stored in user_metadata.role for workspace members. */
export const ROLE_WORKSPACE_ADMIN = 'workspace_admin';
export const ROLE_MANAGER = 'manager';
export const ROLE_SERVICE_PROVIDER = 'service_provider';
export const ROLE_STAFF = 'staff';
export const ROLE_CUSTOMER = 'customer';

/** Roles a workspace admin can assign on the Team page (single source of truth with workspace app). */
export const ASSIGNABLE_ROLES = [
  { value: ROLE_WORKSPACE_ADMIN, label: 'Workspace Admin' },
  { value: ROLE_MANAGER, label: 'Manager' },
  { value: ROLE_SERVICE_PROVIDER, label: 'Service Provider' },
  { value: ROLE_STAFF, label: 'Staff' },
  { value: ROLE_CUSTOMER, label: 'Customer' },
] as const;

export type WorkspaceAssignableRole = (typeof ASSIGNABLE_ROLES)[number]['value'];

/** All assignable role string values (excludes superadmin). */
export const ROLE_VALUES: readonly string[] = ASSIGNABLE_ROLES.map((r) => r.value);

/**
 * Roles the superadmin “create / update user” API allows (subset of all metadata roles).
 */
export const SUPERADMIN_CREATABLE_USER_ROLES = [
  ROLE_SUPERADMIN,
  ROLE_WORKSPACE_ADMIN,
  ROLE_CUSTOMER,
] as const;

export type SuperadminCreatableUserRole =
  (typeof SUPERADMIN_CREATABLE_USER_ROLES)[number];

/**
 * Every primary role that may appear in `user_metadata.role` (e.g. superadmin user list filters).
 * Superadmin first, then workspace assignable roles in team UI order.
 */
export const USER_METADATA_ROLE_FILTER_OPTIONS: readonly {
  value: string;
  label: string;
}[] = [{ value: ROLE_SUPERADMIN, label: 'Superadmin' }, ...ASSIGNABLE_ROLES];

export function isSuperadminCreatableUserRole(role: string): role is SuperadminCreatableUserRole {
  return (SUPERADMIN_CREATABLE_USER_ROLES as readonly string[]).includes(role);
}

/**
 * Display label for a role stored in metadata. Falls back to title-casing unknown values.
 */
export function formatRoleLabel(role: string): string {
  const known = USER_METADATA_ROLE_FILTER_OPTIONS.find((r) => r.value === role);
  if (known) return known.label;
  return role
    .split('_')
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}
