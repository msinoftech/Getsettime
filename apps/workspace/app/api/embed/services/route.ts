import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceSlug = searchParams.get('workspace_slug');
    const workspaceId = searchParams.get('workspace_id');
    const departmentIdRaw = searchParams.get('department_id');
    const serviceProviderId = searchParams.get('service_provider_id');

    if (!workspaceSlug && !workspaceId) {
      return NextResponse.json(
        { error: 'Workspace slug or ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();
    let workspaceIdResolved: string | null = null;

    if (workspaceSlug && !workspaceId) {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('slug', workspaceSlug)
        .single();

      if (!workspace) {
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
      }

      workspaceIdResolved = workspace.id;
    } else if (workspaceId) {
      workspaceIdResolved = workspaceId;
    }

    if (!workspaceIdResolved) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    let query = supabase
      .from('services')
      .select('id,name,description,price,department_id,status,meta_data')
      .eq('workspace_id', workspaceIdResolved)
      .eq('flag', true)
      .order('created_at', { ascending: false });

    const departmentIdParsed =
      departmentIdRaw !== null && departmentIdRaw.trim() !== ''
        ? parseInt(departmentIdRaw.trim(), 10)
        : NaN;
    if (Number.isFinite(departmentIdParsed) && departmentIdParsed > 0) {
      query = query.eq('department_id', departmentIdParsed);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching embed services:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let rows = data || [];

    const { data: links } = await supabase
      .from('user_services')
      .select('service_id, user_id')
      .eq('workspace_id', workspaceIdResolved);

    const providersByService = new Map<string, Set<string>>();
    for (const l of links ?? []) {
      const sid = l.service_id as string;
      const uid = l.user_id as string;
      if (!providersByService.has(sid)) providersByService.set(sid, new Set());
      providersByService.get(sid)!.add(uid);
    }

    if (typeof serviceProviderId === 'string' && serviceProviderId.trim() !== '') {
      const pid = serviceProviderId.trim();
      rows = rows.filter((row) => {
        if (row.status !== 'active') return false;
        const allowed = providersByService.get(row.id as string);
        return allowed?.has(pid) ?? false;
      });
    }

    const enriched = rows.map((row) => {
      const meta = (row.meta_data as Record<string, unknown> | null) ?? {};
      const { service_providers: _legacy, ...rest } = meta;
      const uids = [...(providersByService.get(row.id as string) ?? [])];
      const service_providers = uids.map((id) => ({ id, name: '' }));
      return {
        ...row,
        meta_data: { ...rest, service_providers },
      };
    });

    return NextResponse.json({ services: enriched });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
