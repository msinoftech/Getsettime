import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@app/db';
import { ROLE_SERVICE_PROVIDER } from '@/src/constants/roles';
import {
  createServiceProviderEventType,
  syncServiceProviderEventTypeLocation,
} from '@/lib/workspace-service';

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

    const { data, error } = await createServiceProviderEventType(supabaseAdmin, {
      workspaceId,
      ownerId: user.id,
    });

    if (error || !data) {
      return NextResponse.json(
        { error: error ?? 'Failed to create event type' },
        { status: 500 }
      );
    }

    const { error: locSyncErr } = await syncServiceProviderEventTypeLocation(
      supabaseAdmin,
      workspaceId,
      user.id
    );
    if (locSyncErr) {
      console.warn('SP event_type location sync (non-critical):', locSyncErr);
    }

    return NextResponse.json({ data: { id: data.id } });
  } catch (err: unknown) {
    console.error('service-provider-event-type:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
