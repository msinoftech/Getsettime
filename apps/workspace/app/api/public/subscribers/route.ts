import { NextResponse } from 'next/server';
import {
  addPublicSubscriber,
  isValidSubscriberEmail,
  normalizeSubscriberEmail,
  PublicSubscriberDuplicateError,
  sanitizeSubscriberSource,
} from '@app/db/public_subscribers';
import {
  jsonWithPublicPlansCors,
  resolvePublicApiCallerOrigin,
  withPublicPlansCors,
} from '@/lib/public-plans-http';
import { guardPublicMarketingApi } from '@/lib/public-api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const SUCCESS_MESSAGE = 'Email subscribed successfully';

function subscriberJson(
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

/** Email-only signup from allowlisted external sites (same CORS list as public plans). */
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
    return subscriberJson(req, false, message, { status: code });
  }

  const callerOrigin = resolvePublicApiCallerOrigin(req);

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return subscriberJson(req, false, 'Server configuration error', { status: 500 });
  }

  let body: { email?: string; source?: string };
  try {
    body = (await req.json()) as { email?: string; source?: string };
  } catch {
    return subscriberJson(req, false, 'Invalid JSON', { status: 400 });
  }

  if (typeof body.email !== 'string') {
    return subscriberJson(req, false, 'Valid email is required', { status: 400 });
  }

  const email = normalizeSubscriberEmail(body.email);
  if (!isValidSubscriberEmail(email)) {
    return subscriberJson(req, false, 'Valid email is required', { status: 400 });
  }

  const source =
    sanitizeSubscriberSource(
      typeof body.source === 'string' ? body.source : (callerOrigin ?? null)
    ) ?? undefined;

  try {
    await addPublicSubscriber(supabase, email, source);
    return subscriberJson(req, true, SUCCESS_MESSAGE, { status: 201 });
  } catch (err: unknown) {
    if (err instanceof PublicSubscriberDuplicateError) {
      return subscriberJson(req, false, err.message, { status: 409 });
    }
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('POST /api/public/subscribers:', err);
    return subscriberJson(req, false, message, { status: 500 });
  }
}