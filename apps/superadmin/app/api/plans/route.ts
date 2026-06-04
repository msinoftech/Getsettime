import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { createPlanWithContent, listAllPlansWithContent } from '@app/db/subscription';
import { parsePlanInput } from '@/lib/planValidation';

export async function GET() {
  try {
    const supabase = getSupabaseServer();
    const plans = await listAllPlansWithContent(supabase);
    return NextResponse.json({ plans }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('GET /api/plans error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const input = parsePlanInput(body);
    const supabase = getSupabaseServer();

    const { data: existing } = await supabase
      .from('plans')
      .select('id')
      .eq('slug', input.slug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'A plan with this slug already exists' }, { status: 409 });
    }

    const plan = await createPlanWithContent(supabase, input);
    return NextResponse.json({ plan, message: 'Plan created' }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('POST /api/plans error:', err);
    const status = message.includes('required') || message.includes('must') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
