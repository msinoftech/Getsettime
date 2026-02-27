import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';

// GET - Fetch all users
export async function GET() {
  try {
    const supabaseServer = getSupabaseServer();
    
    // List all users using admin API
    const { data: { users }, error } = await supabaseServer.auth.admin.listUsers();

    if (error) {
      console.error('Error fetching users:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform users to include metadata in a more accessible format
    const transformedUsers = (users || []).map(user => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      updated_at: user.updated_at,
      email_confirmed_at: user.email_confirmed_at,
      last_sign_in_at: user.last_sign_in_at,
      role: user.user_metadata?.role || null,
      name: user.user_metadata?.name || null,
      workspace_id: user.user_metadata?.workspace_id || null,
    }));

    return NextResponse.json({ users: transformedUsers }, { status: 200 });
  } catch (err: any) {
    console.error('GET users error:', err);
    return NextResponse.json({ 
      error: err?.message || 'An unexpected error occurred' 
    }, { status: 500 });
  }
}

// POST - Create a new user
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name, role, workspace_id } = body;

    // Validation
    if (!email || !password || !name || !role) {
      return NextResponse.json({ 
        error: 'Email, password, name, and role are required' 
      }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Validate password length
    if (password.length < 6) {
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

    // Prepare user metadata
    const userMetadata: Record<string, any> = {
      name,
      role,
    };

    // Add workspace_id to metadata if provided
    if (workspace_id) {
      userMetadata.workspace_id = workspace_id;
    }

    // Create user using admin API
    const { data: userData, error: createError } = await supabaseServer.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
      user_metadata: userMetadata,
    });

    if (createError) {
      console.error('Error creating user:', createError);
      const errorMessage = createError.message || '';
      
      if (errorMessage.includes('already registered') || 
          errorMessage.includes('already exists') ||
          errorMessage.includes('User already registered')) {
        return NextResponse.json({ 
          error: 'This email is already registered' 
        }, { status: 409 });
      }
      
      return NextResponse.json({ 
        error: errorMessage || 'Failed to create user' 
      }, { status: 400 });
    }

    if (!userData || !userData.user) {
      return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
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
      message: 'User created successfully' 
    }, { status: 201 });
  } catch (err: any) {
    console.error('POST user error:', err);
    return NextResponse.json({ 
      error: err?.message || 'An unexpected error occurred' 
    }, { status: 500 });
  }
}

