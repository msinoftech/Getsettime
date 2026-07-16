import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceSlug = searchParams.get('workspace_slug');
    const workspaceIdParam = searchParams.get('workspace_id');
    const serviceProviderId = searchParams.get('service_provider_id')?.trim() || '';
    const from = searchParams.get('from')?.trim() || '';
    const to = searchParams.get('to')?.trim() || '';

    if (!workspaceSlug && !workspaceIdParam) {
      return NextResponse.json(
        { error: 'Workspace slug or ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();
    let workspaceIdResolved: number | null = null;

    if (workspaceSlug && !workspaceIdParam) {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('slug', workspaceSlug)
        .single();

      if (!workspace) {
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
      }
      workspaceIdResolved = Number(workspace.id);
    } else if (workspaceIdParam) {
      workspaceIdResolved = Number(workspaceIdParam);
    }

    if (!workspaceIdResolved || !Number.isFinite(workspaceIdResolved)) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    // Fetch active exceptions for workspace. Yearly repeats may fall outside
    // [from, to] by year, so for ranges we also include repeat_yearly rows.
    let query = supabase
      .from('date_exceptions')
      .select('*')
      .eq('workspace_id', workspaceIdResolved)
      .eq('status', 'active')
      .order('exception_date', { ascending: true });

    if (serviceProviderId) {
      query = query.or(`provider_id.is.null,provider_id.eq.${serviceProviderId}`);
    } else {
      query = query.is('provider_id', null);
    }

    if (from && to && /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      query = query.or(
        `and(exception_date.gte.${from},exception_date.lte.${to}),repeat_yearly.eq.true`
      );
    } else if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      query = query.or(`exception_date.gte.${from},repeat_yearly.eq.true`);
    } else if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
      query = query.or(`exception_date.lte.${to},repeat_yearly.eq.true`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching embed date_exceptions:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ exceptions: data || [] });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
