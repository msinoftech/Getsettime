import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@app/db';
import { ROLE_SERVICE_PROVIDER } from '@/src/constants/roles';
import {
  get_provider_link_slug_for_user,
  merge_workspace_provider_links,
  resolve_unique_provider_link_slug,
} from '@/lib/provider_booking_link';
import { build_service_provider_public_booking_url } from '@/src/utils/public_booking_link';

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || null;
  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const verifyClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const {
    data: { user },
    error,
  } = await verifyClient.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createSupabaseServerClient();
    const { data: authRow } = await supabaseAdmin.auth.admin.getUserById(user.id);
    const meta = (authRow?.user?.user_metadata ?? user.user_metadata) as Record<
      string,
      unknown
    >;
    const role = meta.role as string | undefined;
    if (role !== ROLE_SERVICE_PROVIDER) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const workspaceIdRaw = meta.workspace_id ?? user.user_metadata?.workspace_id;
    const workspaceId =
      typeof workspaceIdRaw === 'number'
        ? workspaceIdRaw
        : typeof workspaceIdRaw === 'string'
          ? parseInt(workspaceIdRaw, 10)
          : NaN;

    if (!Number.isFinite(workspaceId) || workspaceId <= 0) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const { data: workspaceRow, error: workspaceError } = await supabaseAdmin
      .from('workspaces')
      .select('slug')
      .eq('id', workspaceId)
      .maybeSingle();

    if (workspaceError) {
      return NextResponse.json({ error: workspaceError.message }, { status: 500 });
    }

    const workspaceSlug =
      typeof workspaceRow?.slug === 'string' ? workspaceRow.slug.trim() : '';
    if (!workspaceSlug) {
      return NextResponse.json(
        { error: 'Workspace booking link is not configured yet' },
        { status: 400 }
      );
    }

    const { data: existingConfig, error: fetchError } = await supabaseAdmin
      .from('configurations')
      .select('settings')
      .eq('workspace_id', workspaceId)
      .maybeSingle();

    if (fetchError && fetchError.code !== 'PGRST116') {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    const existingSettings = (existingConfig?.settings ?? {}) as Record<
      string,
      unknown
    >;
    const existingSlug = get_provider_link_slug_for_user(
      existingSettings.links,
      user.id
    );

    if (existingSlug) {
      const preview_url = build_service_provider_public_booking_url(
        workspaceSlug,
        existingSlug
      );
      return NextResponse.json({
        slug: existingSlug,
        workspace_slug: workspaceSlug,
        preview_url,
        created: false,
      });
    }

    const inviteName =
      typeof meta.name === 'string' ? meta.name.trim() : '';
    const emailFallback =
      typeof user.email === 'string' ? user.email : null;

    const { slug, error: slugError } = await resolve_unique_provider_link_slug(
      supabaseAdmin,
      workspaceId,
      inviteName,
      { emailFallback, excludeProviderId: user.id }
    );

    if (slugError || !slug) {
      return NextResponse.json(
        { error: slugError ?? 'Could not generate provider link' },
        { status: 500 }
      );
    }

    const mergedLinks = merge_workspace_provider_links(
      existingSettings.links,
      { [user.id]: { slug } },
      ROLE_SERVICE_PROVIDER,
      user.id
    );

    const mergedSettings = {
      ...existingSettings,
      links: mergedLinks,
    };

    let saveError: { message: string } | null = null;

    if (existingConfig) {
      const { error } = await supabaseAdmin
        .from('configurations')
        .update({ settings: mergedSettings })
        .eq('workspace_id', workspaceId);
      if (error) saveError = error;
    } else {
      const { error } = await supabaseAdmin.from('configurations').insert({
        workspace_id: workspaceId,
        settings: mergedSettings,
      });
      if (error) saveError = error;
    }

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }

    const preview_url = build_service_provider_public_booking_url(
      workspaceSlug,
      slug
    );

    return NextResponse.json({
      slug,
      workspace_slug: workspaceSlug,
      preview_url,
      created: true,
    });
  } catch (err: unknown) {
    console.error('service-provider-link:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
