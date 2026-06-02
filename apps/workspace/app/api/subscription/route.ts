import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@app/db';
import { getWorkspacePlanSnapshot, getWorkspaceUsage } from '@app/db/subscription';

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

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceIdRaw = user.user_metadata?.workspace_id;
    const workspaceId =
      typeof workspaceIdRaw === 'number'
        ? workspaceIdRaw
        : parseInt(String(workspaceIdRaw ?? ''), 10);

    if (!Number.isFinite(workspaceId) || workspaceId <= 0) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const supabaseAdmin = createSupabaseServerClient();
    const snapshot = await getWorkspacePlanSnapshot(supabaseAdmin, workspaceId);
    const usage = await getWorkspaceUsage(supabaseAdmin, workspaceId);

    return NextResponse.json({
      plan: snapshot.plan,
      subscription: snapshot.subscription,
      usage,
      thresholds: {
        booking_warning_percent: 80,
        booking_warning: usage.booking_warning_threshold,
        booking_limit_reached: usage.booking_limit_reached,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('GET /api/subscription:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
