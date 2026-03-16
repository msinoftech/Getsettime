import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Creates an authenticated Supabase client for verification
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

  // Create client with anon key for auth verification
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
 * Creates a service role Supabase client (bypasses RLS)
 */
function createServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// GET: Fetch workspace slug for the authenticated user
export async function GET(req: NextRequest) {
  try {
    console.log('=== API /workspace/slug called ===');
    
    // Verify user authentication
    const authResult = createAuthenticatedClient(req);
    if (!authResult) {
      console.log('❌ No auth result - missing token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase: authClient, token } = authResult;

    // Verify auth - will fail if token is invalid
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      console.log('❌ Auth error:', authError);
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('✅ User authenticated:', user.email);
    const workspaceId = user.user_metadata?.workspace_id;
    console.log('Workspace ID from metadata:', workspaceId);
    
    if (!workspaceId) {
      console.log('❌ No workspace_id in user metadata');
      return NextResponse.json({ error: 'No workspace_id in user metadata' }, { status: 404 });
    }

    // Use service role client to fetch workspace (bypasses RLS)
    const serviceClient = createServiceClient();
    if (!serviceClient) {
      console.log('❌ Failed to create service client');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    console.log('Fetching workspace with service role...');
    // Fetch workspace slug using service role
    const { data, error } = await serviceClient
      .from('workspaces')
      .select('slug')
      .eq('id', workspaceId)
      .single();

    console.log('Query result - data:', data);
    console.log('Query result - error:', error);

    if (error) {
      console.error('❌ Error fetching workspace slug:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || !data.slug) {
      console.log('❌ Workspace not found or has no slug');
      return NextResponse.json({ error: 'Workspace not found or has no slug' }, { status: 404 });
    }

    console.log('✅ Successfully fetched slug:', data.slug);
    return NextResponse.json({ slug: data.slug });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('❌ Exception in API:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
