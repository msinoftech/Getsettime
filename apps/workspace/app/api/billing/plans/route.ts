import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';
import { listActivePlans } from '@app/db/subscription';

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const plans = await listActivePlans(supabase);
    return NextResponse.json({ plans });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('GET /api/billing/plans:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
