import type { SupabaseClient } from '@supabase/supabase-js';
import { UNLIMITED_BOOKING_LIMIT } from './booking_limit';
import { getPlanBySlug, rowToPlan } from './plans';
import type { plans } from './types';

export const CLAIM_FREE_PLAN_SLUG = 'free';
export const CLAIM_INVALID_MESSAGE = 'Your claim is not valid.';

export type claim_free_availability = {
  available: boolean;
  used: number;
  user_limit: number;
  remaining: number;
};

export type claimed_code_row = {
  id: string;
  code: string;
  status: string;
  origin: string;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
  forfeited_at: string | null;
  workspace_id: number | null;
  user_id: string | null;
  user_email: string | null;
};

function isUnlimitedUserLimit(limit: number): boolean {
  return limit === UNLIMITED_BOOKING_LIMIT || limit < 0;
}

export function getSelfServeRegistrationPlanSlug(): string {
  const raw = process.env.SELF_SERVE_REGISTRATION_PLAN_SLUG?.trim();
  return raw && raw.length > 0 ? raw : 'starter';
}

export async function countConsumedClaimCodes(
  supabase: SupabaseClient
): Promise<number> {
  const { count, error } = await supabase
    .from('claimed_codes')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'consumed');

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function getFreePlanUserLimit(
  supabase: SupabaseClient
): Promise<number> {
  const plan = await getPlanBySlug(supabase, CLAIM_FREE_PLAN_SLUG);
  if (!plan) return UNLIMITED_BOOKING_LIMIT;
  return plan.user_limit ?? UNLIMITED_BOOKING_LIMIT;
}

export async function getClaimFreeAvailability(
  supabase: SupabaseClient
): Promise<claim_free_availability> {
  const [used, user_limit] = await Promise.all([
    countConsumedClaimCodes(supabase),
    getFreePlanUserLimit(supabase),
  ]);

  if (isUnlimitedUserLimit(user_limit)) {
    return {
      available: true,
      used,
      user_limit,
      remaining: -1,
    };
  }

  const remaining = Math.max(0, user_limit - used);
  return {
    available: remaining > 0,
    used,
    user_limit,
    remaining,
  };
}

export async function getClaimedCodeByCode(
  supabase: SupabaseClient,
  code: string
): Promise<claimed_code_row | null> {
  const trimmed = code.trim();
  if (!trimmed) return null;

  const { data, error } = await supabase
    .from('claimed_codes')
    .select('*')
    .eq('code', trimmed)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as claimed_code_row;
}

export async function isEmailClaimIneligible(
  supabase: SupabaseClient,
  email: string
): Promise<boolean> {
  const norm = email.trim().toLowerCase();
  if (!norm) return false;

  const { data, error } = await supabase
    .from('claim_free_ineligible_emails')
    .select('email')
    .eq('email', norm)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** Validates code for pre-signup register page (must be pending, not expired). */
export async function validateClaimCodeForSignup(
  supabase: SupabaseClient,
  code: string
): Promise<{ valid: true; row: claimed_code_row } | { valid: false; message: string }> {
  const row = await getClaimedCodeByCode(supabase, code);
  if (!row) {
    return { valid: false, message: CLAIM_INVALID_MESSAGE };
  }

  if (row.status === 'consumed' || row.status === 'forfeited' || row.status === 'expired') {
    return { valid: false, message: CLAIM_INVALID_MESSAGE };
  }

  if (row.status === 'pending' && new Date(row.expires_at).getTime() < Date.now()) {
    await supabase.from('claimed_codes').update({ status: 'expired' }).eq('id', row.id);
    return { valid: false, message: CLAIM_INVALID_MESSAGE };
  }

  if (row.status !== 'pending') {
    return { valid: false, message: CLAIM_INVALID_MESSAGE };
  }

  const availability = await getClaimFreeAvailability(supabase);
  if (!availability.available) {
    return { valid: false, message: 'This offer is no longer available.' };
  }

  return { valid: true, row };
}

export async function mintClaimCode(
  supabase: SupabaseClient,
  params: { code: string; origin: string; expiresAt: string }
): Promise<claimed_code_row> {
  const { data, error } = await supabase
    .from('claimed_codes')
    .insert({
      code: params.code,
      origin: params.origin,
      status: 'pending',
      expires_at: params.expiresAt,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as claimed_code_row;
}

export async function consumeClaimCode(
  supabase: SupabaseClient,
  code: string,
  userId: string,
  userEmail: string | null
): Promise<string> {
  const { data, error } = await supabase.rpc('consume_claim_code', {
    p_code: code.trim(),
    p_user_id: userId,
    p_user_email: userEmail ?? '',
  });

  if (error) {
    const msg = error.message ?? '';
    if (
      msg.includes('INVALID_CLAIM') ||
      msg.includes('CLAIM_BLOCKED') ||
      msg.includes('CLAIM_CAP_REACHED') ||
      error.code === 'P0001'
    ) {
      throw new ClaimCodeError(
        msg.includes('CLAIM_CAP_REACHED')
          ? 'This offer is no longer available.'
          : CLAIM_INVALID_MESSAGE
      );
    }
    throw new Error(error.message);
  }

  return String(data);
}

export async function forfeitClaimCode(
  supabase: SupabaseClient,
  code: string,
  email?: string | null
): Promise<void> {
  const { error } = await supabase.rpc('forfeit_claim_code', {
    p_code: code.trim(),
    p_email: email?.trim().toLowerCase() ?? '',
  });

  if (error) throw new Error(error.message);
}

export async function attachClaimCodeToWorkspace(
  supabase: SupabaseClient,
  code: string,
  userId: string,
  workspaceId: number
): Promise<string> {
  const { data, error } = await supabase.rpc('attach_claim_code_to_workspace', {
    p_code: code.trim(),
    p_user_id: userId,
    p_workspace_id: workspaceId,
  });

  if (error) {
    throw new ClaimCodeError(CLAIM_INVALID_MESSAGE);
  }

  return String(data);
}

export async function registerClaimFreeWaitlistEmail(
  supabase: SupabaseClient,
  email: string,
  source?: string
): Promise<void> {
  const norm = email.trim().toLowerCase();
  const { error } = await supabase.from('claim_free_waitlist').insert({
    email: norm,
    source: source ?? 'landing',
  });

  if (error) {
    if (error.code === '23505') return;
    throw new Error(error.message);
  }
}

export async function addClaimIneligibleEmail(
  supabase: SupabaseClient,
  email: string,
  reason = 'forfeit'
): Promise<void> {
  const norm = email.trim().toLowerCase();
  if (!norm) return;

  const { error } = await supabase.from('claim_free_ineligible_emails').insert({
    email: norm,
    reason,
  });

  if (error && error.code !== '23505') {
    throw new Error(error.message);
  }
}

export class ClaimCodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ClaimCodeError';
  }
}

export type workspace_signup_type = 'normal' | 'free_claimed';

export function parseClaimCodeFromMetadata(
  meta: Record<string, unknown> | null | undefined
): string | null {
  if (!meta) return null;
  const raw = meta.claim_code;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

export function parseClaimedCodeIdFromMetadata(
  meta: Record<string, unknown> | null | undefined
): string | null {
  if (!meta) return null;
  const raw = meta.claimed_code_id;
  return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
}

export function isFreeClaimSignupMetadata(
  meta: Record<string, unknown> | null | undefined
): boolean {
  if (!meta) return false;
  if (meta.signup_type === 'free_claimed') return true;
  return Boolean(parseClaimedCodeIdFromMetadata(meta) || parseClaimCodeFromMetadata(meta));
}
