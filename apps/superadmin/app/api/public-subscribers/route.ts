import { NextRequest, NextResponse } from 'next/server';
import { listPublicSubscribers } from '@app/db/public_subscribers';
import { getSupabaseServer } from '@/lib/supabaseServer';

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServer();
    const searchParams = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '25', 10)));
    const email = searchParams.get('email')?.trim() ?? '';

    const result = await listPublicSubscribers(supabase, { page, limit, email });
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('GET /api/public-subscribers error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}