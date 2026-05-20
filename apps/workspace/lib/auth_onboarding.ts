import type { SupabaseClient, User } from "@supabase/supabase-js";

/** Total steps in workspace admin onboarding wizard (register flow). */
export const WORKSPACE_ONBOARDING_STEP_COUNT = 4;

/** Client-side workspace row fetch during auth callback must not hang indefinitely. */
const WORKSPACE_ONBOARDING_REMOTE_TIMEOUT_MS = 30_000;

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

export const INVITE_WORKSPACE_STORAGE_KEY = "gst_invite_workspace_id";
export const ONBOARDING_KIND_STORAGE_KEY = "gst_onboarding_kind";

export function persistInviteOnboardingContext(workspaceId: number): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(INVITE_WORKSPACE_STORAGE_KEY, String(workspaceId));
  sessionStorage.setItem(ONBOARDING_KIND_STORAGE_KEY, "invite");
}

export function readInviteOnboardingContext(): { workspaceId: number } | null {
  if (typeof window === "undefined") return null;
  if (sessionStorage.getItem(ONBOARDING_KIND_STORAGE_KEY) !== "invite") return null;
  const n = parseInt(sessionStorage.getItem(INVITE_WORKSPACE_STORAGE_KEY) ?? "", 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return { workspaceId: n };
}

export function clearInviteOnboardingContext(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(INVITE_WORKSPACE_STORAGE_KEY);
  sessionStorage.removeItem(ONBOARDING_KIND_STORAGE_KEY);
}

/** Register URL with `step` query for incomplete onboarding (uses metadata). */
export function workspaceOnboardingRegisterUrl(
  userMetadata: Record<string, unknown> | null | undefined,
  options?: { inviteWorkspaceId?: number }
): string {
  const step = workspaceOnboardingResumeStep(userMetadata);
  const params = new URLSearchParams({ onboarding: "1", step: String(step) });
  if (
    options?.inviteWorkspaceId != null &&
    Number.isFinite(options.inviteWorkspaceId) &&
    options.inviteWorkspaceId > 0
  ) {
    params.set("invite_workspace_id", String(options.inviteWorkspaceId));
  }
  return `/register?${params.toString()}`;
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
    const { data: ws, error } = await supabase
      .from("workspaces")
      .select("type, profession_id")
      .eq("id", wid)
      .maybeSingle();
    if (error) {
      const code = (error as { code?: string }).code;
      const msg = (error.message ?? "").toLowerCase();
      const looksLikeAuth =
        code === "PGRST301" ||
        code === "42501" ||
        msg.includes("jwt") ||
        msg.includes("permission denied") ||
        msg.includes("not authorized");
      if (looksLikeAuth) {
        throw new Error("WORKSPACE_AUTH_LOOKUP_FAILED");
      }
      console.error("[workspaceAdminIncompleteOnboarding]", error);
      hasWorkspaceProfile = false;
    } else {
      hasWorkspaceProfile = !!(ws?.type || ws?.profession_id);
    }
  }

  const meta = user.user_metadata as Record<string, unknown> | undefined;
  return workspaceAdminNeedsOnboardingWizard(meta, hasWorkspaceProfile);
}

/**
 * Invited service providers must finish onboarding while `onboarding_completed` is false.
 * Legacy users without the flag are treated as complete (departments-only check lives in team UI).
 */
export function serviceProviderNeedsOnboardingWizard(
  userMetadata: Record<string, unknown> | null | undefined
): boolean {
  const oc = userMetadata?.onboarding_completed;
  if (oc === true) return false;
  if (oc === false) return true;

  const lastDone = workspaceOnboardingLastCompletedStep(userMetadata);
  if (lastDone > 0 && lastDone < WORKSPACE_ONBOARDING_STEP_COUNT) return true;
  if (lastDone >= WORKSPACE_ONBOARDING_STEP_COUNT) return true;

  return false;
}

/** True when this service_provider must stay on onboarding until `onboarding_completed` is true. */
export function serviceProviderIncompleteOnboarding(user: User): boolean {
  const role = user.user_metadata?.role as string | undefined;
  if (role !== "service_provider") return false;
  const meta = user.user_metadata as Record<string, unknown> | undefined;
  return serviceProviderNeedsOnboardingWizard(meta);
}

/** Paths users may open while onboarding is incomplete (pathname only; no query). */
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

  if (role === "service_provider") {
    if (serviceProviderIncompleteOnboarding(user)) {
      const meta = user.user_metadata as Record<string, unknown> | undefined;
      return workspaceOnboardingRegisterUrl(meta ?? {});
    }
    if (requestedNext.includes("onboarding=1")) {
      return "/";
    }
    return requestedNext.startsWith("/") ? requestedNext : "/";
  }

  if (role !== "workspace_admin") {
    return requestedNext.startsWith("/") ? requestedNext : "/";
  }

  let needs: boolean;
  try {
    needs = await Promise.race([
      workspaceAdminIncompleteOnboarding(supabase, user),
      new Promise<boolean>((_, reject) => {
        setTimeout(
          () => reject(new Error("WORKSPACE_ONBOARDING_REMOTE_TIMEOUT")),
          WORKSPACE_ONBOARDING_REMOTE_TIMEOUT_MS
        );
      }),
    ]);
  } catch {
    throw new Error("WORKSPACE_ADMIN_ONBOARDING_CHECK_FAILED");
  }

  if (needs) {
    const meta = user.user_metadata as Record<string, unknown> | undefined;
    return workspaceOnboardingRegisterUrl(meta ?? {});
  }

  if (requestedNext.includes("onboarding=1")) {
    return "/";
  }

  return requestedNext.startsWith("/") ? requestedNext : "/";
}
