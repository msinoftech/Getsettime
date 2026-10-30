import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  resolveAvatarUrlFromMetadata,
  resolveDisplayNameFromMetadata,
} from '@app/db/user-avatar';
import { user_belongs_to_workspace } from '@/lib/team_members_workspace';

function createAuthenticatedClient(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  return { supabase, token };
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Batch-resolve avatar URLs for workspace users by id. */
export async function GET(req: NextRequest) {
  try {
    const auth = createAuthenticatedClient(req);
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const {
      data: { user },
      error: authError,
    } = await auth.supabase.auth.getUser(auth.token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const idsParam = req.nextUrl.searchParams.get('ids')?.trim() ?? '';
    const ids = idsParam
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    if (ids.length === 0) {
      return NextResponse.json({ error: 'ids query parameter is required' }, { status: 400 });
    }
    if (ids.length > 50) {
      return NextResponse.json({ error: 'Maximum 50 ids per request' }, { status: 400 });
    }

    const adminClient = createAdminClient();
    if (!adminClient) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    const users = [];
    for (const id of ids) {
      const { data, error } = await adminClient.auth.admin.getUserById(id);
      if (error || !data.user) continue;
      if (!user_belongs_to_workspace(data.user, workspaceId)) continue;
      const meta = data.user.user_metadata as Record<string, unknown> | undefined;
      users.push({
        id: data.user.id,
        email: data.user.email ?? null,
        name: resolveDisplayNameFromMetadata(meta, data.user.email ?? undefined),
        avatar_url: resolveAvatarUrlFromMetadata(meta),
      });
    }

    return NextResponse.json({ users });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
