import { NextResponse } from 'next/server';
import type { plan_content, plans_with_content } from '@app/db/subscription';
import {
  CLAIM_FREE_PLAN_SLUG,
  listActivePlansWithContent,
  UNLIMITED_BOOKING_LIMIT,
} from '@app/db/subscription';
import { jsonWithPublicPlansCors, withPublicPlansCors } from '@/lib/public-plans-http';
import { guardPublicMarketingApi } from '@/lib/public-api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

type public_plan_limit = number | 'unlimited';

type public_plan_content_json = Omit<
  plan_content,
  'id' | 'plan_id' | 'created_at' | 'updated_at' | 'display_order'
>;

type public_plan_json = Omit<
  plans_with_content,
  | 'id'
  | 'user_limit'
  | 'workspace_limit'
  | 'admin_limit'
  | 'booking_limit'
  | 'service_provider_limit'
  | 'content'
  | 'created_at'
  | 'updated_at'
> & {
  booking_limit: public_plan_limit;
  service_provider_limit: public_plan_limit;
  content: public_plan_content_json | null;
};

function toPublicLimitValue(value: number): public_plan_limit {
  return value === UNLIMITED_BOOKING_LIMIT ? 'unlimited' : value;
}

function contentToPublicJson(
  content: plan_content | null
): public_plan_content_json | null {
  if (!content) return null;
  const {
    id: _id,
    plan_id: _planId,
    created_at: _createdAt,
    updated_at: _updatedAt,
    display_order: _displayOrder,
    ...rest
  } = content;
  return rest;
}

function planToPublicJson(plan: plans_with_content): public_plan_json {
  const {
    id: _id,
    user_limit: _userLimit,
    workspace_limit: _workspaceLimit,
    admin_limit: _adminLimit,
    created_at: _createdAt,
    updated_at: _updatedAt,
    booking_limit,
    service_provider_limit,
    content,
    ...rest
  } = plan;
  return {
    ...rest,
    booking_limit: toPublicLimitValue(booking_limit),
    service_provider_limit: toPublicLimitValue(service_provider_limit),
    content: contentToPublicJson(content),
  };
}

export async function OPTIONS(req: Request) {
  return withPublicPlansCors(req, new NextResponse(null, { status: 204 }));
}

/** Read-only plan catalog for allowlisted external pricing pages (CORS). */
export async function GET(req: Request) {
  const denied = guardPublicMarketingApi(req);
  if (denied) return denied;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return jsonWithPublicPlansCors(req, { error: 'Server configuration error' }, { status: 500 });
  }

  try {
    const rows = await listActivePlansWithContent(supabase, 'upgrade_modal');
    const plans = rows
      .filter((plan) => plan.slug !== CLAIM_FREE_PLAN_SLUG)
      .map(planToPublicJson);
    return jsonWithPublicPlansCors(req, { plans });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    console.error('GET /api/public/plans:', err);
    return jsonWithPublicPlansCors(req, { error: message }, { status: 500 });
  }
}