import { NextResponse } from 'next/server';
import { PlanLimitError } from '@app/db/subscription';

export function planLimitErrorResponse(err: unknown): NextResponse | null {
  if (!(err instanceof PlanLimitError)) return null;
  const status = err.code === 'FEATURE_GATED' ? 403 : 402;
  return NextResponse.json(
    {
      error: err.message,
      code: err.code,
      plan: err.planSlug,
      upgradeRequired: err.upgradeRequired,
    },
    { status }
  );
}
