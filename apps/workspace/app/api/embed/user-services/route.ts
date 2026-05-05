import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';

async function resolveWorkspaceId(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  workspaceSlug: string | null,
  workspaceId: string | null
): Promise<string | null> {
  if (workspaceSlug && !workspaceId) {
    const { data } = await supabase
      .from('workspaces')
      .select('id')
      .eq('slug', workspaceSlug)
      .single();
    return data?.id != null ? String(data.id) : null;
  }
  if (workspaceId) return workspaceId;
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceSlug = searchParams.get('workspace_slug');
    const workspaceId = searchParams.get('workspace_id');
    const userId = searchParams.get('user_id');
    const serviceId = searchParams.get('service_id');

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
      .from('user_services')
      .select('id,user_id,service_id,workspace_id,created_at')
      .eq('workspace_id', workspaceIdResolved);

    if (userId) query = query.eq('user_id', userId);
    if (serviceId) query = query.eq('service_id', serviceId);

    const { data, error } = await query.order('created_at', { ascending: true });
    if (error) {
      console.error('embed user-services:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ assignments: data ?? [] });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('embed user-services:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
