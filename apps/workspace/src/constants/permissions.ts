/**
 * Centralized role-based access control (RBAC) for the workspace app.
 *
 * This is the single place to configure:
 *  - which roles may open which pages (`PAGE_ACCESS_RULES` + `canAccessPage`)
 *  - fine-grained capability flags per role (`ROLE_PERMISSIONS` + `hasPermission`)
 *
 * Page components, the layout guard, and the edge middleware all consume these
 * helpers, so future permission changes are made here only — never by editing
 * page logic in many places.
 *
 * Role string values mirror the canonical `user_metadata.role` values defined in
 * `@app/db` (re-exported from `@/src/constants/roles`). They are written as
 * string literals here so this module has zero runtime dependencies and remains
 * safe to import from edge middleware (`proxy.ts`); the `Role`-typed containers
 * below enforce at compile time that every literal is a valid role.
 */
import type { Role } from '@/src/constants/roles';

/** Roles permitted to use the workspace dashboard (i.e. anything except customer). */
const MANAGEMENT_ROLES: readonly Role[] = [
  'workspace_admin',
  'manager',
  'service_provider',
];

interface PageAccessRule {
  /** Matches the pathname exactly or as a path prefix (`/x` matches `/x` and `/x/...`). */
  prefix: string;
  /** Roles allowed to open pages under this prefix. */
  allowedRoles: readonly Role[];
}

/**
 * Pages that are NOT open to every authenticated role. Anything not listed here
 * is accessible by any authenticated workspace role (the default-allow baseline,
 * preserving existing behaviour). Staff are intentionally excluded from the
 * "Admin Center" pages, matching the sidebar visibility rules.
 *
 * To restrict another page in the future, add a rule here — no page edits needed.
 */
export const PAGE_ACCESS_RULES: readonly PageAccessRule[] = [
  { prefix: '/team-members', allowedRoles: MANAGEMENT_ROLES },
  { prefix: '/contacts', allowedRoles: MANAGEMENT_ROLES },
  { prefix: '/integrations', allowedRoles: MANAGEMENT_ROLES },
  { prefix: '/roles-permissions', allowedRoles: MANAGEMENT_ROLES },
  { prefix: '/billings', allowedRoles: MANAGEMENT_ROLES },
  { prefix: '/settings', allowedRoles: MANAGEMENT_ROLES },
];

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Returns true if `role` may open `pathname`.
 *
 * - Unknown / missing role → denied.
 * - Pages without a rule → allowed for any authenticated role (default-allow).
 * - The most specific (longest) matching prefix wins, so nested rules can
 *   override broader ones.
 */
export function canAccessPage(role: string | null | undefined, pathname: string): boolean {
  if (!role) return false;

  let matched: PageAccessRule | null = null;
  for (const rule of PAGE_ACCESS_RULES) {
    if (pathMatchesPrefix(pathname, rule.prefix)) {
      if (!matched || rule.prefix.length > matched.prefix.length) {
        matched = rule;
      }
    }
  }

  if (!matched) return true;
  return matched.allowedRoles.includes(role as Role);
}

/**
 * Fine-grained capability flags. Add new flags here as features need gating;
 * components can then call `hasPermission(role, 'canCreateBookings')` without
 * embedding role checks in business logic.
 */
export interface RolePermissions {
  canViewBookings: boolean;
  canCreateBookings: boolean;
  canEditBookings: boolean;
  canDeleteBookings: boolean;
  canManageTeam: boolean;
  canManageContacts: boolean;
  canManageIntegrations: boolean;
  canManageRolesPermissions: boolean;
  canManageBilling: boolean;
  canManageSettings: boolean;
}

export type Permission = keyof RolePermissions;

const FULL_ACCESS: RolePermissions = {
  canViewBookings: true,
  canCreateBookings: true,
  canEditBookings: true,
  canDeleteBookings: true,
  canManageTeam: true,
  canManageContacts: true,
  canManageIntegrations: true,
  canManageRolesPermissions: true,
  canManageBilling: true,
  canManageSettings: true,
};

const NO_ACCESS: RolePermissions = {
  canViewBookings: false,
  canCreateBookings: false,
  canEditBookings: false,
  canDeleteBookings: false,
  canManageTeam: false,
  canManageContacts: false,
  canManageIntegrations: false,
  canManageRolesPermissions: false,
  canManageBilling: false,
  canManageSettings: false,
};

/**
 * Per-role capability matrix. Edit this object to change what a role can do.
 *
 * Staff currently keep their existing booking abilities and are blocked from the
 * Admin Center management actions. Example future tweak (no page edits required):
 *   staff.canCreateBookings = false
 */
export const ROLE_PERMISSIONS: Record<Role, RolePermissions> = {
  workspace_admin: FULL_ACCESS,
  manager: FULL_ACCESS,
  service_provider: FULL_ACCESS,
  staff: {
    ...NO_ACCESS,
    canViewBookings: true,
    canCreateBookings: true,
    canEditBookings: true,
  },
  customer: {
    ...NO_ACCESS,
    canViewBookings: true,
  },
};

/** Resolve the permission set for a role, falling back to no access. */
export function getRolePermissions(role: string | null | undefined): RolePermissions {
  if (role && role in ROLE_PERMISSIONS) {
    return ROLE_PERMISSIONS[role as Role];
  }
  return NO_ACCESS;
}

/** Returns true if `role` has the given capability flag. */
export function hasPermission(
  role: string | null | undefined,
  permission: Permission
): boolean {
  return getRolePermissions(role)[permission] === true;
}
