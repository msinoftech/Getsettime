import { supabase } from "@/lib/supabaseClient";
import type { user_auth_activity_log_request } from "@/src/types/user_auth_activity";

/** Suppress duplicate "login" rows when the same session triggers SIGNED_IN more than once (e.g. React Strict Mode remount or listener re-subscribe). */
const LOGIN_AUDIT_DEDUPE_MS = 25_000;

type login_audit_dedupe = { key: string; at: number };

let last_login_audit: login_audit_dedupe | null = null;

/** Synchronous guard: parallel SIGNED_IN handlers run before any await can set last_login_audit. */
const login_audit_inflight = new Set<string>();

function login_audit_key(access_token: string, user_id: string): string {
  return `${user_id}:${access_token.slice(0, 72)}`;
}

export function reset_login_activity_audit_dedupe(): void {
  last_login_audit = null;
  login_audit_inflight.clear();
}

export async function logAuthActivity(
  access_token: string,
  body: user_auth_activity_log_request
): Promise<void> {
  try {
    await fetch("/api/auth/activity-log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${access_token}`,
      },
      body: JSON.stringify(body),
    });
  } catch {
    /* never block auth flows */
  }
}

/** Records one login audit per access token within LOGIN_AUDIT_DEDUPE_MS. */
export async function logAuthActivityLoginDeduped(
  access_token: string,
  user_id: string,
  supabase_auth_event: string
): Promise<void> {
  const key = login_audit_key(access_token, user_id);
  const now = Date.now();
  if (
    last_login_audit &&
    last_login_audit.key === key &&
    now - last_login_audit.at < LOGIN_AUDIT_DEDUPE_MS
  ) {
    return;
  }
  if (login_audit_inflight.has(key)) {
    return;
  }
  login_audit_inflight.add(key);
  last_login_audit = { key, at: now };
  try {
    await logAuthActivity(access_token, {
      event_type: "login",
      supabase_auth_event,
    });
  } finally {
    login_audit_inflight.delete(key);
  }
}

export async function logAuthActivityFromSession(
  event_type: user_auth_activity_log_request["event_type"],
  opts?: Pick<user_auth_activity_log_request, "reason" | "supabase_auth_event">
): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) return;
  await logAuthActivity(token, {
    event_type,
    reason: opts?.reason ?? null,
    supabase_auth_event: opts?.supabase_auth_event ?? null,
  });
  if (event_type === "logout") {
    reset_login_activity_audit_dedupe();
  }
}

export async function signOutWithAuthLog(
  reason: string,
  sign_out_options?: Parameters<(typeof supabase.auth)["signOut"]>[0]
): Promise<void> {
  await logAuthActivityFromSession("logout", { reason });
  await supabase.auth.signOut(sign_out_options);
}
