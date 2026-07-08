import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceSlug = searchParams.get('workspace_slug');
    const workspaceId = searchParams.get('workspace_id');
    const serviceProviderId = searchParams.get('service_provider_id')?.trim() || null;
    const slugParam = searchParams.get('slug');

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

    const slug =
      typeof slugParam === 'string' && slugParam.trim() !== ''
        ? decodeURIComponent(slugParam.trim())
        : null;

    if (slug) {
      const { data: row, error: slugError } = await supabase
        .from('event_types')
        .select('id, title, slug, duration_minutes, owner_id, is_public, location_type, status')
        .eq('workspace_id', workspaceIdResolved)
        .eq('slug', slug)
        .eq('status', 'active')
        .maybeSingle();

      if (slugError) {
        console.error('Error fetching event type by slug:', slugError);
        return NextResponse.json(
          { error: slugError.message },
          { status: 500 }
        );
      }

      if (!row) {
        return NextResponse.json(
          { error: 'Event type not found' },
          { status: 404 }
        );
      }

      if (
        serviceProviderId &&
        row.owner_id &&
        row.owner_id !== serviceProviderId
      ) {
        return NextResponse.json(
          { error: 'Event type not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ data: [row] });
    }

    let query = supabase
      .from('event_types')
      .select('id, title, slug, duration_minutes, owner_id, is_public, location_type, status')
      .eq('workspace_id', workspaceIdResolved)
      .eq('is_public', true)
      .eq('status', 'active');

    if (serviceProviderId) {
      query = query.eq('owner_id', serviceProviderId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

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
