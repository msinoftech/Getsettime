import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

// PUT - Update a user
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both sync and async params (Next.js 15+)
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    const body = await req.json();
    const { email, password, name, role, workspace_id } = body;

    // Validation
    if (!email || !name || !role) {
      return NextResponse.json({ 
        error: 'Email, name, and role are required' 
      }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate password length if provided
    if (password && password.length < 6) {
      return NextResponse.json({ 
        error: 'Password must be at least 6 characters' 
      }, { status: 400 });
    }

    // Validate role
    const validRoles = ['superadmin', 'workspace_admin', 'customer'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ 
        error: `Role must be one of: ${validRoles.join(', ')}` 
      }, { status: 400 });
    }

    // Validate workspace_id for customer and workspace_admin roles
    if ((role === 'customer' || role === 'workspace_admin') && !workspace_id) {
      return NextResponse.json({ 
        error: 'Workspace ID is required for customer and workspace_admin roles' 
      }, { status: 400 });
    }

    const supabaseServer = getSupabaseServer();

    // If workspace_id is provided, verify it exists
    if (workspace_id) {
      const { data: workspace, error: workspaceError } = await supabaseServer
        .from('workspaces')
        .select('id')
        .eq('id', workspace_id)
        .single();

      if (workspaceError || !workspace) {
        return NextResponse.json({ 
          error: 'Invalid workspace ID' 
        }, { status: 400 });
      }
    }

    // Get current user to preserve existing metadata
    const { data: { user: currentUser }, error: getUserError } = await supabaseServer.auth.admin.getUserById(id);
    
    if (getUserError || !currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prepare user metadata
    const userMetadata: Record<string, any> = {
      ...currentUser.user_metadata, // Preserve existing metadata
      name,
      role,
    };

    // Handle workspace_id based on role
    if (role === 'customer' || role === 'workspace_admin') {
      userMetadata.workspace_id = workspace_id;
    } else {
      // Remove workspace_id for superadmin role
      delete userMetadata.workspace_id;
    }

    // Prepare update payload
    const updatePayload: {
      email?: string;
      password?: string;
      user_metadata?: Record<string, any>;
    } = {
      email,
      user_metadata: userMetadata,
    };

    // Only include password if provided
    if (password) {
      updatePayload.password = password;
    }

    // Update user using admin API
    const { data: userData, error: updateError } = await supabaseServer.auth.admin.updateUserById(
      id,
      updatePayload
    );

    if (updateError) {
      console.error('Error updating user:', updateError);
      const errorMessage = updateError.message || '';
      
      if (errorMessage.includes('already registered') || 
          errorMessage.includes('already exists')) {
        return NextResponse.json({ 
          error: 'This email is already registered by another user' 
        }, { status: 409 });
      }
      
      return NextResponse.json({ 
        error: errorMessage || 'Failed to update user' 
      }, { status: 400 });
    }

    if (!userData || !userData.user) {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
    }

    // Transform user response
    const transformedUser = {
      id: userData.user.id,
      email: userData.user.email,
      created_at: userData.user.created_at,
      updated_at: userData.user.updated_at,
      email_confirmed_at: userData.user.email_confirmed_at,
      last_sign_in_at: userData.user.last_sign_in_at,
      role: userData.user.user_metadata?.role || null,
      name: userData.user.user_metadata?.name || null,
      workspace_id: userData.user.user_metadata?.workspace_id || null,
    };

    return NextResponse.json({ 
      user: transformedUser,
      message: 'User updated successfully' 
    }, { status: 200 });
  } catch (err: any) {
    console.error('PUT user error:', err);
    return NextResponse.json({ 
      error: err?.message || 'An unexpected error occurred' 
    }, { status: 500 });
  }
}

// DELETE - Delete a user
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    // Handle both sync and async params (Next.js 15+)
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;

    const supabaseServer = getSupabaseServer();

    // Delete user using admin API
    const { error } = await supabaseServer.auth.admin.deleteUser(id);

    if (error) {
      console.error('Error deleting user:', error);
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'User deleted successfully' 
    }, { status: 200 });
  } catch (err: any) {
    console.error('DELETE user error:', err);
    return NextResponse.json({ 
      error: err?.message || 'An unexpected error occurred' 
    }, { status: 500 });
  }
}

