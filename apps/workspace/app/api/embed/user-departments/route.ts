import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';

function resolveWorkspaceId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  workspaceSlug: string | null,
  workspaceId: string | null
): Promise<string | null> {
  if (workspaceSlug && !workspaceId) {
    return supabase
      .from('workspaces')
      .select('id')
      .eq('slug', workspaceSlug)
      .single()
      .then(({ data }) => (data?.id != null ? String(data.id) : null));
  }
  if (workspaceId) return Promise.resolve(workspaceId);
  return Promise.resolve(null);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceSlug = searchParams.get('workspace_slug');
    const workspaceId = searchParams.get('workspace_id');
    const userId = searchParams.get('user_id');
    const departmentId = searchParams.get('department_id');

    if (!workspaceSlug && !workspaceId) {
      return NextResponse.json(
        { error: 'Workspace slug or ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();
    const workspaceIdResolved = await resolveWorkspaceId(supabase, workspaceSlug, workspaceId);
    if (!workspaceIdResolved) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    let query = supabase
      .from('user_departments')
      .select('id,user_id,department_id,workspace_id,created_at')
      .eq('workspace_id', workspaceIdResolved);

    if (userId) query = query.eq('user_id', userId);
    if (departmentId) {
      const d = parseInt(departmentId, 10);
      if (Number.isFinite(d) && d > 0) query = query.eq('department_id', d);
    }

    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) {
      console.error('embed user-departments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ assignments: data ?? [] });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('embed user-departments:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
