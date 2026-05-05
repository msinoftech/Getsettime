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
    const departmentId = searchParams.get('department_id');

    let query = supabase
      .from('user_departments')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (userId) query = query.eq('user_id', userId);
    if (departmentId) {
      const d = parseInt(departmentId, 10);
      if (Number.isFinite(d) && d > 0) query = query.eq('department_id', d);
    }

    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) {
      console.error('user-departments GET:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ assignments: data ?? [] });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('user-departments GET:', error);
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
    const departmentIdNum =
      typeof body.department_id === 'number'
        ? body.department_id
        : typeof body.department_id === 'string'
          ? parseInt(body.department_id, 10)
          : NaN;
    if (!userId || !Number.isFinite(departmentIdNum) || departmentIdNum <= 0) {
      return NextResponse.json({ error: 'user_id and department_id are required' }, { status: 400 });
    }

    const { data: dept, error: deptErr } = await supabase
      .from('departments')
      .select('id')
      .eq('id', departmentIdNum)
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    if (deptErr || !dept) {
      return NextResponse.json({ error: 'Department not found in workspace' }, { status: 400 });
    }

    const { data: row, error } = await supabase
      .from('user_departments')
      .insert({
        user_id: userId,
        department_id: departmentIdNum,
        workspace_id: workspaceId,
      })
      .select()
      .single();

    if (error) {
      console.error('user-departments POST:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ assignment: row }, { status: 201 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('user-departments POST:', error);
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
    const deptIdsRaw = body.department_ids;
    if (!userId || !Array.isArray(deptIdsRaw)) {
      return NextResponse.json({ error: 'user_id and department_ids[] are required' }, { status: 400 });
    }

    const departmentIds = deptIdsRaw
      .map((x: unknown) => (typeof x === 'number' ? x : typeof x === 'string' ? parseInt(x, 10) : NaN))
      .filter((n: number) => Number.isInteger(n) && n > 0);

    const { error: delErr } = await supabase
      .from('user_departments')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId);
    if (delErr) {
      console.error('user-departments PUT delete:', delErr);
      return NextResponse.json({ error: delErr.message }, { status: 500 });
    }

    if (departmentIds.length === 0) {
      return NextResponse.json({ success: true, assignments: [] });
    }

    const { data: validDepts, error: vErr } = await supabase
      .from('departments')
      .select('id')
      .eq('workspace_id', workspaceId)
      .in('id', departmentIds);
    if (vErr) {
      return NextResponse.json({ error: vErr.message }, { status: 500 });
    }
    const allowed = new Set((validDepts ?? []).map((r) => r.id));
    const toInsert = [...new Set(departmentIds)].filter((id) => allowed.has(id));
    if (toInsert.length === 0) {
      return NextResponse.json({ success: true, assignments: [] });
    }

    const rows = toInsert.map((department_id) => ({
      user_id: userId,
      department_id,
      workspace_id: workspaceId,
    }));

    const { data: inserted, error: insErr } = await supabase
      .from('user_departments')
      .insert(rows)
      .select();
    if (insErr) {
      console.error('user-departments PUT insert:', insErr);
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, assignments: inserted ?? [] });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('user-departments PUT:', error);
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
    const departmentId = searchParams.get('department_id');

    if (id) {
      const { error } = await supabase
        .from('user_departments')
        .delete()
        .eq('id', id)
        .eq('workspace_id', workspaceId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    if (userId && departmentId) {
      const d = parseInt(departmentId, 10);
      if (!Number.isFinite(d) || d <= 0) {
        return NextResponse.json({ error: 'Invalid department_id' }, { status: 400 });
      }
      const { error } = await supabase
        .from('user_departments')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', userId)
        .eq('department_id', d);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'id or user_id+department_id required' }, { status: 400 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('user-departments DELETE:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
