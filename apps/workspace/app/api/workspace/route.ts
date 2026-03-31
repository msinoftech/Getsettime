import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

async function get_or_create_workspace_profession_id(
  supabase: SupabaseClient,
  name: string
): Promise<{ id: number | null; error?: string }> {
  const trimmed = name.trim();
  if (!trimmed) {
    return { id: null, error: 'Profession name is empty' };
  }

  const lower = trimmed.toLowerCase();

  const { data: exact } = await supabase.from('professions').select('id').eq('name', trimmed).maybeSingle();
  if (exact?.id != null) {
    return { id: exact.id };
  }

  const { data: professionRows, error: listErr } = await supabase.from('professions').select('id, name');
  if (listErr) {
    return { id: null, error: listErr.message };
  }
  const caseInsensitiveHit = (professionRows ?? []).find((r) => r.name.toLowerCase() === lower);
  if (caseInsensitiveHit?.id != null) {
    return { id: caseInsensitiveHit.id };
  }

  const { data: inserted, error } = await supabase
    .from('professions')
    .insert({ name: trimmed, enabled: true })
    .select('id')
    .single();

  if (error) {
    if (error.code === '23505') {
      const { data: again } = await supabase.from('professions').select('id, name');
      const hit = (again ?? []).find((r) => r.name.toLowerCase() === lower);
      if (hit?.id != null) return { id: hit.id };
    }
    return { id: null, error: error.message };
  }

  return { id: inserted?.id ?? null };
}

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || null;

  if (!token) {
    return null;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const verifyClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: { user }, error } = await verifyClient.auth.getUser(token);
  if (error || !user) {
    return null;
  }

  return user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from('workspaces')
      .select('id, name, slug, logo_url, type, profession_id, professions(name)')
      .eq('id', workspaceId)
      .single();

    if (error) {
      console.error('Error fetching workspace:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    const row = data as {
      id: number;
      name: string;
      slug: string;
      logo_url: string | null;
      type: string | null;
      profession_id: number | null;
      professions: { name?: string } | null;
    };

    return NextResponse.json({
      workspace: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        logo_url: row.logo_url,
        type: row.type,
        profession_id: row.profession_id,
        profession_name: row.professions?.name ?? null,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const body = await req.json();
    const { name, slug, logo_url, type, profession_id, professions_list_id, custom_profession } = body as {
      name?: unknown;
      slug?: unknown;
      logo_url?: unknown;
      type?: unknown;
      profession_id?: unknown;
      professions_list_id?: unknown;
      custom_profession?: unknown;
    };

    const supabase = createSupabaseServerClient();
    const updateData: {
      name?: string;
      slug?: string;
      logo_url?: string | null;
      type?: string | null;
      profession_id?: number | null;
    } = {};

    let professionResolvedFromOnboarding = false;

    if (professions_list_id !== undefined && professions_list_id !== null && professions_list_id !== '') {
      const lid = Number(professions_list_id);
      if (!Number.isFinite(lid) || lid <= 0) {
        return NextResponse.json({ error: 'Invalid professions_list_id' }, { status: 400 });
      }
      const { data: listRow, error: listErr } = await supabase
        .from('professions_list')
        .select('name, enabled')
        .eq('id', lid)
        .maybeSingle();
      if (listErr || !listRow?.name) {
        return NextResponse.json({ error: 'Profession catalog entry not found' }, { status: 400 });
      }
      if (listRow.enabled === false) {
        return NextResponse.json({ error: 'This profession is not available for selection' }, { status: 400 });
      }
      const resolved = await get_or_create_workspace_profession_id(supabase, listRow.name);
      if (resolved.id == null) {
        return NextResponse.json(
          { error: resolved.error ?? 'Could not assign profession' },
          { status: 500 }
        );
      }
      updateData.type = listRow.name;
      updateData.profession_id = resolved.id;
      professionResolvedFromOnboarding = true;
    } else if (
      custom_profession !== undefined &&
      custom_profession !== null &&
      typeof custom_profession === 'string' &&
      custom_profession.trim()
    ) {
      const label = custom_profession.trim();
      const resolved = await get_or_create_workspace_profession_id(supabase, label);
      if (resolved.id == null) {
        return NextResponse.json(
          { error: resolved.error ?? 'Could not assign profession' },
          { status: 500 }
        );
      }
      updateData.type = label;
      updateData.profession_id = resolved.id;
      professionResolvedFromOnboarding = true;
    }

    if (name !== undefined && typeof name === 'string') {
      updateData.name = name;
    }

    if (slug !== undefined) {
      const trimmedSlug = typeof slug === 'string' ? slug.trim().toLowerCase() : '';
      if (trimmedSlug) {
        const slugRegex = /^[a-z0-9_-]+$/;
        if (!slugRegex.test(trimmedSlug)) {
          return NextResponse.json({ error: 'Slug must contain only lowercase letters, numbers, hyphens, and underscores' }, { status: 400 });
        }
        const { data: existing } = await supabase
          .from('workspaces')
          .select('id')
          .eq('slug', trimmedSlug)
          .neq('id', workspaceId)
          .maybeSingle();
        if (existing) {
          return NextResponse.json({ error: 'Slug already exists' }, { status: 409 });
        }
        updateData.slug = trimmedSlug;
      }
    }

    if (logo_url !== undefined) {
      updateData.logo_url =
        typeof logo_url === 'string' && logo_url.trim() ? logo_url.trim() : null;
    }

    if (type !== undefined && !professionResolvedFromOnboarding) {
      updateData.type = type && typeof type === 'string' ? type : null;
    }

    if (profession_id !== undefined && !professionResolvedFromOnboarding) {
      updateData.profession_id = typeof profession_id === 'number' ? profession_id : null;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('workspaces')
      .update(updateData)
      .eq('id', workspaceId)
      .select('id, name, slug, logo_url, type')
      .single();

    if (error) {
      console.error('Error updating workspace:', error);
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ workspace: data });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

