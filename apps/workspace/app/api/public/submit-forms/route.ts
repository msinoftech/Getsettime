import { NextResponse } from 'next/server';
import { submitPublicForm } from '@app/db/public_form_submissions';
import { guardPublicMarketingApi } from '@/lib/public-api-auth';
import {
  jsonWithPublicPlansCors,
  resolvePublicApiCallerOrigin,
  withPublicPlansCors,
} from '@/lib/public-plans-http';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const SUCCESS_MESSAGE = 'Form submitted successfully';

function formJson(
  req: Request,
  status: boolean,
  message: string,
  init?: ResponseInit
) {
  return jsonWithPublicPlansCors(req, { status, message }, init);
}

export async function OPTIONS(req: Request) {
  return withPublicPlansCors(req, new NextResponse(null, { status: 204 }));
}

/** Unified marketing form submit (contact, solutions, claim_free). */
export async function POST(req: Request) {
  const denied = guardPublicMarketingApi(req);
  if (denied) {
    const code = denied.status;
    const message =
      code === 401
        ? 'Unauthorized.'
        : code === 500
          ? 'Server configuration error.'
          : 'Access denied.';
    return formJson(req, false, message, { status: code });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return formJson(req, false, 'Server configuration error', { status: 500 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return formJson(req, false, 'Invalid JSON', { status: 400 });
  }

  const callerOrigin = resolvePublicApiCallerOrigin(req);
  const source =
    typeof body.source === 'string'
      ? body.source
      : (callerOrigin ?? undefined);

  try {
    await submitPublicForm(supabase, body, source);
    return formJson(req, true, SUCCESS_MESSAGE, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    const status = message.includes('required') || message.includes('must') || message.includes('Valid')
      ? 400
      : 500;
    if (status === 500) console.error('POST /api/public/submit-forms:', err);
    return formJson(req, false, message, { status });
  }
}