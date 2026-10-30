import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extend_active_series_windows } from '@/lib/booking_series_service';

function getServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = req.headers.get('authorization');
  if (authHeader === `Bearer ${cronSecret}`) return true;
  const customHeader = req.headers.get('x-cron-secret');
  return customHeader === cronSecret;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getServiceRoleClient();
  const result = await extend_active_series_windows(supabase);
  return NextResponse.json({
    ok: result.errors.length === 0,
    extended: result.extended,
    skipped_plan_limit: result.skipped_plan_limit,
    errors: result.errors,
  });
}
