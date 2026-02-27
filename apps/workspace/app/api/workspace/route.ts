import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';
import { createClient } from '@supabase/supabase-js';

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
      .select('id, name, slug, logo_url')
      .eq('id', workspaceId)
      .single();

    if (error) {
      console.error('Error fetching workspace:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
    }

    return NextResponse.json({ workspace: data });
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
    const { name, slug, logo_url, type } = body;

    const supabase = createSupabaseServerClient();
    const updateData: { name?: string; slug?: string; logo_url?: string | null; type?: string | null } = {};

    if (name !== undefined) {
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
      updateData.logo_url = logo_url || null;
    }

    if (type !== undefined) {
      updateData.type = type && ['Doctor', 'Salon', 'Artist'].includes(type) ? type : null;
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

