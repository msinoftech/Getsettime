/** Single source of truth for workspace role constants. */

/** Canonical role values stored in user_metadata.role. */
export const ROLE_WORKSPACE_ADMIN = "workspace_admin";
export const ROLE_MANAGER = "manager";
export const ROLE_SERVICE_PROVIDER = "service_provider";
export const ROLE_STAFF = "staff";
export const ROLE_CUSTOMER = "customer";

/** Every role the app knows about, with its user-facing label. */
export const ASSIGNABLE_ROLES: readonly { value: string; label: string }[] = [
  { value: ROLE_WORKSPACE_ADMIN, label: "Workspace Admin" },
  { value: ROLE_MANAGER, label: "Manager" },
  { value: ROLE_SERVICE_PROVIDER, label: "Service Provider" },
  { value: ROLE_STAFF, label: "Staff" },
  { value: ROLE_CUSTOMER, label: "Customer" },
] as const;

/** All valid role string values. */
export const ROLE_VALUES = ASSIGNABLE_ROLES.map(r => r.value);

export type Role = (typeof ASSIGNABLE_ROLES)[number]["value"];

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

/**
 * Display label for a role value. Falls back to title-casing the raw value
 * for unknown/legacy role strings.
 */
export const formatRoleLabel = (role: string): string => {
  const known = ASSIGNABLE_ROLES.find(r => r.value === role);
  if (known) return known.label;
  return role
    .split("_")
    .map(w => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
};
