"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  workspaceAdminNeedsOnboardingWizard,
  workspaceOnboardingLastCompletedStep,
  workspaceOnboardingResumeStep,
} from "@/lib/auth_onboarding";
import { supabase } from "@/lib/supabaseClient";
import AvailabilityTimesheet from "@/src/components/Settings/AvailabilityTimesheet";
import AlertMessage from "@/src/components/Auth/AlertMessage";

/** Row from professions_list (onboarding catalog), not workspace professions.id */
type Profession = { id: number; name: string };

const ONBOARDING_STEPS = 4;
const OTHER_VALUE = "__other__";

function read_google_calendar_sync(meta: Record<string, unknown>): boolean {
  const v = meta.google_calendar_sync;
  if (v === true) return true;
  if (v === false) return false;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return false;
}

/**
 * Serialize refreshSession across this module. Concurrent refreshSession() calls can consume the
 * refresh token twice and clear the session (user then sees "Not signed in" on the next API call).
 */
let authRefreshChain: Promise<void> = Promise.resolve();

async function enqueueAuthRefresh(): Promise<void> {
  const next = authRefreshChain.then(() => supabase.auth.refreshSession());
  authRefreshChain = next.then(() => undefined).catch(() => undefined);
  await next;
}

/**
 * updateUser() needs a client session. Do not call refreshSession() when a session already exists —
 * right after OAuth, extra refreshes can fail or rotate tokens in a way that clears the session.
 */
async function ensureSupabaseSessionOrThrow(): Promise<void> {
  let { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return;
  await enqueueAuthRefresh();
  ({ data: { session } } = await supabase.auth.getSession());
  if (!session?.user) {
    throw new Error("Not signed in or session expired. Please sign in again.");
  }
}

/** Bearer + JSON headers for workspace API routes; refresh only if access_token is missing. */
async function headers_for_workspace_api(): Promise<Record<string, string>> {
  let { data: { session } } = await supabase.auth.getSession();
  let token = session?.access_token;
  if (!token) {
    await enqueueAuthRefresh();
    ({ data: { session } } = await supabase.auth.getSession());
    token = session?.access_token;
  }
  if (!token) {
    throw new Error("Not signed in or session expired. Please sign in again.");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

export default function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Onboarding (new users after Google signup)
  const [onboardingMode, setOnboardingMode] = useState<boolean | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);
  const [workspaceType, setWorkspaceType] = useState<string | null>(null);
  // Step 1 — Profession
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [selectedProfessionId, setSelectedProfessionId] = useState<string>("");
  const [customProfession, setCustomProfession] = useState("");
  // Step 1 — Department
  const [departmentSuggestions, setDepartmentSuggestions] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>("");
  const [customDepartment, setCustomDepartment] = useState("");
  // Step 4
  const [meetingOptions, setMeetingOptions] = useState({
    google_meet: true,
    in_person: true,
    phone_call: false,
    whatsapp: false,
  });
  const [step3Saved, setStep3Saved] = useState(false);
  const [onboardingUser, setOnboardingUser] = useState<{ email?: string; google_calendar_sync?: boolean } | null>(null);
  const [calendarConnecting, setCalendarConnecting] = useState(false);

  const registeringRef = useRef(false);
  const bootstrapPromiseRef = useRef<Promise<number | null> | null>(null);
  const autoGoogleTriggeredRef = useRef(false);
  const emailFromUrlAppliedRef = useRef(false);
  /** Apply metadata resume step only once per user after login / first load; do not override Back/Next. */
  const resumeStepHydratedUserIdRef = useRef<string | null>(null);

  const EMAIL_PARAM_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const goToOnboardingStep = useCallback(
    (step: number) => {
      const s = Math.min(Math.max(step, 1), ONBOARDING_STEPS);
      setOnboardingStep(s);
      const params = new URLSearchParams(searchParams.toString());
      params.set("onboarding", "1");
      params.set("step", String(s));
      router.replace(`/register?${params.toString()}`);
    },
    [router, searchParams]
  );

  const resolveMode = async (session: {
    user: {
      id: string;
      user_metadata?: Record<string, unknown>;
      email?: string;
      email_confirmed_at?: string;
    };
    access_token: string;
  } | null) => {
    if (!session?.user) {
      resumeStepHydratedUserIdRef.current = null;
      setOnboardingMode(false);
      return;
    }
    let meta = session.user.user_metadata ?? {};
    let wid = meta.workspace_id as number | undefined;
    const isConfirmedParam = searchParams.get("confirmed") === "1";

    if (!wid && (isConfirmedParam || session.user.email_confirmed_at)) {
      let promise = bootstrapPromiseRef.current;
      if (!promise) {
        promise = (async () => {
          const res = await fetch("/api/auth/bootstrap-workspace", {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` },
          });
          if (!res.ok) return null;
          const body = (await res.json()) as { workspace_id: number };
          return body.workspace_id;
        })();
        bootstrapPromiseRef.current = promise;
      }
      const resolvedWid = await promise;
      if (resolvedWid != null) {
        wid = resolvedWid;
        await enqueueAuthRefresh();
      }
      bootstrapPromiseRef.current = null;
    }

    if (!wid) {
      setOnboardingMode(false);
      return;
    }

    const userRole = meta.role as string | undefined;
    if (userRole && userRole !== "workspace_admin") {
      router.replace(userRole === "customer" ? "/my-bookings" : "/");
      return;
    }

    setWorkspaceId(wid);

    const authHeaders = { Authorization: `Bearer ${session.access_token}` };

    const wsRes = await fetch("/api/workspace", { headers: authHeaders });
    if (!wsRes.ok) {
      resumeStepHydratedUserIdRef.current = null;
      setOnboardingMode(false);
      return;
    }
    const wsBody = (await wsRes.json()) as {
      workspace?: {
        type?: string | null;
        profession_id?: number | null;
        profession_name?: string | null;
      };
    };
    const ws = wsBody.workspace ?? null;

    // Fresh metadata before wizard check (JWT can lag behind auth.users after updateUser).
    const { data: userResult, error: getUserErr } = await supabase.auth.getUser();
    if (!getUserErr && userResult.user?.user_metadata) {
      meta = userResult.user.user_metadata as Record<string, unknown>;
    }

    const hasType = !!ws?.type || !!ws?.profession_id;
    const wizardIncomplete = workspaceAdminNeedsOnboardingWizard(meta, hasType);
    if (!wizardIncomplete) {
      resumeStepHydratedUserIdRef.current = null;
      router.replace("/");
      return;
    }

    const { data: { session: latestSession } } = await supabase.auth.getSession();
    const tokenAfterRefresh = latestSession?.access_token ?? session.access_token;
    const authHeadersFresh: Record<string, string> = {
      Authorization: `Bearer ${tokenAfterRefresh}`,
    };

    setWorkspaceType(ws?.type ?? null);

    // Catalog from professions_list; prefill from workspace.type (step 1) and/or server-resolved profession_name
    const profRes = await fetch("/api/professions", { headers: authHeadersFresh });
    let catalogList: Profession[] = [];
    if (profRes.ok) {
      const profBody = await profRes.json();
      catalogList = (profBody.professions ?? []) as Profession[];
    }
    setProfessions(catalogList);

    let resolvedCatalogProfessionId = "";
    const labelForProfession =
      (typeof ws?.type === "string" && ws.type.trim()) ||
      (typeof ws?.profession_name === "string" && ws.profession_name.trim()) ||
      "";

    if (labelForProfession) {
      if (catalogList.length > 0) {
        const match = catalogList.find(
          (x) => x.name.toLowerCase() === labelForProfession.toLowerCase()
        );
        if (match) {
          resolvedCatalogProfessionId = String(match.id);
          setSelectedProfessionId(String(match.id));
        } else {
          resolvedCatalogProfessionId = OTHER_VALUE;
          setSelectedProfessionId(OTHER_VALUE);
          setCustomProfession(labelForProfession);
        }
      } else {
        resolvedCatalogProfessionId = OTHER_VALUE;
        setSelectedProfessionId(OTHER_VALUE);
        setCustomProfession(labelForProfession);
      }
    }

    // Prefill department from workspace when step 1 was saved earlier
    const wsDeptRes = await fetch("/api/departments", { headers: authHeadersFresh });
    if (wsDeptRes.ok) {
      const deptJson = (await wsDeptRes.json()) as { departments?: { name: string }[] };
      const savedName = deptJson.departments?.[0]?.name?.trim();
      if (savedName) {
        let suggestionNames: string[] = [];
        if (
          resolvedCatalogProfessionId &&
          resolvedCatalogProfessionId !== OTHER_VALUE &&
          /^\d+$/.test(resolvedCatalogProfessionId)
        ) {
          const sRes = await fetch(
            `/api/catalog/departments?profession_id=${encodeURIComponent(resolvedCatalogProfessionId)}`,
            { headers: authHeadersFresh }
          );
          if (sRes.ok) {
            const sj = (await sRes.json()) as { departments?: string[] };
            suggestionNames = Array.isArray(sj.departments) ? sj.departments : [];
          }
        }
        const exactInSuggestions = suggestionNames.find(
          (n) => n.toLowerCase() === savedName.toLowerCase()
        );
        if (exactInSuggestions) {
          setSelectedDepartment(exactInSuggestions);
        } else {
          setSelectedDepartment(OTHER_VALUE);
          setCustomDepartment(savedName);
        }
      }
    }

    setOnboardingMode(true);
    const userIdForResume =
      userResult.user?.id ?? latestSession?.user?.id ?? session.user.id;
    // Initial login / first load: resume from metadata; optional ?step= is capped so users cannot skip ahead.
    // Later resolveMode runs (auth events, searchParams) must not override Back/Next.
    if (resumeStepHydratedUserIdRef.current !== userIdForResume) {
      const resumeFromMeta = workspaceOnboardingResumeStep(meta);
      const lastDone = workspaceOnboardingLastCompletedStep(meta);
      let initialStep = resumeFromMeta;
      if (searchParams.get("onboarding") === "1") {
        const rawStep = searchParams.get("step");
        if (rawStep !== null) {
          const n = parseInt(rawStep, 10);
          if (Number.isFinite(n) && n >= 1 && n <= ONBOARDING_STEPS) {
            // Stale ?step= (e.g. step=2 in URL while resume=3 after saving step 2) must not clamp UI to 2 via Math.min.
            if (lastDone >= n && n < resumeFromMeta) {
              initialStep = resumeFromMeta;
            } else {
              initialStep = Math.min(n, resumeFromMeta);
            }
          }
        }
      }
      setOnboardingStep(initialStep);
      resumeStepHydratedUserIdRef.current = userIdForResume;
    }
    const emailUser = userResult.user ?? latestSession?.user ?? session.user;
    setOnboardingUser({
      email: emailUser.email ?? undefined,
      google_calendar_sync: read_google_calendar_sync(meta),
    });
    setCalendarConnecting(false);
  };

  // Prefill email from /register?email=... (e.g. from login no-account modal)
  useEffect(() => {
    const em = searchParams.get("email");
    if (emailFromUrlAppliedRef.current || !em || !EMAIL_PARAM_RE.test(em)) return;
    setEmail(em);
    emailFromUrlAppliedRef.current = true;
  }, [searchParams]);

  // Resolve session: show onboarding for new users (Google signup or email/password after confirm)
  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      if (errorParam === "user_not_found") {
        setError("No account found. Try signing up or use a different email.");
      } else {
        setError(decodeURIComponent(errorParam));
      }
    }

    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await resolveMode(session);
    };
    run();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) run();
    });
    return () => subscription.unsubscribe();
  }, [searchParams, router]);

  useEffect(() => {
    if (
      searchParams.get("g_signup") === "1" &&
      onboardingMode === false &&
      !autoGoogleTriggeredRef.current
    ) {
      autoGoogleTriggeredRef.current = true;
      handleGoogleSignup();
    }
  }, [searchParams, onboardingMode]);

  useEffect(() => {
    if (onboardingMode !== true) return;

    if (!selectedProfessionId || selectedProfessionId === OTHER_VALUE) {
      setDepartmentSuggestions([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const headers = await headers_for_workspace_api();
        const res = await fetch(
          `/api/catalog/departments?profession_id=${encodeURIComponent(selectedProfessionId)}`,
          { headers }
        );
        const data = await res.json();
        if (cancelled || !res.ok) return;
        const list = data.departments;
        setDepartmentSuggestions(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setDepartmentSuggestions([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onboardingMode, selectedProfessionId]);

  const persistOnboardingStep = async (lastCompleted: number) => {
    await ensureSupabaseSessionOrThrow();
    const { error: uerr } = await supabase.auth.updateUser({
      data: { onboarding_last_completed_step: lastCompleted },
    });
    if (uerr) throw new Error(uerr.message);
  };

  const saveStep1 = async (): Promise<boolean> => {
    const isOtherProfession = selectedProfessionId === OTHER_VALUE;
    const isOtherDepartment = selectedDepartment === OTHER_VALUE;
    const hasProfession = isOtherProfession ? !!customProfession.trim() : !!selectedProfessionId;
    const departmentName = isOtherDepartment ? customDepartment.trim() : selectedDepartment;
    const hasDepartment = !!departmentName;

    if (!hasProfession || !hasDepartment || workspaceId == null) return false;
    setOnboardingSaving(true);
    setError("");
    try {
      const headers = await headers_for_workspace_api();

      const professionName = isOtherProfession
        ? customProfession.trim()
        : professions.find((p) => p.id === Number(selectedProfessionId))?.name ?? "";

      const workspaceBody = isOtherProfession
        ? { custom_profession: professionName }
        : { professions_list_id: Number(selectedProfessionId) };

      const workspaceRes = await fetch("/api/workspace", {
        method: "PUT",
        headers,
        body: JSON.stringify(workspaceBody),
      });
      if (!workspaceRes.ok) {
        const err = await workspaceRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save profession");
      }

      // Check if department already exists in this workspace before creating
      const existingRes = await fetch("/api/departments", { headers });
      const existingDepts: { id: number; name: string }[] = existingRes.ok
        ? (await existingRes.json()).departments ?? []
        : [];
      const alreadyExists = existingDepts.some(
        (d) => d.name.toLowerCase() === departmentName.toLowerCase()
      );

      if (!alreadyExists) {
        const deptRes = await fetch("/api/departments", {
          method: "POST",
          headers,
          body: JSON.stringify({ name: departmentName }),
        });
        if (!deptRes.ok) {
          const err = await deptRes.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed to create department");
        }
      }

      setWorkspaceType(professionName);
      await persistOnboardingStep(1);
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
      return false;
    } finally {
      setOnboardingSaving(false);
    }
  };

  const saveStep4 = async (): Promise<boolean> => {
    setOnboardingSaving(true);
    setError("");
    try {
      const headers = await headers_for_workspace_api();
      const getRes = await fetch("/api/settings", {
        headers: { Authorization: headers.Authorization },
      });
      const existingSettings = getRes.ok ? (await getRes.json()).settings ?? {} : {};
      const merged = {
        ...existingSettings,
        meeting_options: {
          google_meet: meetingOptions.google_meet,
          in_person: meetingOptions.in_person,
          phone_call: meetingOptions.phone_call,
          whatsapp: meetingOptions.whatsapp,
        },
      };
      const postRes = await fetch("/api/settings", {
        method: "POST",
        headers,
        body: JSON.stringify({ settings: merged }),
      });
      if (!postRes.ok) {
        const err = await postRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to save meeting options");
      }
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save meeting options");
      return false;
    } finally {
      setOnboardingSaving(false);
    }
  };

  const handleOnboardingNext = async () => {
    setError("");
    if (onboardingStep === 1) {
      const ok = await saveStep1();
      if (ok) goToOnboardingStep(2);
    } else if (onboardingStep === 2) {
      setOnboardingSaving(true);
      try {
        await persistOnboardingStep(2);
        goToOnboardingStep(3);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to save progress");
      } finally {
        setOnboardingSaving(false);
      }
    } else if (onboardingStep === 3) {
      if (!step3Saved) {
        setError("Save working hours first, then click Next.");
        return;
      }
      setOnboardingSaving(true);
      try {
        await persistOnboardingStep(3);
        goToOnboardingStep(4);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to save progress");
      } finally {
        setOnboardingSaving(false);
      }
    } else if (onboardingStep === 4) {
      const ok = await saveStep4();
      if (!ok) return;
      try {
        await ensureSupabaseSessionOrThrow();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to save progress");
        return;
      }
      const { error: onboardErr } = await supabase.auth.updateUser({
        data: { onboarding_completed: true, onboarding_last_completed_step: 4 },
      });
      if (onboardErr) {
        setError(onboardErr.message || "Failed to finish setup");
        return;
      }
      await supabase.auth.getUser();
      router.replace("/");
    }
  };

  const handleGoogleSignup = async () => {
    setError("");
    setSuccess(false);
    setGoogleLoading(true);

    try {
      const response = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enableCalendarSync: true,
          isSignup: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to initiate Google signup');
        setGoogleLoading(false);
        return;
      }

      // Redirect to Google OAuth
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        setError('No auth URL received');
        setGoogleLoading(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
      setGoogleLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registeringRef.current) return;
    setError("");
    setSuccess(false);

    if (!fullName || !email || !password) {
      setError("All fields are required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    registeringRef.current = true;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: fullName }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(json.error ?? "Registration failed. Please try again.");
        return;
      }

      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      console.error("Registration error:", err);
    } finally {
      registeringRef.current = false;
      setLoading(false);
    }
  };

  // Onboarding flow (new users after Google signup)
  if (onboardingMode === true) {
    const googleSync = onboardingUser?.google_calendar_sync === true;
    const googleEmail = onboardingUser?.email ?? "";

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8">
        <div className="absolute top-0 left-0 w-full h-full bg-grid-pattern opacity-5" />
        <div className="w-full max-w-6xl px-6 relative z-10">
          <div className="text-center mb-6">
            <Link href="/" className="inline-block">
              <Image src="/getsettime-logo.svg" alt="GetSetTime Logo" width={200} height={50} className="mx-auto mb-4" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">Set up your workspace</h1>
            <p className="text-gray-600">Step {onboardingStep} of {ONBOARDING_STEPS}</p>
            <div className="flex justify-center gap-1 mt-2">
              {[1, 2, 3, 4].map((s) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 max-w-[60px] rounded-full ${s <= onboardingStep ? "bg-blue-600" : "bg-gray-200"}`}
                />
              ))}
            </div>
          </div>

          {error && onboardingStep !== 3 && (
            <div className="mb-4">
              <AlertMessage type="error" message={error} />
            </div>
          )}

          {onboardingStep === 1 && (
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 space-y-8">
              {/* Profession badges */}
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-1">What is your profession?</h2>
                <p className="text-sm text-gray-500 mb-4">Select the option that best describes your work</p>
                <div className="grid grid-cols-2 gap-3">
                  {professions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedProfessionId(String(p.id));
                        setCustomProfession("");
                        setSelectedDepartment("");
                        setCustomDepartment("");
                      }}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left font-medium transition ${
                        selectedProfessionId === String(p.id)
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-base">{p.name}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProfessionId(OTHER_VALUE);
                      setSelectedDepartment("");
                      setCustomDepartment("");
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left font-medium transition ${
                      selectedProfessionId === OTHER_VALUE
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <span className="text-base">Other</span>
                  </button>
                </div>
                {selectedProfessionId === OTHER_VALUE && (
                  <input
                    type="text"
                    placeholder="Enter your profession"
                    className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={customProfession}
                    onChange={(e) => setCustomProfession(e.target.value)}
                    autoFocus
                  />
                )}
              </div>

              {/* Department */}
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-1">Department</h2>
                <p className="text-sm text-gray-500 mb-4">
                  {selectedProfessionId && selectedProfessionId !== OTHER_VALUE
                    ? "Suggestions match the profession you selected above. You can still add a custom department."
                    : "Choose a catalog profession first to see suggested departments, or use Other and enter your own."}
                </p>
                <select
                  id="department"
                  value={selectedDepartment}
                  onChange={(e) => {
                    setSelectedDepartment(e.target.value);
                    if (e.target.value !== OTHER_VALUE) setCustomDepartment("");
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                >
                  <option value="">Select a department</option>
                  {departmentSuggestions.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  <option value={OTHER_VALUE}>Other</option>
                </select>
                {selectedDepartment === OTHER_VALUE && (
                  <input
                    type="text"
                    placeholder="e.g. General Practice"
                    className="mt-3 w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={customDepartment}
                    onChange={(e) => setCustomDepartment(e.target.value)}
                    autoFocus
                  />
                )}
              </div>
            </div>
          )}

          {onboardingStep === 2 && (
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 space-y-4">
              <h2 className="text-lg font-semibold text-gray-800">Google Calendar Sync</h2>
              <p className="text-sm text-gray-600">Connect your Google Calendar to avoid double bookings and keep availability in sync.</p>
              {googleSync ? (
                <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="font-medium text-green-800">Calendar sync enabled</p>
                    <p className="text-sm text-green-700">Google email: {googleEmail}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={async () => {
                      setCalendarConnecting(true);
                      setError("");
                      try {
                        const res = await fetch("/api/auth/google", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            enableCalendarSync: true,
                            isSignup: false,
                            returnTo: "/register?onboarding=1&step=2",
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok) {
                          setError(data.error ?? "Failed to connect Google");
                          setCalendarConnecting(false);
                          return;
                        }
                        if (data.authUrl) {
                          window.location.href = data.authUrl;
                        } else {
                          setError("No auth URL received");
                          setCalendarConnecting(false);
                        }
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Failed to connect");
                        setCalendarConnecting(false);
                      }
                    }}
                    disabled={calendarConnecting}
                    className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 font-medium hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {calendarConnecting ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Connecting…
                      </>
                    ) : (
                      <>
                        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                          <path fill="#EA4335" d="M24 9.5c3.54 0 6.73 1.22 9.24 3.62l6.9-6.9C35.9 2.4 30.3 0 24 0 14.6 0 6.52 5.38 2.56 13.22l8.03 6.24C12.6 13.5 17.8 9.5 24 9.5z" />
                          <path fill="#4285F4" d="M46.1 24.5c0-1.64-.15-3.22-.43-4.75H24v9h12.4c-.54 2.9-2.2 5.36-4.72 7.03l7.2 5.58C43.2 37.2 46.1 31.4 46.1 24.5z" />
                          <path fill="#FBBC05" d="M10.6 28.54c-.5-1.5-.78-3.1-.78-4.74s.28-3.24.78-4.74l-8.03-6.24C.93 16.6 0 20.2 0 23.8s.93 7.2 2.56 10.02l8.03-6.28z" />
                          <path fill="#34A853" d="M24 48c6.3 0 11.6-2.08 15.46-5.64l-7.2-5.58c-2 1.35-4.56 2.15-8.26 2.15-6.2 0-11.4-4-13.3-9.6l-8.03 6.28C6.52 42.62 14.6 48 24 48z" />
                        </svg>
                        Connect Google Calendar
                      </>
                    )}
                  </button>
                  <p className="text-center text-sm text-gray-500">or skip and connect later in Settings → Integrations</p>
                </div>
              )}
            </div>
          )}

          {onboardingStep === 3 && (
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
              <h2 className="text-lg font-semibold text-gray-800 mb-4">Working Hours</h2>
              <p className="text-sm text-gray-600 mb-4">Configure your availability and break times, then click Save Timesheet before continuing.</p>
              <AvailabilityTimesheet
                onSave={() => setStep3Saved(true)}
              />
            </div>
          )}

          {onboardingStep === 4 && (
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 space-y-6">
              <h2 className="text-lg font-semibold text-gray-800">Meeting Options</h2>
              <p className="text-sm text-gray-600">Choose how clients can meet with you.</p>
              <div className="space-y-3">
                {[
                  { key: "google_meet" as const, label: "Google Meet" },
                  { key: "in_person" as const, label: "In-person" },
                  { key: "phone_call" as const, label: "Phone call" },
                  { key: "whatsapp" as const, label: "Whatsapp Notification" },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={meetingOptions[key]}
                      onChange={(e) => setMeetingOptions((prev) => ({ ...prev, [key]: e.target.checked }))}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span className="text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 space-y-3">
            {error && onboardingStep === 3 && (
              <AlertMessage type="error" message={error} />
            )}
            <div className="flex justify-between">
              {onboardingStep > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    goToOnboardingStep(onboardingStep - 1);
                  }}
                  disabled={onboardingSaving}
                  className="px-6 py-3 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Back
                </button>
              ) : <span />}
              <button
                type="button"
                onClick={handleOnboardingNext}
                disabled={onboardingSaving || (onboardingStep === 1 && (
                  (selectedProfessionId === OTHER_VALUE ? !customProfession.trim() : !selectedProfessionId) ||
                  (selectedDepartment === OTHER_VALUE ? !customDepartment.trim() : !selectedDepartment)
                ))}
                className="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {onboardingSaving ? "Saving…" : onboardingStep === 4 ? "Finish" : "Next"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (onboardingMode === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

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
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Create Account</h1>
          <p className="text-gray-600">Join GetSetTime to manage your bookings</p>
        </div>

        <form onSubmit={handleRegister} className="bg-white rounded-2xl shadow-xl p-8 space-y-5 border border-gray-100">
          {success && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-start">
              <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="font-medium">Account created successfully!</p>
                <p className="text-sm">
                  Check your email and confirm your address. Then go to the login page and sign in with your password. After sign-in, you&apos;ll finish setup (profession, availability, and more) if you haven&apos;t already.
                </p>
              </div>
            </div>
          )}

          {error && <AlertMessage type="error" message={error} />}

          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={loading || success || googleLoading}
            className="w-full bg-white text-gray-700 py-3 rounded-lg font-medium border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="flex items-center justify-center gap-3">
              {googleLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Connecting...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.73 1.22 9.24 3.62l6.9-6.9C35.9 2.4 30.3 0 24 0 14.6 0 6.52 5.38 2.56 13.22l8.03 6.24C12.6 13.5 17.8 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.1 24.5c0-1.64-.15-3.22-.43-4.75H24v9h12.4c-.54 2.9-2.2 5.36-4.72 7.03l7.2 5.58C43.2 37.2 46.1 31.4 46.1 24.5z"/>
                    <path fill="#FBBC05" d="M10.6 28.54c-.5-1.5-.78-3.1-.78-4.74s.28-3.24.78-4.74l-8.03-6.24C.93 16.6 0 20.2 0 23.8s.93 7.2 2.56 10.02l8.03-6.28z"/>
                    <path fill="#34A853" d="M24 48c6.3 0 11.6-2.08 15.46-5.64l-7.2-5.58c-2 1.35-4.56 2.15-8.26 2.15-6.2 0-11.4-4-13.3-9.6l-8.03 6.28C6.52 42.62 14.6 48 24 48z"/>
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
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input
                id="fullName"
                type="text"
                placeholder="John Doe"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
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
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
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
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition"
                disabled={loading}
              >
                {showPassword ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">Must be at least 6 characters</p>
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-medium hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating account...
              </span>
            ) : success ? (
              "Success!"
            ) : (
              "Create Account"
            )}
          </button>

          <div className="text-center pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <Link href="/login" className="text-blue-600 hover:text-blue-800 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
