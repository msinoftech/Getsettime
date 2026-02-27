import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
  const supabaseServiceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

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

    // Check if user has permission (workspace_admin or manager)
    const userRole = user.user_metadata?.role;
    if (userRole !== 'workspace_admin' && userRole !== 'manager') {
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

    console.log('Current workspace ID:', workspaceId, 'Type:', typeof workspaceId);
    console.log('Total users found:', users.length);

    // Filter users by workspace_id in user_metadata
    // Convert both to numbers for comparison to handle type mismatches
    const teamMembers = users
      .filter(u => {
        const userWorkspaceId = u.user_metadata?.workspace_id;
        const userRole = u.user_metadata?.role;
        console.log(`User ${u.email}: workspace_id=${userWorkspaceId} (${typeof userWorkspaceId}), role=${userRole}`);
        
        // Handle both string and number comparisons
        const matches = userWorkspaceId && 
               (userWorkspaceId == workspaceId || 
                Number(userWorkspaceId) === Number(workspaceId));
        
        console.log(`  -> Matches: ${matches}`);
        return matches;
      })
      .map(u => ({
        id: u.id,
        email: u.email,
        name: u.user_metadata?.name || u.email?.split('@')[0] || 'Unknown',
        role: u.user_metadata?.role || null,
        departments: u.user_metadata?.departments || [],
        created_at: u.created_at,
        email_confirmed_at: u.email_confirmed_at,
        deactivated: u.user_metadata?.deactivated || false,
      }));

    console.log('Filtered team members:', teamMembers.length);

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

    // Check if user has permission (workspace_admin or manager)
    const userRole = user.user_metadata?.role;
    if (userRole !== 'workspace_admin' && userRole !== 'manager') {
      return NextResponse.json({ error: 'Forbidden: Access denied' }, { status: 403 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const body = await req.json();
    const { email, password, name, role, departments } = body;

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

    if (role && !['workspace_admin', 'manager', 'service_provider', 'customer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be workspace_admin, manager, service_provider, or customer' }, { status: 400 });
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
      },
    });

    if (createError) {
      console.error('Error creating user:', createError);
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    if (!newUser.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }

    return NextResponse.json({
      teamMember: {
        id: newUser.user.id,
        email: newUser.user.email,
        name: newUser.user.user_metadata?.name,
        role: newUser.user.user_metadata?.role,
        departments: newUser.user.user_metadata?.departments || [],
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

    // Check if user has permission (workspace_admin or manager)
    const userRole = user.user_metadata?.role;
    if (userRole !== 'workspace_admin' && userRole !== 'manager') {
      return NextResponse.json({ error: 'Forbidden: Access denied' }, { status: 403 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const body = await req.json();
    const { id, name, email, role, departments } = body;

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (role && !['workspace_admin', 'manager', 'service_provider', 'customer'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be workspace_admin, manager, service_provider, or customer' }, { status: 400 });
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

    // Verify user belongs to the same workspace
    if (Number(existingUser.user_metadata?.workspace_id) !== Number(workspaceId)) {
      return NextResponse.json({ error: 'Forbidden: User does not belong to your workspace' }, { status: 403 });
    }

    // Update user metadata
    const updatedMetadata = {
      ...existingUser.user_metadata,
      ...(name && { name }),
      ...(role && { role }),
      ...(departments !== undefined && { departments }),
    };

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

    return NextResponse.json({
      teamMember: {
        id: updatedUser.user.id,
        email: updatedUser.user.email,
        name: updatedUser.user.user_metadata?.name,
        role: updatedUser.user.user_metadata?.role,
        departments: updatedUser.user.user_metadata?.departments || [],
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

    // Check if user has permission (workspace_admin or manager)
    const userRole = user.user_metadata?.role;
    if (userRole !== 'workspace_admin' && userRole !== 'manager') {
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

    // Check if user has permission (workspace_admin or manager)
    const userRole = user.user_metadata?.role;
    if (userRole !== 'workspace_admin' && userRole !== 'manager') {
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

    // Deactivate user by setting deactivated flag in metadata
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

