import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';

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

    const serviceProviderId = searchParams.get('service_provider_id')?.trim() || '';

    if (!workspaceIdResolved) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    let departmentIds: number[] | null = null;
    if (serviceProviderId) {
      const wsNum = Number(workspaceIdResolved);
      const { data: udRows, error: udError } = await supabase
        .from('user_departments')
        .select('department_id')
        .eq('workspace_id', wsNum)
        .eq('user_id', serviceProviderId);

      if (udError) {
        console.error('Error fetching provider departments:', udError);
        return NextResponse.json({ error: udError.message }, { status: 500 });
      }

      departmentIds = [
        ...new Set(
          (udRows ?? [])
            .map((row) => Number(row.department_id))
            .filter((id) => Number.isInteger(id) && id > 0)
        ),
      ];

      if (departmentIds.length === 0) {
        return NextResponse.json({ departments: [] });
      }
    }

    let query = supabase
      .from('departments')
      .select('id, name, description, status')
      .eq('workspace_id', workspaceIdResolved)
      .eq('flag', true)
      .eq('status', 'active');

    if (departmentIds) {
      query = query.in('id', departmentIds);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching departments:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ departments: data || [] });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
