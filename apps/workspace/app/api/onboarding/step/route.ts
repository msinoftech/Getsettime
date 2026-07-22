import { NextRequest, NextResponse } from 'next/server';
import type { DaySchedule } from '@/src/types/workspace';
import {
  apply_onboarding_step1,
  apply_onboarding_step2,
  apply_onboarding_step3,
  resolve_onboarding_auth_context,
} from '@/lib/onboarding-persistence';

export async function POST(req: NextRequest) {
  try {
    const ctxOrError = await resolve_onboarding_auth_context(req);
    if ('error' in ctxOrError) {
      return NextResponse.json({ error: ctxOrError.error }, { status: ctxOrError.status });
    }

    const body = await req.json();
    const step = body?.step;

    if (step === 1) {
      const departmentNames = Array.isArray(body.department_names)
        ? (body.department_names as unknown[])
            .map((n) => (typeof n === 'string' ? n.trim() : ''))
            .filter((n): n is string => n.length > 0)
        : [];

      const result = await apply_onboarding_step1(ctxOrError, {
        department_names: departmentNames,
        professions_list_id:
          body.professions_list_id != null ? Number(body.professions_list_id) : undefined,
        custom_profession:
          typeof body.custom_profession === 'string' ? body.custom_profession : undefined,
      });

      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json({ ok: true, step: 1 });
    }

    if (step === 2) {
      const result = await apply_onboarding_step2(ctxOrError);
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json({ ok: true, step: 2 });
    }

    if (step === 3) {
      const timesheet = body?.timesheet;
      if (!timesheet || typeof timesheet !== 'object') {
        return NextResponse.json({ error: 'timesheet is required' }, { status: 400 });
      }

      const result = await apply_onboarding_step3(
        ctxOrError,
        timesheet as Record<string, DaySchedule>
      );
      if (result.error) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json({ ok: true, step: 3 });
    }

    return NextResponse.json({ error: 'Invalid step' }, { status: 400 });
  } catch (err: unknown) {
    console.error('onboarding/step:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    );
  }
}
