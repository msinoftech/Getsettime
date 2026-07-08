import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  assert_same_origin_url,
  get_or_create_short_link,
} from '@/lib/short_link_service';

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

function parse_workspace_id(user: { user_metadata?: Record<string, unknown> }): number | null {
  const raw = user.user_metadata?.workspace_id;
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspace_id = parse_workspace_id(user);
    if (workspace_id === null) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 400 });
    }

    const body = (await req.json()) as { original_url?: unknown };
    const original_url =
      typeof body.original_url === 'string' ? body.original_url.trim() : '';

    if (!original_url) {
      return NextResponse.json({ error: 'original_url is required' }, { status: 400 });
    }

    try {
      assert_same_origin_url(original_url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Invalid URL';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const result = await get_or_create_short_link({
      workspace_id,
      original_url,
      created_by: user.id,
    });

    return NextResponse.json({
      short_url: result.short_url,
      short_code: result.short_code,
      original_url: result.original_url,
      reused: result.reused,
    });
  } catch (error) {
    console.error('Error creating short link:', error);
    const message =
      error instanceof Error ? error.message : 'Failed to create short link';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
