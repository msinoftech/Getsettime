import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabaseServer';
import { deactivatePlan, updatePlanWithContent } from '@app/db/subscription';
import { parsePartialPlanInput } from '@/lib/planValidation';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolved = await Promise.resolve(params);
    const planId = Number(resolved.id);
    if (!Number.isFinite(planId) || planId <= 0) {
      return NextResponse.json({ error: 'Invalid plan id' }, { status: 400 });
    }

    const body = (await req.json()) as Record<string, unknown>;
    const patch = parsePartialPlanInput(body);
    const supabase = getSupabaseServer();

    const { data: current, error: curErr } = await supabase
      .from('plans')
      .select('id, slug')
      .eq('id', planId)
      .maybeSingle();

    if (curErr || !current) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    if (current.slug === 'free' && patch.slug && patch.slug !== 'free') {
      return NextResponse.json({ error: 'Cannot change slug of the free plan' }, { status: 400 });
    }

    if (patch.slug) {
      const { data: existing } = await supabase
        .from('plans')
        .select('id')
        .eq('slug', patch.slug)
        .neq('id', planId)
        .maybeSingle();

      if (existing) {
        return NextResponse.json({ error: 'A plan with this slug already exists' }, { status: 409 });
      }
    }

    const plan = await updatePlanWithContent(supabase, planId, patch);
    return NextResponse.json({ plan, message: 'Plan updated' }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('PATCH /api/plans/[id] error:', err);
    const status =
      message.includes('must') || message.includes('Provide') || message.includes('Cannot') ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const resolved = await Promise.resolve(params);
    const planId = Number(resolved.id);
    if (!Number.isFinite(planId) || planId <= 0) {
      return NextResponse.json({ error: 'Invalid plan id' }, { status: 400 });
    }

    const supabase = getSupabaseServer();

    const { data: current, error: curErr } = await supabase
      .from('plans')
      .select('id, slug')
      .eq('id', planId)
      .maybeSingle();

    if (curErr || !current) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    if (current.slug === 'free') {
      return NextResponse.json({ error: 'Cannot deactivate the free plan' }, { status: 400 });
    }

    const plan = await deactivatePlan(supabase, planId);
    return NextResponse.json({ plan, message: 'Plan deactivated' }, { status: 200 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('DELETE /api/plans/[id] error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
