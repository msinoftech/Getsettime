import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';
import { listActivePlansWithContent } from '@app/db/subscription';

/** Read-only catalog for workspace billing UI (RLS-scoped session client). */
export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const plans = await listActivePlansWithContent(supabase, 'upgrade_modal');

    const publicPlans = plans.map(({ metadata: _metadata, ...plan }) => plan);

    return NextResponse.json({ plans: publicPlans });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('GET /api/billing/plans:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}
