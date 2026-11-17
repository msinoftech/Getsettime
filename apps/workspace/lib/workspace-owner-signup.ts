import type { SupabaseClient } from '@supabase/supabase-js';
import { isFreeClaimSignupMetadata } from '@app/db/subscription';
import { ROLE_SERVICE_PROVIDER } from '@/src/constants/roles';
import {
  getOrCreateWorkspace,
  updateUserWorkspaceMetadata,
  type RegistrationGeoInput,
} from '@/lib/workspace-service';
import { sendWorkspaceWelcomeEmail } from '@/lib/send-workspace-welcome-email';

export type SignupMethod = 'password' | 'google';

/**
 * Initial auth user_metadata before workspace finalize (no workspace_id / owner flags).
 * Password signup sets provisional `role` so login works before bootstrap; finalize
 * is authoritative for `is_workspace_owner` and `additional_roles`.
 */
export function buildSignupUserMetadata(
  name: string,
  signupMethod: SignupMethod,
  extras?: Record<string, unknown>
): Record<string, unknown> {
  return {
    name,
    signup_method: signupMethod,
    onboarding_completed: false,
    onboarding_last_completed_step: 0,
    ...(signupMethod === 'password' ? { role: 'workspace_admin' as const } : {}),
    ...extras,
  };
}

export function workspaceCreatorFlagsMissing(
  meta: Record<string, unknown> | null | undefined
): boolean {
  if (!meta) return true;
  if (meta.is_workspace_owner !== true) return true;
  const additional = meta.additional_roles;
  return (
    !Array.isArray(additional) || !additional.includes(ROLE_SERVICE_PROVIDER)
  );
}

export async function userIsWorkspaceCreator(
  supabaseAdmin: SupabaseClient,
  userId: string,
  workspaceId: number
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('workspaces')
    .select('user_id')
    .eq('id', workspaceId)
    .maybeSingle();
  if (error) {
    console.error('userIsWorkspaceCreator:', error);
    return false;
  }
  return typeof data?.user_id === 'string' && data.user_id === userId;
}

export type FinalizeWorkspaceOwnerSignupParams = {
  userId: string;
  userName: string;
  userEmail: string;
  supabaseAdmin: SupabaseClient;
  registrationGeo?: RegistrationGeoInput;
  userMetadata?: Record<string, unknown>;
  metadataPatch?: Record<string, unknown>;
  sendWelcomeEmail?: boolean;
};

export type FinalizeWorkspaceOwnerSignupResult =
  | {
      ok: true;
      workspaceId: number;
      isNewWorkspace: boolean;
      isFreeClaim: boolean;
      metadata: Record<string, unknown>;
      repairedCreatorFlags: boolean;
    }
  | { ok: false; error: string };

/**
 * Shared self-serve owner path: create or resolve workspace, then set workspace_id
 * and creator flags (owner + service provider) consistently for password and Google signup.
 */
export async function finalizeWorkspaceOwnerSignup(
  params: FinalizeWorkspaceOwnerSignupParams
): Promise<FinalizeWorkspaceOwnerSignupResult> {
  const baseMeta = (params.userMetadata ?? {}) as Record<string, unknown>;

  const { data: workspaceResult, error: workspaceError } = await getOrCreateWorkspace({
    userId: params.userId,
    userName: params.userName,
    userEmail: params.userEmail,
    supabaseAdmin: params.supabaseAdmin,
    registrationGeo: params.registrationGeo,
    userMetadata: baseMeta,
  });

  if (workspaceError || !workspaceResult) {
    return {
      ok: false,
      error: workspaceError || 'Failed to get or create workspace',
    };
  }

  const isCreator = await userIsWorkspaceCreator(
    params.supabaseAdmin,
    params.userId,
    workspaceResult.workspaceId
  );
  const repairedCreatorFlags =
    !workspaceResult.isNewWorkspace &&
    isCreator &&
    workspaceCreatorFlagsMissing(baseMeta);

  const { error: updateError, metadata } = await updateUserWorkspaceMetadata(
    params.userId,
    workspaceResult.workspaceId,
    params.metadataPatch ?? {},
    params.supabaseAdmin,
    workspaceResult.isNewWorkspace,
    baseMeta,
    repairedCreatorFlags ? { applyCreatorFlags: true } : undefined
  );

  if (updateError) {
    return { ok: false, error: updateError };
  }

  const mergedMeta = (metadata ?? baseMeta) as Record<string, unknown>;
  const isFreeClaim = isFreeClaimSignupMetadata(mergedMeta);

  if (
    params.sendWelcomeEmail !== false &&
    workspaceResult.isNewWorkspace &&
    params.userEmail
  ) {
    sendWorkspaceWelcomeEmail({
      to: params.userEmail,
      workspaceId: workspaceResult.workspaceId,
      adminName: params.userName,
      supabaseAdmin: params.supabaseAdmin,
    }).catch((err) => console.error('Welcome email failed (non-critical):', err));
  }

  return {
    ok: true,
    workspaceId: workspaceResult.workspaceId,
    isNewWorkspace: workspaceResult.isNewWorkspace,
    isFreeClaim,
    metadata: mergedMeta,
    repairedCreatorFlags,
  };
}

/** Repair owner metadata when workspace_id is already set (e.g. partial manual bootstrap). */
export async function ensureWorkspaceCreatorFlagsIfNeeded(
  supabaseAdmin: SupabaseClient,
  userId: string,
  workspaceId: number,
  meta: Record<string, unknown>
): Promise<{ error: string | null; metadata?: Record<string, unknown> }> {
  const isCreator = await userIsWorkspaceCreator(supabaseAdmin, userId, workspaceId);
  if (!isCreator || !workspaceCreatorFlagsMissing(meta)) {
    return { error: null, metadata: meta };
  }
  return updateUserWorkspaceMetadata(
    userId,
    workspaceId,
    {},
    supabaseAdmin,
    false,
    meta,
    { applyCreatorFlags: true }
  );
}

export async function rollbackNewOwnerWorkspace(
  supabaseAdmin: SupabaseClient,
  workspaceId: number,
  options?: { deleteUserId?: string }
): Promise<void> {
  await supabaseAdmin.from('configurations').delete().eq('workspace_id', workspaceId);
  await supabaseAdmin.from('workspaces').delete().eq('id', workspaceId);
  if (options?.deleteUserId) {
    await supabaseAdmin.auth.admin.deleteUser(options.deleteUserId);
  }
}
