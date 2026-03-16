import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';
import { createClient } from '@supabase/supabase-js';

/**
 * Creates an admin Supabase client for user management operations
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceSlug = searchParams.get('workspace_slug');
    const workspaceId = searchParams.get('workspace_id');
    
    if (!workspaceSlug && !workspaceId) {
      return NextResponse.json(
        { error: 'Workspace slug or ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();
    let workspaceIdResolved: string | null = null;

    // Resolve workspace ID from slug if needed
    if (workspaceSlug && !workspaceId) {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('slug', workspaceSlug)
        .single();

      if (!workspace) {
        return NextResponse.json(
          { error: 'Workspace not found' },
          { status: 404 }
        );
      }

      workspaceIdResolved = workspace.id;
    } else if (workspaceId) {
      workspaceIdResolved = workspaceId;
    }

    if (!workspaceIdResolved) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
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

    // Filter users by workspace_id in user_metadata
    // Handle both string and number comparisons
    const teamMembers = users
      .filter(u => {
        const userWorkspaceId = u.user_metadata?.workspace_id;
        // Handle both string and number comparisons
        const matches = userWorkspaceId && 
               (userWorkspaceId == workspaceIdResolved || 
                String(userWorkspaceId) === String(workspaceIdResolved));
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

    return NextResponse.json({ teamMembers });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
