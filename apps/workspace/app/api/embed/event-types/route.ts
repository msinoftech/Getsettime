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

    if (!workspaceIdResolved) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    // Fetch all event types for the workspace (for embed bookings, show all available)
    const { data, error } = await supabase
      .from('event_types')
      .select('id, title, slug, duration_minutes')
      .eq('workspace_id', workspaceIdResolved)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching event types:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: data || [] });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}

