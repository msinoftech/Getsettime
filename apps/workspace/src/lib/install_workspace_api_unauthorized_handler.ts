import { supabase } from "@/lib/supabaseClient";
import { logAuthActivityFromSession } from "@/src/lib/auth_activity_log_client";

const INSTALL_FLAG = "__getsettimeWorkspaceApi401Handler";

let redirectInProgress = false;

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}

function requestHadBearer(input: RequestInfo | URL, init?: RequestInit): boolean {
  if (init?.headers) {
    const h = new Headers(init.headers);
    const a = h.get("authorization") ?? h.get("Authorization");
    if (a?.toLowerCase().startsWith("bearer ")) return true;
  }
  if (input instanceof Request) {
    const a = input.headers.get("authorization") ?? input.headers.get("Authorization");
    if (a?.toLowerCase().startsWith("bearer ")) return true;
  }
  return false;
}

function isSameOriginWorkspaceApi(urlString: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const u = new URL(urlString, window.location.origin);
    if (u.origin !== window.location.origin) return false;
    return u.pathname.startsWith("/api/");
  } catch {
    return false;
  }
}

/** These may return 401 during normal login/signup; do not treat as “kill session”. */
function isBenignAuth401Path(urlString: string): boolean {
  try {
    const p = new URL(urlString, typeof window !== "undefined" ? window.location.origin : "http://local").pathname;
    if (p.startsWith("/api/auth/register")) return true;
    if (p.startsWith("/api/auth/verify")) return true;
    if (p.startsWith("/api/auth/email-registered")) return true;
    if (p === "/api/auth/google" || p.startsWith("/api/auth/google?")) return true;
    if (p === "/api/auth/callback-tokens" || p.startsWith("/api/auth/callback-tokens?")) return true;
    return false;
  } catch {
    return false;
  }
}

function isAuthPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password") ||
    pathname.startsWith("/auth/callback")
  );
}

/**
 * When another tab/browser invalidates the refresh token (e.g. new login via password rotation),
 * API calls return 401 while the UI still looks “signed in”. Sign out locally and send the user to login.
 */
export function installWorkspaceApiUnauthorizedHandler(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as Window & Record<string, boolean | undefined>;
  if (w[INSTALL_FLAG]) return;
  w[INSTALL_FLAG] = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const response = await originalFetch(input, init);
    if (response.status !== 401) return response;
    if (redirectInProgress) return response;

    const urlString = resolveRequestUrl(input);
    if (!isSameOriginWorkspaceApi(urlString) || isBenignAuth401Path(urlString)) {
      return response;
    }
    if (!requestHadBearer(input, init)) return response;

    const path = window.location.pathname;
    if (isAuthPublicPath(path)) return response;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return response;

    redirectInProgress = true;
    try {
      await logAuthActivityFromSession("logout", { reason: "api_unauthorized" });
    } catch {
      /* still sign out */
    }
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* still redirect */
    }
    const next = `/login?reason=session_ended&next=${encodeURIComponent(path + window.location.search)}`;
    window.location.assign(next);
    return response;
  };
}
