import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { appendActivityLog } from '@/lib/activity-log';

async function resolveDepartmentIdForWorkspace(
  supabase: SupabaseClient,
  workspaceId: number | string,
  raw: unknown
): Promise<number | null> {
  if (raw === undefined || raw === null || raw === '') {
    return null;
  }
  const id =
    typeof raw === 'number'
      ? raw
      : parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Invalid department');
  }
  const { data, error } = await supabase
    .from('departments')
    .select('id')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  if (error || !data) {
    throw new Error('Department not found in this workspace');
  }
  return id;
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

  // Create client with anon key - respects RLS policies
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

// GET: Fetch all services for the workspace
export async function GET(req: NextRequest) {
  try {
    const result = createAuthenticatedClient(req);
    if (!result) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, token } = result;

    // Verify auth - will fail if token is invalid
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // RLS automatically filters by workspace_id from JWT
    const { data, error } = await supabase
      .from('services')
      .select('*, departments(name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching services:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ services: data || [] });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// POST: Create a new service
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

    const body = await req.json();
    const { name, description, price, department_id } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Service name is required' }, { status: 400 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    let departmentIdResolved: number | null = null;
    try {
      departmentIdResolved = await resolveDepartmentIdForWorkspace(
        supabase,
        workspaceId,
        department_id
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Invalid department';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // RLS validates workspace_id matches JWT; we provide it for INSERT WITH CHECK policy
    const { data, error } = await supabase
      .from('services')
      .insert({
        workspace_id: workspaceId,
        name: name.trim(),
        description: description?.trim() || null,
        price: price ? parseFloat(price) : null,
        department_id: departmentIdResolved,
      })
      .select('*, departments(name)')
      .single();

    if (error) {
      console.error('Error creating service:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await appendActivityLog(workspaceId, {
      type: 'service',
      action: 'created',
      title: 'Service created',
      description: data?.name || name.trim(),
    });

    return NextResponse.json({ service: data });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// PUT: Update an existing service
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

    const body = await req.json();
    const { id, name, description, price, department_id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Service ID is required' }, { status: 400 });
    }

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Service name is required' }, { status: 400 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    let departmentIdResolved: number | null | undefined = undefined;
    if (department_id !== undefined) {
      try {
        departmentIdResolved = await resolveDepartmentIdForWorkspace(
          supabase,
          workspaceId,
          department_id
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Invalid department';
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    const updatePayload: Record<string, unknown> = {
      name: name.trim(),
      description: description?.trim() || null,
      price: price ? parseFloat(price) : null,
    };
    if (departmentIdResolved !== undefined) {
      updatePayload.department_id = departmentIdResolved;
    }

    // RLS automatically filters by workspace_id from JWT
    const { data, error } = await supabase
      .from('services')
      .update(updatePayload)
      .eq('id', id)
      .select('*, departments(name)')
      .single();

    if (error) {
      console.error('Error updating service:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Service not found or unauthorized' }, { status: 404 });
    }

    await appendActivityLog(workspaceId, {
      type: 'service',
      action: 'updated',
      title: 'Service updated',
      description: data?.name || name.trim(),
    });

    return NextResponse.json({ service: data });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// DELETE: Delete a service
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Service ID is required' }, { status: 400 });
    }

    // RLS automatically filters by workspace_id from JWT
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting service:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (workspaceId) {
      await appendActivityLog(workspaceId, {
        type: 'service',
        action: 'deleted',
        title: 'Service deleted',
        description: `Service ID ${id} was removed`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

