"use client";
import {
  workspaceAdminNeedsOnboardingWizard,
  workspaceOnboardingRegisterUrl,
} from "@/lib/auth_onboarding";
import { supabase } from "@/lib/supabaseClient";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function noAccountCopy(addr: string) {
  return `You don't have account exists for ${addr}`;
}

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showNoAccountModal, setShowNoAccountModal] = useState(false);
  const [modalEmail, setModalEmail] = useState("");
  const [modalGoogleLoading, setModalGoogleLoading] = useState(false);
  const [emailVerifiedNotice, setEmailVerifiedNotice] = useState(false);
  const [sessionEndedNotice, setSessionEndedNotice] = useState(false);

  // Email confirmation link lands here: clear implicit session so user must sign in with password
  useEffect(() => {
    if (searchParams.get("email_verified") !== "1") return;
    let cancelled = false;
    (async () => {
      const em = searchParams.get("email");
      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled && session) {
        await supabase.auth.signOut();
      }
      if (!cancelled) {
        if (em && EMAIL_RE.test(em)) setEmail(em);
        setEmailVerifiedNotice(true);
        router.replace("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  // OAuth / no-account query params
  useEffect(() => {
    if (searchParams.get("email_verified") === "1") return;

    if (searchParams.get("reason") === "session_ended") {
      setSessionEndedNotice(true);
      setError("");
      router.replace("/login");
      return;
    }

    const noAccount = searchParams.get("no_account") === "1";
    const errorParam = searchParams.get("error");
    const emailParam = searchParams.get("email");

    if (noAccount && emailParam && EMAIL_RE.test(emailParam)) {
      setModalEmail(emailParam);
      setShowNoAccountModal(true);
      setError("");
      router.replace("/login");
      return;
    }

    if (errorParam === "user_not_found") {
      if (emailParam && EMAIL_RE.test(emailParam)) {
        setModalEmail(emailParam);
        setShowNoAccountModal(true);
        setError("");
      } else {
        setError("No account found");
      }
      router.replace("/login");
      return;
    }

    const messageParam = searchParams.get("message");
    const hintParam = searchParams.get("hint");
    if (errorParam) {
      const msg =
        errorParam === "server_config" && hintParam
          ? `Server configuration error. Add or fix in .env.local: ${decodeURIComponent(hintParam)}. Restart the dev server after changing .env.local.`
          : decodeURIComponent(errorParam);
      setError(msg);
    } else if (messageParam) {
      setError("");
    }
  }, [searchParams, router]);

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);

    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enableCalendarSync: false,
          isSignup: false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to initiate Google login");
        setGoogleLoading(false);
        return;
      }

      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError("No auth URL received");
        setGoogleLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setGoogleLoading(false);
    }
  };

  const startGoogleSignupFromModal = useCallback(async (hint: string) => {
    setError("");
    setModalGoogleLoading(true);
    try {
      const response = await fetch("/api/auth/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enableCalendarSync: true,
          isSignup: true,
          ...(EMAIL_RE.test(hint) ? { loginHint: hint } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Failed to initiate Google signup");
        setModalGoogleLoading(false);
        return;
      }
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError("No auth URL received");
        setModalGoogleLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setModalGoogleLoading(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const loginEmail = email.trim().toLowerCase();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password,
      });

      if (signInError) {
        const em = signInError.message || "";
        const lower = em.toLowerCase();
        if (lower.includes("email not confirmed") || lower.includes("not confirmed")) {
          setError(em);
          setLoading(false);
          return;
        }
        if (lower.includes("invalid login credentials")) {
          try {
            const check = await fetch("/api/auth/email-registered", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ email: loginEmail }),
            });
            const checkJson = (await check.json().catch(() => ({}))) as { registered?: boolean };
            if (check.ok && checkJson.registered === false) {
              setModalEmail(loginEmail);
              setShowNoAccountModal(true);
              setError("");
              setLoading(false);
              return;
            }
          } catch {
            /* fall through to generic error */
          }
        }
        setError(em);
        setLoading(false);
        return;
      }

      const session = data.session;
      const user = data.user;
      let accessToken = session?.access_token;
      let userForNav = user;

      if (!accessToken || !user) {
        setError("No access token or user data received");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken }),
      });
      const json = await res.json();

      if (json.error) {
        setError(json.error);
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      if (json.deactivated === true) {
        await supabase.auth.signOut();
        setError("Your account is deactivated. Please contact admin or manager.");
        setLoading(false);
        return;
      }

      const userRole = user.user_metadata?.role;
      const allowedRoles = ["workspace_admin", "customer", "manager", "service_provider"];
      const isDeactivated = user.user_metadata?.deactivated === true;

      if (isDeactivated) {
        await supabase.auth.signOut();
        setError("Your account is deactivated. Please contact admin or manager.");
        setLoading(false);
        return;
      }

      if (!userRole || !allowedRoles.includes(userRole)) {
        await supabase.auth.signOut();
        if (userRole === "superadmin") {
          setError("Access denied. Superadmin users cannot access the workspace app.");
        } else {
          setError("Access denied. Invalid role for workspace access.");
        }
        setLoading(false);
        return;
      }

      if (!json.role || !allowedRoles.includes(json.role)) {
        await supabase.auth.signOut();
        if (json.role === "superadmin") {
          setError("Access denied. Superadmin users cannot access the workspace app.");
        } else {
          setError("Access denied. Invalid role for workspace access.");
        }
        setLoading(false);
        return;
      }

      if (!userForNav.user_metadata?.workspace_id) {
        const bootRes = await fetch("/api/auth/bootstrap-workspace", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (bootRes.ok) {
          await supabase.auth.refreshSession();
          const {
            data: { session: s2 },
          } = await supabase.auth.getSession();
          if (s2?.access_token && s2.user) {
            accessToken = s2.access_token;
            userForNav = s2.user;
          }
        }
      }

      const sessionRes = await fetch("/api/auth/session-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken }),
      });
      const sessionJson = await sessionRes.json();
      if (sessionJson.error) {
        console.error("Failed to set session cookies:", sessionJson.error);
      }

      const finalRole = userForNav.user_metadata?.role;
      if (finalRole === "customer") {
        router.push("/my-bookings");
        return;
      }

      if (finalRole === "workspace_admin") {
        const wid = userForNav.user_metadata?.workspace_id as number | undefined;
        let hasWorkspaceProfile = false;
        if (wid != null) {
          const { data: ws } = await supabase
            .from("workspaces")
            .select("type, profession_id")
            .eq("id", wid)
            .maybeSingle();
          hasWorkspaceProfile = !!(ws?.type || ws?.profession_id);
        }
        const meta = userForNav.user_metadata as Record<string, unknown>;
        if (workspaceAdminNeedsOnboardingWizard(meta, hasWorkspaceProfile)) {
          router.push(workspaceOnboardingRegisterUrl(meta));
          return;
        }
      }

      router.push("/");
    } catch (err) {
      setError("An unexpected error occurred");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 relative flex items-center justify-center">
      <div className="absolute inset-0">
        <div className="absolute bottom-0 right-0 w-100 h-100 bg-emerald-300/20 rounded-full blur-3xl animate-pulse [animation-delay:2s]"></div>
        <div className="absolute top-0 left-0 w-100 h-100 bg-indigo-400/30 rounded-full blur-3xl animate-pulse [animation-delay:4s]"></div>
      </div>

      <div className="w-full max-w-md px-6 relative z-10">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <Image
              src="/getsettime-logo.svg"
              alt="GetSetTime Logo"
              width={200}
              height={50}
              className="mx-auto mb-4"
            />
          </Link>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to your GetSetTime account</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-xl p-8 space-y-5 border border-gray-100">
          {emailVerifiedNotice && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg text-sm">
              Email verified — sign in with your password below.
            </div>
          )}

          {sessionEndedNotice && (
            <div className="bg-amber-50 border border-amber-200 text-amber-900 px-4 py-3 rounded-lg text-sm">
              Your session is no longer valid (for example, you signed in on another browser). Sign in again to continue.
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <p className="text-sm">{error}</p>
            </div>
          )}

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
            className="w-full bg-white text-gray-700 py-3 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center justify-center gap-3">
              {googleLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Connecting...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.73 1.22 9.24 3.62l6.9-6.9C35.9 2.4 30.3 0 24 0 14.6 0 6.52 5.38 2.56 13.22l8.03 6.24C12.6 13.5 17.8 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.1 24.5c0-1.64-.15-3.22-.43-4.75H24v9h12.4c-.54 2.9-2.2 5.36-4.72 7.03l7.2 5.58C43.2 37.2 46.1 31.4 46.1 24.5z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.6 28.54c-.5-1.5-.78-3.1-.78-4.74s.28-3.24.78-4.74l-8.03-6.24C.93 16.6 0 20.2 0 23.8s.93 7.2 2.56 10.02l8.03-6.28z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.3 0 11.6-2.08 15.46-5.64l-7.2-5.58c-2 1.35-4.56 2.15-8.26 2.15-6.2 0-11.4-4-13.3-9.6l-8.03 6.28C6.52 42.62 14.6 48 24 48z"
                    />
                  </svg>
                  Continue with Google
                </>
              )}
            </span>
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">or</span>
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                  />
                </svg>
              </div>
              <input
                id="email"
                type="email"
                placeholder="john@example.com"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <Link href="/forgot-password" className="text-xs text-blue-600 hover:text-blue-800">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center">
            <input
              id="remember-me"
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">
              Remember me
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Signing in...
              </span>
            ) : (
              "Sign In"
            )}
          </button>

          <div className="text-center pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="text-blue-600 hover:text-blue-800 font-medium">
                Create one
              </Link>
            </p>
          </div>
        </form>
      </div>

      {showNoAccountModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="no-account-modal-title"
        >
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 relative border border-gray-100">
            <button
              type="button"
              onClick={() => setShowNoAccountModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 p-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-start gap-3 text-amber-700 mb-4 pr-8">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 font-bold text-sm">
                !
              </span>
              <p className="text-sm font-medium pt-1">{noAccountCopy(modalEmail)}</p>
            </div>

            <h2 id="no-account-modal-title" className="text-xl font-bold text-slate-800 mb-2">
              Sign up with your Google account
            </h2>
            <p className="text-sm text-slate-600 text-center mb-6">
              Your email is eligible to sign up with Google for an easier setup, so you can connect your calendar instantly.
            </p>

            <button
              type="button"
              onClick={() => startGoogleSignupFromModal(modalEmail)}
              disabled={modalGoogleLoading}
              className="w-full flex items-center justify-center gap-3 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {modalGoogleLoading ? (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              ) : (
                <>
                  <span className="flex h-8 w-8 items-center justify-center bg-white rounded">
                    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.73 1.22 9.24 3.62l6.9-6.9C35.9 2.4 30.3 0 24 0 14.6 0 6.52 5.38 2.56 13.22l8.03 6.24C12.6 13.5 17.8 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.1 24.5c0-1.64-.15-3.22-.43-4.75H24v9h12.4c-.54 2.9-2.2 5.36-4.72 7.03l7.2 5.58C43.2 37.2 46.1 31.4 46.1 24.5z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.6 28.54c-.5-1.5-.78-3.1-.78-4.74s.28-3.24.78-4.74l-8.03-6.24C.93 16.6 0 20.2 0 23.8s.93 7.2 2.56 10.02l8.03-6.28z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.3 0 11.6-2.08 15.46-5.64l-7.2-5.58c-2 1.35-4.56 2.15-8.26 2.15-6.2 0-11.4-4-13.3-9.6l-8.03 6.28C6.52 42.62 14.6 48 24 48z"
                      />
                    </svg>
                  </span>
                  Sign up with Google
                </>
              )}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-white text-gray-500 uppercase tracking-wide">or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowNoAccountModal(false);
                router.push(`/register?email=${encodeURIComponent(modalEmail)}`);
              }}
              className="w-full text-blue-800 font-medium text-sm flex items-center justify-center gap-2 hover:text-blue-950 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg py-2"
            >
              Create account with a password
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
