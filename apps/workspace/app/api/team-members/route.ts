import { NextRequest, NextResponse } from 'next/server';
import { createClient, User } from '@supabase/supabase-js';
import { user_belongs_to_workspace } from '@/lib/team_members_workspace';
import { userActsAsServiceProviderFromSupabaseUser } from '@/lib/service_provider_role';
import { pruneDepartmentsToValidServiceProviders } from '@/lib/department_service_provider_prune';
import {
  normalizeDepartmentIdsFromUserMetadata,
  syncDepartmentServiceProvidersWithTeamDepartments,
} from '@/lib/sync_department_service_providers_from_team';

/**
 * Authorized to manage team members if user is a workspace owner (regardless
 * of primary role — needed because an owner may assign themselves a non-admin
 * primary role via the multi-role selector), or if their primary role is
 * workspace_admin or manager.
 */
function userCanManageTeam(user: User): boolean {
  if (user.user_metadata?.is_workspace_owner === true) return true;
  const role = user.user_metadata?.role;
  return role === 'workspace_admin' || role === 'manager';
}

/**
 * Creates an authenticated Supabase client using the anon key (respects RLS)
 * Sets the auth session from the request's bearer token
 */
function createAuthenticatedClient(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });

  return { supabase, token };
}

/**
 * Creates an admin Supabase client for user management operations
 * Note: Creating users requires admin access
 */
function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// GET: Fetch all team members for the workspace
export async function GET(req: NextRequest) {
  try {
    const result = createAuthenticatedClient(req);
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, token } = result;

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission (owner, workspace_admin, or manager)
    if (!userCanManageTeam(user)) {
      return NextResponse.json({ error: 'Forbidden: Access denied' }, { status: 403 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    // Use admin client to list users (auth.users table requires admin access)
    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // List all users and filter by workspace_id in metadata
    const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();

    if (listError) {
      console.error('Error listing users:', listError);
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    const teamMembers = users
      .filter((u) => user_belongs_to_workspace(u, workspaceId))
      .map((u) => {
        const meta = u.user_metadata as Record<string, unknown> | undefined;
        const phoneRaw = meta?.phone;
        const phone =
          typeof phoneRaw === 'string' && phoneRaw.trim() !== ''
            ? phoneRaw
            : null;
        const additionalRolesRaw = meta?.additional_roles;
        const additional_roles = Array.isArray(additionalRolesRaw)
          ? (additionalRolesRaw.filter((r) => typeof r === 'string') as string[])
          : [];
        return {
          id: u.id,
          email: u.email,
          name: u.user_metadata?.name || u.email?.split('@')[0] || 'Unknown',
          role: u.user_metadata?.role || null,
          additional_roles,
          departments: u.user_metadata?.departments || [],
          phone,
          created_at: u.created_at,
          email_confirmed_at: u.email_confirmed_at,
          deactivated: u.user_metadata?.deactivated || false,
          is_workspace_owner: u.user_metadata?.is_workspace_owner === true,
        };
      });

    return NextResponse.json({ teamMembers });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// POST: Create a new team member
export async function POST(req: NextRequest) {
  try {
    const result = createAuthenticatedClient(req);
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, token } = result;

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission (owner, workspace_admin, or manager)
    if (!userCanManageTeam(user)) {
      return NextResponse.json({ error: 'Forbidden: Access denied' }, { status: 403 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const body = await req.json();
    const { email, password, name, role, departments, phone } = body;

    // Validation
    if (!email || !password || !name) {
      return NextResponse.json({ error: 'Email, password, and name are required' }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    if (role && !['workspace_admin', 'manager', 'service_provider', 'staff', 'customer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be workspace_admin, manager, service_provider, staff, or customer' }, { status: 400 });
    }

    // Use admin client to create user
    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Check if user already exists
    const { data: { users } } = await adminClient.auth.admin.listUsers();
    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 409 });
    }

    const phoneStr =
      typeof phone === 'string' ? phone.trim() : '';

    // Create user with metadata
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        name,
        role: role || 'service_provider',
        workspace_id: workspaceId,
        departments: departments || [],
        ...(phoneStr !== '' ? { phone: phoneStr } : {}),
      },
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    if (!newUser.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    if (userActsAsServiceProviderFromSupabaseUser(newUser.user)) {
      try {
        const deptIds = normalizeDepartmentIdsFromUserMetadata(
          newUser.user.user_metadata?.departments
        );
        await syncDepartmentServiceProvidersWithTeamDepartments(
          adminClient,
          workspaceId,
          newUser.user,
          deptIds
        );
      } catch (syncErr) {
        console.error('syncDepartmentServiceProvidersWithTeamDepartments (POST):', syncErr);
      }
    }

    const newMeta = newUser.user.user_metadata as Record<string, unknown> | undefined;
    const newPhone =
      typeof newMeta?.phone === 'string' && newMeta.phone.trim() !== ''
        ? newMeta.phone
        : null;

    return NextResponse.json({
      teamMember: {
        id: newUser.user.id,
        email: newUser.user.email,
        name: newUser.user.user_metadata?.name,
        role: newUser.user.user_metadata?.role,
        departments: newUser.user.user_metadata?.departments || [],
        phone: newPhone,
      },
    }, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// PUT: Update a team member
export async function PUT(req: NextRequest) {
  try {
    const result = createAuthenticatedClient(req);
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, token } = result;

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission (owner, workspace_admin, or manager)
    if (!userCanManageTeam(user)) {
      return NextResponse.json({ error: 'Forbidden: Access denied' }, { status: 403 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const body = await req.json();
    const { id, name, email, role, additional_roles, departments, phone } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const VALID_ROLES = ['workspace_admin', 'manager', 'service_provider', 'staff', 'customer'] as const;
    type ValidRole = typeof VALID_ROLES[number];
    const isValidRole = (r: unknown): r is ValidRole =>
      typeof r === 'string' && (VALID_ROLES as readonly string[]).includes(r);
    // Roles not permitted for a workspace owner's primary or additional roles.
    const OWNER_DISALLOWED_ROLES: readonly string[] = ['customer', 'staff'];

    if (role && !isValidRole(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be workspace_admin, manager, service_provider, staff, or customer' }, { status: 400 });
    }

    let normalizedAdditionalRoles: string[] | undefined;
    if (additional_roles !== undefined) {
      if (!Array.isArray(additional_roles) || !additional_roles.every(isValidRole)) {
        return NextResponse.json({ error: 'Invalid additional_roles. Must be an array of valid role strings.' }, { status: 400 });
      }
      // De-duplicate and drop the primary role if present there.
      normalizedAdditionalRoles = Array.from(
        new Set(additional_roles.filter((r: string) => r !== (role || undefined)))
      );
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Use admin client to update user
    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Get existing user to preserve metadata
    const { data: { user: existingUser }, error: getUserError } = await adminClient.auth.admin.getUserById(id);

    if (getUserError || !existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (Number(existingUser.user_metadata?.workspace_id) !== Number(workspaceId)) {
      return NextResponse.json({ error: 'Forbidden: User does not belong to your workspace' }, { status: 403 });
    }

    // Only a workspace owner may edit another workspace owner (role/additional_roles).
    const targetIsOwner = existingUser.user_metadata?.is_workspace_owner === true;
    const requesterIsOwner = user.user_metadata?.is_workspace_owner === true;
    if (targetIsOwner && !requesterIsOwner) {
      return NextResponse.json({ error: 'Only a workspace owner can edit another workspace owner' }, { status: 403 });
    }

    // Owners cannot be assigned customer or staff as primary or additional role.
    if (targetIsOwner && role && OWNER_DISALLOWED_ROLES.includes(role)) {
      return NextResponse.json({ error: `Owners cannot have ${OWNER_DISALLOWED_ROLES.join(' or ')} as their primary role` }, { status: 400 });
    }
    if (
      targetIsOwner &&
      normalizedAdditionalRoles &&
      normalizedAdditionalRoles.some(r => OWNER_DISALLOWED_ROLES.includes(r))
    ) {
      return NextResponse.json({ error: `Owners cannot have ${OWNER_DISALLOWED_ROLES.join(' or ')} in additional roles` }, { status: 400 });
    }

    // additional_roles is only accepted for owners; silently drop it for non-owners
    // so it never leaks into normal member metadata.
    const additionalRolesToPersist = targetIsOwner ? normalizedAdditionalRoles : undefined;

    const updatedMetadata = {
      ...existingUser.user_metadata,
      ...(name && { name }),
      ...(role && { role }),
      ...(additionalRolesToPersist !== undefined && { additional_roles: additionalRolesToPersist }),
      ...(departments !== undefined && { departments }),
      ...(phone !== undefined && {
        phone: typeof phone === 'string' ? phone : '',
      }),
    };

    // Prevent stripping the owner flag via payload manipulation
    if (targetIsOwner) {
      updatedMetadata.is_workspace_owner = true;
    }

    const updatePayload: any = {
      user_metadata: updatedMetadata,
    };

    // Update email if provided
    if (email && email !== existingUser.email) {
      updatePayload.email = email;
    }

    const { data: updatedUser, error: updateError } = await adminClient.auth.admin.updateUserById(id, updatePayload);

    if (updateError) {
      console.error('Error updating user:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!updatedUser.user) {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    const wasServiceProvider = userActsAsServiceProviderFromSupabaseUser(existingUser);
    const isServiceProvider = userActsAsServiceProviderFromSupabaseUser(updatedUser.user);
    if (wasServiceProvider && !isServiceProvider) {
      try {
        await pruneDepartmentsToValidServiceProviders(adminClient, workspaceId);
      } catch (pruneErr) {
        console.error('pruneDepartmentsToValidServiceProviders:', pruneErr);
      }
    }

    if (isServiceProvider) {
      try {
        const deptIds = normalizeDepartmentIdsFromUserMetadata(
          updatedUser.user.user_metadata?.departments
        );
        await syncDepartmentServiceProvidersWithTeamDepartments(
          adminClient,
          workspaceId,
          updatedUser.user,
          deptIds
        );
      } catch (syncErr) {
        console.error('syncDepartmentServiceProvidersWithTeamDepartments (PUT):', syncErr);
      }
    }

    const upMeta = updatedUser.user.user_metadata as Record<string, unknown> | undefined;
    const upPhone =
      typeof upMeta?.phone === 'string' && upMeta.phone.trim() !== ''
        ? upMeta.phone
        : null;
    const upAdditionalRolesRaw = upMeta?.additional_roles;
    const upAdditionalRoles = Array.isArray(upAdditionalRolesRaw)
      ? (upAdditionalRolesRaw.filter((r) => typeof r === 'string') as string[])
      : [];

    return NextResponse.json({
      teamMember: {
        id: updatedUser.user.id,
        email: updatedUser.user.email,
        name: updatedUser.user.user_metadata?.name,
        role: updatedUser.user.user_metadata?.role,
        additional_roles: upAdditionalRoles,
        departments: updatedUser.user.user_metadata?.departments || [],
        phone: upPhone,
        is_workspace_owner: updatedUser.user.user_metadata?.is_workspace_owner === true,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// PATCH: Activate a team member
export async function PATCH(req: NextRequest) {
  try {
    const result = createAuthenticatedClient(req);
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, token } = result;

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission (owner, workspace_admin, or manager)
    if (!userCanManageTeam(user)) {
      return NextResponse.json({ error: 'Forbidden: Access denied' }, { status: 403 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Use admin client to activate user
    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Get existing user to verify workspace and preserve metadata
    const { data: { user: existingUser }, error: getUserError } = await adminClient.auth.admin.getUserById(id);

    if (getUserError || !existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user belongs to the same workspace
    if (Number(existingUser.user_metadata?.workspace_id) !== Number(workspaceId)) {
      return NextResponse.json({ error: 'Forbidden: User does not belong to your workspace' }, { status: 403 });
    }

    // Activate user by removing deactivated flag from metadata
    const updatedMetadata = {
      ...existingUser.user_metadata,
      deactivated: false,
    };

    const { error: updateError } = await adminClient.auth.admin.updateUserById(id, {
      user_metadata: updatedMetadata,
    });

    if (updateError) {
      console.error('Error activating user:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// DELETE: Deactivate a team member
export async function DELETE(req: NextRequest) {
  try {
    const result = createAuthenticatedClient(req);
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, token } = result;

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has permission (owner, workspace_admin, or manager)
    if (!userCanManageTeam(user)) {
      return NextResponse.json({ error: 'Forbidden: Access denied' }, { status: 403 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Use admin client to deactivate user
    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Get existing user to verify workspace and preserve metadata
    const { data: { user: existingUser }, error: getUserError } = await adminClient.auth.admin.getUserById(id);

    if (getUserError || !existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify user belongs to the same workspace
    if (Number(existingUser.user_metadata?.workspace_id) !== Number(workspaceId)) {
      return NextResponse.json({ error: 'Forbidden: User does not belong to your workspace' }, { status: 403 });
    }

    if (existingUser.user_metadata?.is_workspace_owner === true) {
      return NextResponse.json({ error: 'Workspace owner cannot be deactivated' }, { status: 403 });
    }

    const updatedMetadata = {
      ...existingUser.user_metadata,
      deactivated: true,
    };

    const { error: updateError } = await adminClient.auth.admin.updateUserById(id, {
      user_metadata: updatedMetadata,
    });

    if (updateError) {
      console.error('Error deactivating user:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

