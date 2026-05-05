import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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

async function linkWorkspaceOwnerToDepartment(
  supabase: SupabaseClient,
  workspaceId: number | string,
  departmentId: number
): Promise<void> {
  const ws = Number(workspaceId);
  const { data: wsRow, error: wsErr } = await supabase
    .from('workspaces')
    .select('user_id')
    .eq('id', ws)
    .maybeSingle();
  if (wsErr || !wsRow?.user_id) {
    if (wsErr) {
      console.error('linkWorkspaceOwnerToDepartment: workspaces lookup', wsErr);
    }
    return;
  }

  const { data: existing } = await supabase
    .from('user_departments')
    .select('id')
    .eq('workspace_id', ws)
    .eq('user_id', wsRow.user_id)
    .eq('department_id', departmentId)
    .limit(1)
    .maybeSingle();
  if (existing) return;

  const { error: insErr } = await supabase.from('user_departments').insert({
    user_id: wsRow.user_id,
    department_id: departmentId,
    workspace_id: ws,
  });
  if (insErr) {
    console.error('linkWorkspaceOwnerToDepartment: user_departments insert', insErr);
  }
}

function normalizeDepartmentMeta(meta_data: unknown): Record<string, unknown> {
  if (meta_data) {
    if (typeof meta_data === 'string') {
      try {
        const parsed = JSON.parse(meta_data) as Record<string, unknown>;
        const services = Array.isArray(parsed.services) ? parsed.services : [];
        const { service_providers: _s, ...rest } = parsed;
        return { ...rest, services };
      } catch {
        return { services: [] };
      }
    }
    if (typeof meta_data === 'object' && meta_data !== null && !Array.isArray(meta_data)) {
      const o = meta_data as Record<string, unknown>;
      const services = Array.isArray(o.services) ? o.services : [];
      const { service_providers: _s, ...rest } = o;
      return { ...rest, services };
    }
  }
  return { services: [] };
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

        await linkWorkspaceOwnerToDepartment(supabase, workspaceId, restored.id as number);

        return NextResponse.json({ department: restored, reused: true, restored: true });
      }
      await linkWorkspaceOwnerToDepartment(supabase, workspaceId, departmentReuse.id as number);
      return NextResponse.json({ department: departmentReuse, reused: true });
    }

    const finalMetaData = normalizeDepartmentMeta(meta_data);

    const insertPayload = {
      workspace_id: workspaceId,
      name: trimmedName,
      description: typeof description === 'string' ? description.trim() || null : null,
      meta_data: finalMetaData,
      status: normalizedStatus,
    };

    const { data, error } = await supabase
      .from('departments')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      console.error('Error creating department:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data?.id !== undefined) {
      await linkWorkspaceOwnerToDepartment(supabase, workspaceId, data.id as number);
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
      delete mergedMetaData.service_providers;

      if (parsedMetaData) {
        if ('services' in parsedMetaData) {
          mergedMetaData.services = Array.isArray(parsedMetaData.services)
            ? parsedMetaData.services
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

    // Soft delete: set flag=false. Provider links live in user_departments.
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

