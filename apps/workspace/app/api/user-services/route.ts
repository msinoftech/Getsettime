import { NextRequest, NextResponse } from 'next/server';
import { createClient, type User } from '@supabase/supabase-js';

function userCanManageAssignments(user: User): boolean {
  if (user.user_metadata?.is_workspace_owner === true) return true;
  const role = user.user_metadata?.role;
  return role === 'workspace_admin' || role === 'manager';
}

function createAuthenticatedClient(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  return { supabase, token };
}

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

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('user_id');
    const serviceId = searchParams.get('service_id');

    let query = supabase
      .from('user_services')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (userId) query = query.eq('user_id', userId);
    if (serviceId) query = query.eq('service_id', serviceId);

    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) {
      console.error('user-services GET:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ assignments: data ?? [] });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('user-services GET:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

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
    if (!userCanManageAssignments(user)) {
      return NextResponse.json({ error: 'Forbidden: Access denied' }, { status: 403 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const body = await req.json();
    const userId = typeof body.user_id === 'string' ? body.user_id : null;
    const serviceId = typeof body.service_id === 'string' ? body.service_id : null;
    if (!userId || !serviceId) {
      return NextResponse.json({ error: 'user_id and service_id are required' }, { status: 400 });
    }

    const { data: svc, error: svcErr } = await supabase
      .from('services')
      .select('id')
      .eq('id', serviceId)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (svcErr || !svc) {
      return NextResponse.json({ error: 'Service not found in workspace' }, { status: 400 });
    }

    const { data: row, error } = await supabase
      .from('user_services')
      .insert({
        user_id: userId,
        service_id: serviceId,
        workspace_id: workspaceId,
      })
      .select()
      .single();

    if (error) {
      console.error('user-services POST:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ assignment: row }, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('user-services POST:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

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
    if (!userCanManageAssignments(user)) {
      return NextResponse.json({ error: 'Forbidden: Access denied' }, { status: 403 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const body = await req.json();
    const userId = typeof body.user_id === 'string' ? body.user_id : null;
    const serviceIdsRaw = body.service_ids;
    if (!userId || !Array.isArray(serviceIdsRaw)) {
      return NextResponse.json({ error: 'user_id and service_ids[] are required' }, { status: 400 });
    }

    const serviceIds = serviceIdsRaw.filter(
      (x: unknown): x is string => typeof x === 'string' && x.trim() !== ''
    );

    const { error: delErr } = await supabase
      .from('user_services')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);
    if (delErr) {
      console.error('user-services PUT delete:', delErr);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    if (serviceIds.length === 0) {
      return NextResponse.json({ success: true, assignments: [] });
    }

    const { data: validSvcs, error: vErr } = await supabase
      .from('services')
      .select('id')
      .eq('workspace_id', workspaceId)
      .in('id', serviceIds);
    if (vErr) {
      return NextResponse.json({ error: vErr.message }, { status: 500 });
    }
    const allowed = new Set((validSvcs ?? []).map((r) => r.id));
    const toInsert = serviceIds.filter((id) => allowed.has(id));
    if (toInsert.length === 0) {
      return NextResponse.json({ success: true, assignments: [] });
    }

    const rows = toInsert.map((service_id) => ({
      user_id: userId,
      service_id,
      workspace_id: workspaceId,
    }));

    const { data: inserted, error: insErr } = await supabase
      .from('user_services')
      .insert(rows)
      .select();
    if (insErr) {
      console.error('user-services PUT insert:', insErr);
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, assignments: inserted ?? [] });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('user-services PUT:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

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
    if (!userCanManageAssignments(user)) {
      return NextResponse.json({ error: 'Forbidden: Access denied' }, { status: 403 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('user_id');
    const serviceId = searchParams.get('service_id');

    if (id) {
      const { error } = await supabase
        .from('user_services')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspaceId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (userId && serviceId) {
      const { error } = await supabase
        .from('user_services')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .eq('service_id', serviceId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'id or user_id+service_id required' }, { status: 400 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('user-services DELETE:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
