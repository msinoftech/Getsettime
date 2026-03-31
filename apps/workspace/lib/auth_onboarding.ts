import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Total steps in workspace admin onboarding wizard (register flow). */
export const WORKSPACE_ONBOARDING_STEP_COUNT = 4;

/**
 * Parsed `onboarding_last_completed_step`: 0 = none, 1 = step 1 done, …, 4 = all steps done.
 */
export function workspaceOnboardingLastCompletedStep(
  userMetadata: Record<string, unknown> | null | undefined
): number {
  const raw = userMetadata?.onboarding_last_completed_step;
  const n =
    typeof raw === "number"
      ? raw
      : typeof raw === "string"
        ? parseInt(raw, 10)
        : NaN;
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(WORKSPACE_ONBOARDING_STEP_COUNT, Math.floor(n));
}

/**
 * First step the user should land on: last completed step + 1, clamped to 1..WORKSPACE_ONBOARDING_STEP_COUNT.
 * `onboarding_last_completed_step` in user metadata: 0 = none, 1 = step 1 done, …, 4 = all steps done.
 */
export function workspaceOnboardingResumeStep(
  userMetadata: Record<string, unknown> | null | undefined
): number {
  const lastDone = workspaceOnboardingLastCompletedStep(userMetadata);
  return Math.min(WORKSPACE_ONBOARDING_STEP_COUNT, Math.max(1, lastDone + 1));
}

/** Register URL with `step` query for incomplete onboarding (uses metadata). */
export function workspaceOnboardingRegisterUrl(
  userMetadata: Record<string, unknown> | null | undefined
): string {
  const step = workspaceOnboardingResumeStep(userMetadata);
  return `/register?onboarding=1&step=${step}`;
}

/**
 * Workspace admins must finish onboarding while `onboarding_completed` is false.
 * Legacy users: `onboarding_completed` missing → use saved step progress, else workspace type/profession.
 */
export function workspaceAdminNeedsOnboardingWizard(
  userMetadata: Record<string, unknown> | null | undefined,
  workspaceHasProfessionOrType: boolean
): boolean {
  const oc = userMetadata?.onboarding_completed;
  if (oc === true) return false;
  if (oc === false) return true;

  const lastDone = workspaceOnboardingLastCompletedStep(userMetadata);
  if (lastDone > 0 && lastDone < WORKSPACE_ONBOARDING_STEP_COUNT) return true;
  if (lastDone >= WORKSPACE_ONBOARDING_STEP_COUNT) return true;

  return !workspaceHasProfessionOrType;
}

/**
 * True when this user must stay on onboarding until `onboarding_completed` is true (workspace admins only).
 */
export async function workspaceAdminIncompleteOnboarding(
  supabase: SupabaseClient,
  user: User
): Promise<boolean> {
  const role = user.user_metadata?.role as string | undefined;
  if (role !== "workspace_admin") return false;

  const wid = user.user_metadata?.workspace_id as number | undefined;
  let hasWorkspaceProfile = false;
  if (wid != null) {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("type, profession_id")
      .eq("id", wid)
      .maybeSingle();
    hasWorkspaceProfile = !!(ws?.type || ws?.profession_id);
  }

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  return workspaceAdminNeedsOnboardingWizard(meta, hasWorkspaceProfile);
}

/** Paths a workspace admin may open while onboarding is incomplete (pathname only; no query). */
export function isAllowedPathDuringWorkspaceOnboarding(pathname: string): boolean {
  if (pathname.startsWith("/register")) return true;
  if (pathname === "/auth/callback") return true;
  if (pathname.startsWith("/invite-accept")) return true;
  return false;
}

/**
 * After OAuth or password session is established (client-side).
 */
export async function resolvePostAuthNavigationPath(
  supabase: SupabaseClient,
  user: User,
  requestedNext: string
): Promise<string> {
  const role = user.user_metadata?.role as string | undefined;

  if (role === "customer") {
    return "/my-bookings";
  }

  if (role !== "workspace_admin") {
    return requestedNext.startsWith("/") ? requestedNext : "/";
  }

  const needs = await workspaceAdminIncompleteOnboarding(supabase, user);

  if (needs) {
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    return workspaceOnboardingRegisterUrl(meta ?? {});
  }

  if (requestedNext.includes("onboarding=1")) {
    return "/";
  }

  return requestedNext.startsWith("/") ? requestedNext : "/";
}
