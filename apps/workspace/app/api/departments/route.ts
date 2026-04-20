import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { appendActivityLog } from '@/lib/activity-log';

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

// GET: Fetch all departments for the workspace
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
    // flag=false rows are soft-deleted and must not appear in the workspace UI
    const { data, error } = await supabase
      .from('departments')
      .select('*')
      .eq('flag', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching departments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ departments: data || [] });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// POST: Create a new department
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
    const { name, description, meta_data, status } = body;

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const trimmedName = typeof name === 'string' ? name.trim() : '';
    if (!trimmedName) {
      return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
    }

    const normalizedStatus: 'active' | 'inactive' =
      status === 'inactive' ? 'inactive' : 'active';

    const { data: existingWorkspaceDepts, error: existingErr } = await supabase
      .from('departments')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (existingErr) {
      console.error('Error checking existing departments:', existingErr);
      return NextResponse.json({ error: existingErr.message }, { status: 500 });
    }

    const lowerDept = trimmedName.toLowerCase();
    const departmentReuse = (existingWorkspaceDepts ?? []).find(
      (d) => typeof d.name === 'string' && d.name.toLowerCase() === lowerDept
    );
    if (departmentReuse) {
      // Restore soft-deleted rows on re-add so the user sees the department back in the list
      if (departmentReuse.flag === false) {
        const { data: restored, error: restoreErr } = await supabase
          .from('departments')
          .update({ flag: true, status: normalizedStatus })
          .eq('id', departmentReuse.id)
          .select()
          .single();

        if (restoreErr) {
          console.error('Error restoring department:', restoreErr);
          return NextResponse.json({ error: restoreErr.message }, { status: 500 });
        }

        return NextResponse.json({ department: restored, reused: true, restored: true });
      }
      return NextResponse.json({ department: departmentReuse, reused: true });
    }

    // RLS validates workspace_id matches JWT; we provide it for INSERT WITH CHECK policy
    // Prepare meta_data - ensure it's a plain object, not a string
    let finalMetaData: Record<string, unknown> | null = null;
    
    if (meta_data) {
      if (typeof meta_data === 'string') {
        // If it's a string, try to parse it
        try {
          const parsed = JSON.parse(meta_data) as Record<string, unknown>;
          finalMetaData = {
            ...parsed,
            services: Array.isArray(parsed.services) ? parsed.services : [],
            service_providers: Array.isArray(parsed.service_providers)
              ? parsed.service_providers
              : [],
          };
        } catch {
          finalMetaData = { services: [], service_providers: [] };
        }
      } else if (typeof meta_data === 'object' && meta_data !== null && !Array.isArray(meta_data)) {
        const o = meta_data as Record<string, unknown>;
        finalMetaData = {
          ...o,
          services: Array.isArray(o.services) ? o.services : [],
          service_providers: Array.isArray(o.service_providers)
            ? o.service_providers
            : [],
        };
      } else {
        finalMetaData = { services: [], service_providers: [] };
      }
    } else {
      finalMetaData = { services: [], service_providers: [] };
    }
    
    console.log('=== CREATE DEPARTMENT DEBUG ===');
    console.log('Raw body received:', JSON.stringify(body));
    console.log('Raw meta_data received:', meta_data);
    console.log('meta_data type:', typeof meta_data);
    console.log('meta_data is string?', typeof meta_data === 'string');
    console.log('meta_data is object?', typeof meta_data === 'object' && meta_data !== null);
    console.log('finalMetaData:', finalMetaData);
    console.log('finalMetaData type:', typeof finalMetaData);
    console.log('finalMetaData stringified:', JSON.stringify(finalMetaData));

    // Supabase jsonb columns expect a JavaScript object/array, not a JSON string
    // Create the insert payload
    const insertPayload = {
      workspace_id: workspaceId,
      name: trimmedName,
      description: typeof description === 'string' ? description.trim() || null : null,
      meta_data: finalMetaData,
      status: normalizedStatus,
    };
    
    console.log('Insert payload:', JSON.stringify(insertPayload, null, 2));
    console.log('Insert payload.meta_data type:', typeof insertPayload.meta_data);
    
    const { data, error } = await supabase
      .from('departments')
      .insert(insertPayload)
      .select()
      .single();
    
    if (error) {
      console.error('Supabase insert error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
    } else {
      console.log('Successfully created department:', data);
      console.log('Created department meta_data:', data.meta_data);
      console.log('Created department meta_data type:', typeof data.meta_data);
    }

    if (error) {
      console.error('Error creating department:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await appendActivityLog(workspaceId, {
      type: 'department',
      action: 'created',
      title: 'Department created',
      description: data?.name || name.trim(),
    });

    return NextResponse.json({ department: data });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// PUT: Update an existing department
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
    const { id, name, description, meta_data, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'Department ID is required' }, { status: 400 });
    }

    // Build the update payload only from fields actually present in the body so callers
    // can perform narrow updates (e.g. just rename, or just toggle status) without
    // wiping unrelated columns.
    const updatePayload: {
      name?: string;
      description?: string | null;
      meta_data?: Record<string, unknown>;
      status?: 'active' | 'inactive';
    } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return NextResponse.json({ error: 'Department name is required' }, { status: 400 });
      }
      updatePayload.name = name.trim();
    }

    if (description !== undefined) {
      updatePayload.description =
        typeof description === 'string' && description.trim() ? description.trim() : null;
    }

    if (status !== undefined) {
      if (status !== 'active' && status !== 'inactive') {
        return NextResponse.json(
          { error: "Invalid status; must be 'active' or 'inactive'" },
          { status: 400 }
        );
      }
      updatePayload.status = status;
    }

    if (meta_data !== undefined) {
      // Fetch existing department to merge meta_data
      const { data: existing, error: fetchError } = await supabase
        .from('departments')
        .select('meta_data')
        .eq('id', id)
        .single();

      if (fetchError || !existing) {
        return NextResponse.json({ error: 'Department not found or unauthorized' }, { status: 404 });
      }

      // Parse incoming meta_data if it's a string
      let parsedMetaData: Record<string, unknown> | null = null;
      if (meta_data) {
        if (typeof meta_data === 'string') {
          try {
            parsedMetaData = JSON.parse(meta_data);
          } catch {
            parsedMetaData = null;
          }
        } else if (typeof meta_data === 'object' && meta_data !== null && !Array.isArray(meta_data)) {
          parsedMetaData = meta_data as Record<string, unknown>;
        }
      }

      // Merge meta_data: preserve existing keys; update services / service_providers when sent
      const existingMetaData = (existing.meta_data as Record<string, unknown>) || {};
      const mergedMetaData: Record<string, unknown> = { ...existingMetaData };

      if (parsedMetaData) {
        if ('services' in parsedMetaData) {
          mergedMetaData.services = Array.isArray(parsedMetaData.services)
            ? parsedMetaData.services
            : [];
        }
        if ('service_providers' in parsedMetaData) {
          mergedMetaData.service_providers = Array.isArray(
            parsedMetaData.service_providers
          )
            ? parsedMetaData.service_providers
            : [];
        }
      }

      updatePayload.meta_data = mergedMetaData;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // RLS automatically filters by workspace_id from JWT
    const { data, error } = await supabase
      .from('departments')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating department:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Department not found or unauthorized' }, { status: 404 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (workspaceId) {
      await appendActivityLog(workspaceId, {
        type: 'department',
        action: 'updated',
        title: 'Department updated',
        description: data?.name || (typeof name === 'string' ? name.trim() : ''),
      });
    }

    return NextResponse.json({ department: data });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// DELETE: Delete a department
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
      return NextResponse.json({ error: 'Department ID is required' }, { status: 400 });
    }

    // Soft delete: set flag=false so the row disappears from the workspace UI but
    // preserves meta_data.service_providers so it can be restored later by re-adding
    // the same name. RLS automatically filters by workspace_id from JWT.
    const { error } = await supabase
      .from('departments')
      .update({ flag: false })
      .eq('id', id);

    if (error) {
      console.error('Error deleting department:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (workspaceId) {
      await appendActivityLog(workspaceId, {
        type: 'department',
        action: 'deleted',
        title: 'Department deleted',
        description: `Department ID ${id} was removed`,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

