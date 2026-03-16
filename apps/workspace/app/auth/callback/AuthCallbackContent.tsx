"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const code = searchParams.get("code");
  const t = searchParams.get("t");
  const nextPath = searchParams.get("next") || "/";

  const [error, setError] = useState<string>("");
  const USER_FRIENDLY_ERROR = "Invalid or expired sign-in link. Please sign in again.";

  useEffect(() => {
    let cancelled = false;

    const setSessionAndRedirect = async (access_token: string, refresh_token: string) => {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token: refresh_token ?? "",
      });
      if (sessionError) {
        if (!cancelled) setError(USER_FRIENDLY_ERROR);
        return false;
      }
      if (!cancelled) router.replace(nextPath);
      return true;
    };

    const finalize = async () => {
      // Prefer one-time token: cookie first, then ?t= (works when cookie not sent, e.g. private browsing)
      let tokenRes = await fetch("/api/auth/callback-tokens", { credentials: "include" });
      if (!tokenRes.ok && t) {
        tokenRes = await fetch(`/api/auth/callback-tokens?t=${encodeURIComponent(t)}`);
      }
      if (tokenRes.ok) {
        try {
          const body = (await tokenRes.json()) as { access_token?: string; refresh_token?: string };
          if (typeof body?.access_token === "string") {
            const ok = await setSessionAndRedirect(body.access_token, body.refresh_token ?? "");
            if (ok) return;
          }
        } catch {
          /* fall through to code or error */
        }
      }

      if (!code) {
        if (!cancelled) setError(USER_FRIENDLY_ERROR);
        return;
      }
      let access_token: string;
      let refresh_token: string;
      try {
        const base64 = decodeURIComponent(code);
        const raw = atob(base64);
        const parsed = JSON.parse(raw) as { access_token?: unknown; refresh_token?: unknown };
        if (
          typeof parsed?.access_token !== "string" ||
          (parsed?.refresh_token != null && typeof parsed.refresh_token !== "string")
        ) {
          if (!cancelled) setError(USER_FRIENDLY_ERROR);
          return;
        }
        access_token = parsed.access_token;
        refresh_token = typeof parsed.refresh_token === "string" ? parsed.refresh_token : "";
      } catch {
        if (!cancelled) setError(USER_FRIENDLY_ERROR);
        return;
      }
      try {
        await setSessionAndRedirect(access_token, refresh_token);
      } catch {
        if (!cancelled) setError(USER_FRIENDLY_ERROR);
      }
    };

    finalize();
  }, [code, t, nextPath, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="w-full max-w-md px-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          {error ? (
            <div className="space-y-3">
              <p className="text-lg font-semibold text-gray-800">Sign-in failed</p>
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-lg">
                {error}
              </p>
              <button
                type="button"
                onClick={() => router.replace("/login")}
                className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
              >
                Go to login
              </button>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
              <p className="text-gray-700 font-medium">Finishing sign-in…</p>
              <p className="text-sm text-gray-500">You'll be redirected automatically.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
