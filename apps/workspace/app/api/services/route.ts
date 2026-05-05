import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { appendActivityLog } from '@/lib/activity-log';
import { enrichServicesWithUserServiceProviders } from '@/lib/enrich_services_user_services';

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

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function parseMetaData(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
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
    // flag=false rows are soft-deleted and must not appear in the workspace UI
    const { data, error } = await supabase
      .from('services')
      .select('*, departments(name)')
      .eq('flag', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching services:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    const adminClient = createAdminClient();
    const rawRows = (data || []) as Record<string, unknown>[];
    const enriched =
      workspaceId && adminClient
        ? await enrichServicesWithUserServiceProviders(
            adminClient,
            supabase,
            workspaceId,
            rawRows
          )
        : rawRows;

    return NextResponse.json({ services: enriched });
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
    const { name, description, price, department_id, duration, status, meta_data } = body;

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

    const normalizedStatus: 'active' | 'inactive' =
      status === 'inactive' ? 'inactive' : 'active';

    const parsedDuration =
      typeof duration === 'number'
        ? Math.trunc(duration)
        : duration !== undefined && duration !== null && String(duration).trim() !== ''
          ? parseInt(String(duration), 10)
          : 30;
    const finalDuration =
      Number.isFinite(parsedDuration) && parsedDuration > 0 ? parsedDuration : 30;

    const incomingMeta = parseMetaData(meta_data);
    const finalMetaData: Record<string, unknown> = {};
    if (incomingMeta) {
      for (const [k, v] of Object.entries(incomingMeta)) {
        if (k === 'service_providers') continue;
        finalMetaData[k] = v;
      }
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
        duration: finalDuration,
        status: normalizedStatus,
        flag: true,
        meta_data: finalMetaData,
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

    const adminClient = createAdminClient();
    const enriched =
      data && adminClient
        ? (
            await enrichServicesWithUserServiceProviders(
              adminClient,
              supabase,
              workspaceId,
              [data as Record<string, unknown>]
            )
          )[0]
        : data;

    return NextResponse.json({ service: enriched });
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
    const {
      id,
      name,
      description,
      price,
      department_id,
      duration,
      status,
      meta_data,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Service ID is required' }, { status: 400 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    // Build the update payload only from fields actually present in the body so
    // callers can perform narrow updates (e.g. just rename, toggle status, or
    // mutate meta_data) without wiping unrelated columns.
    const updatePayload: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim() === '') {
        return NextResponse.json({ error: 'Service name is required' }, { status: 400 });
      }
      updatePayload.name = name.trim();
    }

    if (description !== undefined) {
      updatePayload.description =
        typeof description === 'string' && description.trim() ? description.trim() : null;
    }

    if (price !== undefined) {
      updatePayload.price =
        price === null || price === ''
          ? null
          : parseFloat(String(price));
    }

    if (department_id !== undefined) {
      try {
        updatePayload.department_id = await resolveDepartmentIdForWorkspace(
          supabase,
          workspaceId,
          department_id
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Invalid department';
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    if (duration !== undefined) {
      const parsed =
        typeof duration === 'number' ? Math.trunc(duration) : parseInt(String(duration), 10);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        return NextResponse.json(
          { error: 'Duration must be a positive number of minutes' },
          { status: 400 }
        );
      }
      updatePayload.duration = parsed;
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
      const { data: existing, error: fetchError } = await supabase
        .from('services')
        .select('meta_data')
        .eq('id', id)
        .single();

      if (fetchError || !existing) {
        return NextResponse.json(
          { error: 'Service not found or unauthorized' },
          { status: 404 }
        );
      }

      const parsedMetaData = parseMetaData(meta_data);
      const existingMetaData =
        (existing.meta_data as Record<string, unknown> | null) ?? {};
      const mergedMetaData: Record<string, unknown> = { ...existingMetaData };
      delete mergedMetaData.service_providers;

      if (parsedMetaData) {
        for (const [k, v] of Object.entries(parsedMetaData)) {
          if (k === 'service_providers') continue;
          mergedMetaData[k] = v;
        }
      }

      updatePayload.meta_data = mergedMetaData;
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
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
      description: data?.name || (typeof name === 'string' ? name.trim() : ''),
    });

    const adminClient = createAdminClient();
    const enriched =
      data && adminClient
        ? (
            await enrichServicesWithUserServiceProviders(
              adminClient,
              supabase,
              workspaceId,
              [data as Record<string, unknown>]
            )
          )[0]
        : data;

    return NextResponse.json({ service: enriched });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

// DELETE: Soft-delete a service so its doctor assignments can be restored later
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

    // Soft delete: set flag=false. Provider links live in user_services.
    const { error } = await supabase
      .from('services')
      .update({ flag: false })
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
