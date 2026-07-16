"use client";
import { useState, useEffect, useRef, useCallback, type ComponentType } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import * as AppIcons from "@app/icons";
import {
  workspaceAdminNeedsOnboardingWizard,
  serviceProviderNeedsOnboardingWizard,
  workspaceOnboardingLastCompletedStep,
  workspaceOnboardingResumeStep,
  readInviteOnboardingContext,
  clearInviteOnboardingContext,
  persistInviteOnboardingContext,
} from "@/lib/auth_onboarding";
import {
  normalizeDepartmentIdArray,
  normalizeStringArray,
} from "@/lib/invite_department_assignment";
import { supabase } from "@/lib/supabaseClient";
import AvailabilityTimesheet, {
  type availability_timesheet_handle,
  type availability_timesheet_save_feedback,
} from "@/src/components/Settings/AvailabilityTimesheet";
import { ConfirmModal } from "@/src/components/ui/ConfirmModal";
import AlertMessage from "@/src/components/Auth/AlertMessage";
import {
  ROLE_WORKSPACE_ADMIN,
  ROLE_SERVICE_PROVIDER,
  ROLE_CUSTOMER,
} from "@/src/constants/roles";
import { build_service_provider_public_booking_url } from "@/src/utils/public_booking_link";

type OnboardingRole = "workspace_admin" | "service_provider";

/** Row from professions_list (onboarding catalog), not workspace professions.id */
type Profession = {
  id: number;
  name: string;
  icon: string | null;
  departments_count: number;
};

type IconComponent = ComponentType<{ className?: string }>;

const ONBOARDING_STEPS = 4;
const OTHER_VALUE = "__other__";
const ONBOARDING_BOOTSTRAP_TIMEOUT_MS = 45_000;
const CUSTOM_ICON_PREFIX = "data:image/";
const DEFAULT_PROFESSION_ICON_KEY = "FcBriefcase";

function isCustomProfessionIcon(iconValue: string | null | undefined): iconValue is string {
  return typeof iconValue === "string" && iconValue.startsWith(CUSTOM_ICON_PREFIX);
}

function isLibraryProfessionIcon(iconValue: string | null | undefined): iconValue is keyof typeof AppIcons {
  return typeof iconValue === "string" && iconValue in AppIcons;
}

async function with_network_timeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  let t: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        t = setTimeout(() => reject(new Error(message)), ms);
      }),
    ]);
  } finally {
    if (t !== undefined) clearTimeout(t);
  }
}

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
  const pathname = usePathname();
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
  const [onboardingRole, setOnboardingRole] = useState<OnboardingRole | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [workspaceId, setWorkspaceId] = useState<number | null>(null);
  const [workspaceType, setWorkspaceType] = useState<string | null>(null);
  const [workspaceCatalogProfessionId, setWorkspaceCatalogProfessionId] = useState("");
  const [onboardingProviderUserId, setOnboardingProviderUserId] = useState<string | null>(null);
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [providerLinkSlug, setProviderLinkSlug] = useState("");
  const [providerLinkLoading, setProviderLinkLoading] = useState(false);
  const [providerLinkError, setProviderLinkError] = useState<string | null>(null);
  const [spDepartmentsLockedFromInvite, setSpDepartmentsLockedFromInvite] = useState(false);
  // Step 1 — Profession
  const [professions, setProfessions] = useState<Profession[]>([]);
  const [selectedProfessionId, setSelectedProfessionId] = useState<string>("");
  const [customProfession, setCustomProfession] = useState("");
  // Step 1 — Department
  const [departmentSuggestions, setDepartmentSuggestions] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [customDepartment, setCustomDepartment] = useState("");
  const [customDepartmentMode, setCustomDepartmentMode] = useState(false);
  // Step 4
  const [meetingOptions, setMeetingOptions] = useState({
    in_person: true,
    phone_call: false,
    google_meet: false,
  });
  const [step3Saved, setStep3Saved] = useState(false);
  const [step3SaveChoiceOpen, setStep3SaveChoiceOpen] = useState(false);
  const [step3SavingHours, setStep3SavingHours] = useState(false);
  const timesheetRef = useRef<availability_timesheet_handle | null>(null);
  const departmentSectionRef = useRef<HTMLDivElement>(null);

  const scrollToDepartmentSection = useCallback(() => {
    // Wait a frame so the department suggestions render before scrolling.
    requestAnimationFrame(() => {
      departmentSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const nextButtonRef = useRef<HTMLButtonElement>(null);

  const scrollToNextButton = useCallback(() => {
    requestAnimationFrame(() => {
      nextButtonRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, []);
  const [timesheetSaveFeedback, setTimesheetSaveFeedback] =
    useState<availability_timesheet_save_feedback>(null);
  const [onboardingUser, setOnboardingUser] = useState<{ email?: string; google_calendar_sync?: boolean } | null>(null);

  useEffect(() => {
    if (onboardingMode !== true || onboardingRole !== "service_provider") return;
    void supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id;
      if (id) setOnboardingProviderUserId(id);
    });
  }, [onboardingMode, onboardingRole, onboardingStep]);
  const [calendarConnecting, setCalendarConnecting] = useState(false);

  const registeringRef = useRef(false);
  const bootstrapPromiseRef = useRef<Promise<number | null> | null>(null);
  /** Serialize resolveMode so auth events + URL updates cannot interleave and clobber step/UI. */
  const resolveQueueRef = useRef(Promise.resolve());
  const autoGoogleTriggeredRef = useRef(false);
  const emailFromUrlAppliedRef = useRef(false);
  /** Apply metadata resume step only once per user after login / first load; do not override Back/Next. */
  const resumeStepHydratedUserIdRef = useRef<string | null>(null);

  // Optimistic step-1 save: started when leaving step 1, awaited before any step
  // that depends on the saved departments/profession (and surfaced as an error there).
  const step1SavePromiseRef = useRef<Promise<boolean> | null>(null);
  /** Locked for full invite onboarding so auth refresh cannot create a personal workspace. */
  const onboardingKindRef = useRef<"invite" | "owner" | null>(null);
  const lockedWorkspaceIdRef = useRef<number | null>(null);
  const providerLinkEnsureRef = useRef<{
    userId: string;
    promise: Promise<void>;
  } | null>(null);

  const ensureServiceProviderBookingLink = useCallback(
    async (headers: Record<string, string>, userId: string) => {
      if (providerLinkEnsureRef.current?.userId === userId) {
        await providerLinkEnsureRef.current.promise;
        return;
      }

      const promise = (async () => {
        setProviderLinkLoading(true);
        setProviderLinkError(null);
        try {
          const res = await fetch("/api/onboarding/service-provider-link", {
            method: "POST",
            headers,
          });
          const body = (await res.json().catch(() => ({}))) as {
            slug?: string;
            workspace_slug?: string;
            preview_url?: string | null;
            error?: string;
          };
          if (!res.ok) {
            const message =
              typeof body.error === "string"
                ? body.error
                : "Failed to create booking link";
            setProviderLinkError(message);
            setProviderLinkSlug("");
            return;
          }
          if (typeof body.slug === "string") {
            setProviderLinkSlug(body.slug);
          }
          if (typeof body.workspace_slug === "string") {
            setWorkspaceSlug(body.workspace_slug);
          }
        } catch (e: unknown) {
          setProviderLinkError(
            e instanceof Error ? e.message : "Failed to create booking link"
          );
          setProviderLinkSlug("");
        } finally {
          setProviderLinkLoading(false);
        }
      })();

      providerLinkEnsureRef.current = { userId, promise };
      await promise;
    },
    []
  );

  const EMAIL_PARAM_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  const goToOnboardingStep = useCallback(
    (step: number) => {
      const s = Math.min(Math.max(step, 1), ONBOARDING_STEPS);
      setOnboardingStep(s);
      const params = new URLSearchParams(searchParams.toString());
      params.set("onboarding", "1");
      params.set("step", String(s));
      const inviteCtx = readInviteOnboardingContext();
      if (inviteCtx) {
        params.set("invite_workspace_id", String(inviteCtx.workspaceId));
      } else if (lockedWorkspaceIdRef.current != null) {
        params.set("invite_workspace_id", String(lockedWorkspaceIdRef.current));
      }
      const href = `${pathname}?${params.toString()}`;
      // Sync address bar immediately; App Router searchParams can lag behind router.replace,
      // and resolveMode must not read stale ?step= and overwrite onboardingStep (see fast path).
      if (typeof window !== "undefined") {
        window.history.replaceState(window.history.state, "", href);
      }
      router.replace(href);
    },
    [router, pathname, searchParams]
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
    const parseWorkspaceIdFromMeta = (m: Record<string, unknown>): number | undefined => {
      const raw = m.workspace_id;
      const n =
        typeof raw === "number" && Number.isFinite(raw)
          ? raw
          : typeof raw === "string"
            ? parseInt(raw, 10)
            : NaN;
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };

    let wid = parseWorkspaceIdFromMeta(meta);

    const inviteCtxStored = readInviteOnboardingContext();
    const inviteWorkspaceParam = searchParams.get("invite_workspace_id");
    if (inviteCtxStored) {
      wid = inviteCtxStored.workspaceId;
      onboardingKindRef.current = "invite";
      lockedWorkspaceIdRef.current = inviteCtxStored.workspaceId;
    } else if (inviteWorkspaceParam) {
      const fromInvite = parseInt(inviteWorkspaceParam, 10);
      if (Number.isFinite(fromInvite) && fromInvite > 0) {
        wid = fromInvite;
        onboardingKindRef.current = "invite";
        lockedWorkspaceIdRef.current = fromInvite;
        persistInviteOnboardingContext(fromInvite);
      }
    }

    const isOnboardingFlow = searchParams.get("onboarding") === "1";

    const { data: userResultEarly, error: getUserEarlyErr } = await supabase.auth.getUser();
    if (!getUserEarlyErr && userResultEarly.user?.user_metadata) {
      meta = userResultEarly.user.user_metadata as Record<string, unknown>;
      if (onboardingKindRef.current !== "invite") {
        wid = parseWorkspaceIdFromMeta(meta) ?? wid;
      }
    }
    if (onboardingKindRef.current === "invite" && lockedWorkspaceIdRef.current != null) {
      wid = lockedWorkspaceIdRef.current;
    } else if (inviteCtxStored) {
      wid = inviteCtxStored.workspaceId;
    } else if (inviteWorkspaceParam) {
      const fromInviteLocked = parseInt(inviteWorkspaceParam, 10);
      if (Number.isFinite(fromInviteLocked) && fromInviteLocked > 0) {
        wid = fromInviteLocked;
      }
    }

    const isConfirmedParam = searchParams.get("confirmed") === "1";
    const invitedAt = meta.invited_at;
    const isInvitedMember =
      typeof invitedAt === "string"
        ? invitedAt.trim() !== ""
        : invitedAt != null;
    const metaRole = typeof meta.role === "string" ? meta.role : "";
    const isInvitedTeamRole =
      metaRole === ROLE_SERVICE_PROVIDER ||
      metaRole === "manager" ||
      metaRole === "staff" ||
      metaRole === "customer";

    const hasWorkspaceFromMeta = wid != null;

    // Invited team members: never create a personal workspace (bootstrap syncs invite workspace only).
    const isInviteOnboarding =
      onboardingKindRef.current === "invite" ||
      Boolean(inviteWorkspaceParam) ||
      Boolean(inviteCtxStored) ||
      isInvitedMember ||
      isInvitedTeamRole;

    if (isInviteOnboarding && wid != null) {
      onboardingKindRef.current = "invite";
      lockedWorkspaceIdRef.current = wid;
      persistInviteOnboardingContext(wid);
    } else if (
      !onboardingKindRef.current &&
      (metaRole === ROLE_WORKSPACE_ADMIN || metaRole === "")
    ) {
      onboardingKindRef.current = "owner";
    }

    const isLockedInviteOnboarding = onboardingKindRef.current === "invite";

    // Self-signup (email confirm or Google): create workspace even on /register?onboarding=1.
    const shouldBootstrapOwnedWorkspace =
      !isLockedInviteOnboarding &&
      !hasWorkspaceFromMeta &&
      !isInviteOnboarding &&
      (isConfirmedParam ||
        Boolean(session.user.email_confirmed_at) ||
        (isOnboardingFlow &&
          (metaRole === ROLE_WORKSPACE_ADMIN || metaRole === "")));

    const runBootstrapWorkspace = async (timeoutMessage: string): Promise<number | null> => {
      const res = await with_network_timeout(
        fetch("/api/auth/bootstrap-workspace", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        }),
        ONBOARDING_BOOTSTRAP_TIMEOUT_MS,
        timeoutMessage
      );
      if (!res.ok) return null;
      const body = (await res.json()) as { workspace_id?: number };
      const id = body.workspace_id;
      return id != null && Number.isFinite(id) ? id : null;
    };

    if (isLockedInviteOnboarding && lockedWorkspaceIdRef.current != null) {
      wid = lockedWorkspaceIdRef.current;
    } else if (
      shouldBootstrapOwnedWorkspace ||
      (!hasWorkspaceFromMeta && isInviteOnboarding && !isLockedInviteOnboarding)
    ) {
      const timeoutMessage = shouldBootstrapOwnedWorkspace
        ? "Creating your workspace is taking too long. Check your connection and refresh the page."
        : "Could not load your workspace. Please refresh or sign in again.";

      let promise = bootstrapPromiseRef.current;
      if (!promise) {
        promise = runBootstrapWorkspace(timeoutMessage).catch(() => null);
        bootstrapPromiseRef.current = promise;
      }
      let resolvedWid: number | null;
      try {
        resolvedWid = await promise;
      } catch {
        bootstrapPromiseRef.current = null;
        setOnboardingMode(false);
        return;
      }
      bootstrapPromiseRef.current = null;

      if (resolvedWid != null) {
        wid = resolvedWid;
        if (isLockedInviteOnboarding && lockedWorkspaceIdRef.current != null) {
          wid = lockedWorkspaceIdRef.current;
        }
        try {
          await with_network_timeout(
            enqueueAuthRefresh(),
            25_000,
            "Session refresh timed out. Please refresh the page or sign in again."
          );
          const { data: userAfterSync } = await supabase.auth.getUser();
          if (userAfterSync.user?.user_metadata) {
            meta = userAfterSync.user.user_metadata as Record<string, unknown>;
          }
        } catch {
          setOnboardingMode(false);
          return;
        }
      }
    }

    if (!wid) {
      setOnboardingMode(false);
      return;
    }

    const userRole = meta.role as string | undefined;
    const isServiceProvider = userRole === ROLE_SERVICE_PROVIDER;
    const isWorkspaceAdmin = userRole === ROLE_WORKSPACE_ADMIN;

    if (userRole && !isWorkspaceAdmin && !isServiceProvider) {
      router.replace(userRole === ROLE_CUSTOMER ? "/my-bookings" : "/");
      return;
    }

    if (isServiceProvider) {
      setOnboardingRole("service_provider");
    } else if (isWorkspaceAdmin) {
      setOnboardingRole("workspace_admin");
    } else {
      setOnboardingMode(false);
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
        slug?: string | null;
        type?: string | null;
        profession_id?: number | null;
        profession_name?: string | null;
        admin_professions_id?: number | null;
      };
    };
    const ws = wsBody.workspace ?? null;
    const wsSlug =
      typeof ws?.slug === "string" && ws.slug.trim() ? ws.slug.trim() : "";
    if (wsSlug) {
      setWorkspaceSlug(wsSlug);
    }

    // Fresh metadata before wizard check (JWT can lag behind auth.users after updateUser).
    const { data: userResult, error: getUserErr } = await supabase.auth.getUser();
    if (!getUserErr && userResult.user?.user_metadata) {
      meta = userResult.user.user_metadata as Record<string, unknown>;
    }

    const userIdForResume =
      userResult.user?.id ?? session.user.id;

    if (isServiceProvider) {
      setOnboardingProviderUserId(userIdForResume);
      if (!serviceProviderNeedsOnboardingWizard(meta)) {
        resumeStepHydratedUserIdRef.current = null;
        router.replace("/");
        return;
      }
    } else {
      const hasType = !!ws?.type || !!ws?.profession_id;
      const wizardIncomplete = workspaceAdminNeedsOnboardingWizard(meta, hasType);
      if (!wizardIncomplete) {
        resumeStepHydratedUserIdRef.current = null;
        router.replace("/");
        return;
      }
    }

    // Already hydrated: refresh header user only. Do not setOnboardingStep from searchParams here —
    // after saveStep1, onAuthStateChange runs resolveMode while useSearchParams() still has the old ?step=,
    // which would reset the UI to step 1 and make Next appear broken. Step comes from goToOnboardingStep / full hydration.
    if (resumeStepHydratedUserIdRef.current === userIdForResume) {
      const { data: { session: latestSession } } = await supabase.auth.getSession();
      const tokenAfterRefreshFast =
        latestSession?.access_token ?? session.access_token;
      const authHeadersFast: Record<string, string> = {
        Authorization: `Bearer ${tokenAfterRefreshFast}`,
        "Content-Type": "application/json",
      };
      const emailUser = userResult.user ?? latestSession?.user ?? session.user;
      setWorkspaceType(ws?.type ?? null);
      setOnboardingUser({
        email: emailUser.email ?? undefined,
        google_calendar_sync: read_google_calendar_sync(meta),
      });
      if (isServiceProvider && userIdForResume) {
        await ensureServiceProviderBookingLink(authHeadersFast, userIdForResume);
      }
      setOnboardingMode(true);
      setCalendarConnecting(false);
      return;
    }

    const { data: { session: latestSession } } = await supabase.auth.getSession();
    const tokenAfterRefresh = latestSession?.access_token ?? session.access_token;
    const authHeadersFresh: Record<string, string> = {
      Authorization: `Bearer ${tokenAfterRefresh}`,
    };

    const labelForProfession =
      (typeof ws?.type === "string" && ws.type.trim()) ||
      (typeof ws?.profession_name === "string" && ws.profession_name.trim()) ||
      "";
    setWorkspaceType((labelForProfession || ws?.type) ?? null);

    let resolvedCatalogProfessionId = "";
    const adminCatalogId = ws?.admin_professions_id;
    if (isServiceProvider && adminCatalogId != null && Number.isFinite(Number(adminCatalogId))) {
      resolvedCatalogProfessionId = String(adminCatalogId);
      setWorkspaceCatalogProfessionId(resolvedCatalogProfessionId);
      setSelectedProfessionId(resolvedCatalogProfessionId);
    } else {
      const profRes = await fetch("/api/professions", { headers: authHeadersFresh });
      let catalogList: Profession[] = [];
      if (profRes.ok) {
        const profBody = await profRes.json();
        catalogList = (profBody.professions ?? []) as Profession[];
      }
      setProfessions(catalogList);

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
      if (isServiceProvider && resolvedCatalogProfessionId) {
        setWorkspaceCatalogProfessionId(resolvedCatalogProfessionId);
      }
    }

    const prefillDepartmentNames = async (savedNames: string[]) => {
      if (savedNames.length === 0) return;
      let suggestionNames: string[] = [];
      const catalogForSuggestions = resolvedCatalogProfessionId;
      if (
        catalogForSuggestions &&
        catalogForSuggestions !== OTHER_VALUE &&
        /^\d+$/.test(catalogForSuggestions)
      ) {
        const sRes = await fetch(
          `/api/catalog/departments?profession_id=${encodeURIComponent(catalogForSuggestions)}`,
          { headers: authHeadersFresh }
        );
        if (sRes.ok) {
          const sj = (await sRes.json()) as { departments?: string[] };
          suggestionNames = Array.isArray(sj.departments) ? sj.departments : [];
        }
      }
      const matched: string[] = [];
      const custom: string[] = [];
      for (const savedName of savedNames) {
        const exactInSuggestions = suggestionNames.find(
          (n) => n.toLowerCase() === savedName.toLowerCase()
        );
        if (exactInSuggestions) {
          matched.push(exactInSuggestions);
        } else {
          custom.push(savedName);
        }
      }
      if (matched.length > 0 || custom.length > 0) {
        setSelectedDepartments([...matched, ...custom]);
        if (custom.length > 0) setCustomDepartmentMode(true);
      }
    };

    if (isServiceProvider && userIdForResume) {
      const pendingIds = normalizeDepartmentIdArray(meta?.pending_department_ids);
      const pendingNames = normalizeStringArray(meta?.pending_department_names);
      if (pendingIds.length > 0 || pendingNames.length > 0) {
        setSpDepartmentsLockedFromInvite(true);
        const mergedNames = [...pendingNames];
        if (pendingIds.length > 0) {
          const allDeptRes = await fetch("/api/departments", { headers: authHeadersFresh });
          if (allDeptRes.ok) {
            const allDeptJson = (await allDeptRes.json()) as {
              departments?: { id: number; name: string }[];
            };
            for (const d of allDeptJson.departments ?? []) {
              if (pendingIds.includes(d.id)) {
                const n = d.name.trim();
                if (n && !mergedNames.some((x) => x.toLowerCase() === n.toLowerCase())) {
                  mergedNames.push(n);
                }
              }
            }
          }
        }
        if (mergedNames.length > 0) {
          await prefillDepartmentNames(mergedNames);
        }
      } else {
        const udRes = await fetch(
          `/api/user-departments?user_id=${encodeURIComponent(userIdForResume)}`,
          { headers: authHeadersFresh }
        );
        if (udRes.ok) {
          const udJson = (await udRes.json()) as {
            assignments?: { department_id?: number }[];
          };
          const deptIds = (udJson.assignments ?? [])
            .map((a) => a.department_id)
            .filter((id): id is number => typeof id === "number");
          if (deptIds.length > 0) {
            const allDeptRes = await fetch("/api/departments", { headers: authHeadersFresh });
            if (allDeptRes.ok) {
              const allDeptJson = (await allDeptRes.json()) as {
                departments?: { id: number; name: string }[];
              };
              const names = (allDeptJson.departments ?? [])
                .filter((d) => deptIds.includes(d.id))
                .map((d) => d.name.trim())
                .filter(Boolean);
              await prefillDepartmentNames(names);
            }
          }
        }
      }
    } else {
      const wsDeptRes = await fetch("/api/departments", { headers: authHeadersFresh });
      if (wsDeptRes.ok) {
        const deptJson = (await wsDeptRes.json()) as { departments?: { name: string }[] };
        const savedName = deptJson.departments?.[0]?.name?.trim();
        if (savedName) {
          await prefillDepartmentNames([savedName]);
        }
      }
    }

    if (isServiceProvider && userIdForResume) {
      await ensureServiceProviderBookingLink(authHeadersFresh, userIdForResume);
    }

    setOnboardingMode(true);
    const userIdForResumeFull =
      userResult.user?.id ?? latestSession?.user?.id ?? session.user.id;
    // Initial login / first load: resume from metadata; optional ?step= is capped so users cannot skip ahead.
    // Later resolveMode runs (auth events, searchParams) must not override Back/Next.
    if (resumeStepHydratedUserIdRef.current !== userIdForResumeFull) {
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
      resumeStepHydratedUserIdRef.current = userIdForResumeFull;
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

    const scheduleResolve = () => {
      resolveQueueRef.current = resolveQueueRef.current
        .catch(() => undefined)
        .then(async () => {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            await resolveMode(session);
          } catch (e: unknown) {
            console.error("register onboarding resolve", e);
            setOnboardingMode(false);
            setError(
              e instanceof Error
                ? e.message
                : "Could not load workspace setup. Try refreshing the page."
            );
          }
        });
    };
    scheduleResolve();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) scheduleResolve();
    });
    return () => subscription.unsubscribe();
  }, [searchParams, router]);

  // useEffect(() => {
  //   if (
  //     searchParams.get("g_signup") === "1" &&
  //     onboardingMode === false &&
  //     !autoGoogleTriggeredRef.current
  //   ) {
  //     autoGoogleTriggeredRef.current = true;
  //     handleGoogleSignup();
  //   }
  // }, [searchParams, onboardingMode]);

  useEffect(() => {
    if (onboardingStep !== 3) {
      setTimesheetSaveFeedback(null);
    }
  }, [onboardingStep]);

  useEffect(() => {
    if (onboardingMode !== true) return;

    const catalogProfessionId =
      onboardingRole === "service_provider"
        ? workspaceCatalogProfessionId || selectedProfessionId
        : selectedProfessionId;

    if (!catalogProfessionId) {
      setDepartmentSuggestions([]);
      if (onboardingRole !== "service_provider") {
        setSelectedDepartments([]);
        setCustomDepartmentMode(false);
      }
      return;
    }

    if (catalogProfessionId === OTHER_VALUE) {
      setDepartmentSuggestions([]);
      setCustomDepartmentMode(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const headers = await headers_for_workspace_api();
        const res = await fetch(
          `/api/catalog/departments?profession_id=${encodeURIComponent(catalogProfessionId)}`,
          { headers }
        );
        const data = await res.json();
        if (cancelled || !res.ok) return;
        const list = data.departments;
        const normalized = Array.isArray(list) ? list : [];
        setDepartmentSuggestions(normalized);
        setSelectedDepartments((prev) => {
          const stillValid = prev.filter((name) => normalized.includes(name));
          return stillValid;
        });
      } catch {
        if (!cancelled) {
          setDepartmentSuggestions([]);
          setSelectedDepartments([]);
          setCustomDepartmentMode(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [onboardingMode, onboardingRole, selectedProfessionId, workspaceCatalogProfessionId]);

  const persistOnboardingStep = async (lastCompleted: number) => {
    await ensureSupabaseSessionOrThrow();
    const { error: uerr } = await supabase.auth.updateUser({
      data: { onboarding_last_completed_step: lastCompleted },
    });
    if (uerr) throw new Error(uerr.message);
  };

  const collectStep1DepartmentNames = (): string[] => {
    const isOtherProfession = selectedProfessionId === OTHER_VALUE;
    const customDepartmentName = customDepartment.trim();
    const departmentNames = [
      ...selectedDepartments,
      ...((isOtherProfession || customDepartmentMode) && customDepartmentName ? [customDepartmentName] : []),
    ];
    return Array.from(new Set(departmentNames.map((name) => name.trim()).filter(Boolean)));
  };

  const validateStep1 = (): boolean => {
    const isSpOnboarding = onboardingRole === "service_provider";
    const isOtherProfession = selectedProfessionId === OTHER_VALUE;
    const hasProfession = isOtherProfession ? !!customProfession.trim() : !!selectedProfessionId;
    const hasDepartment = collectStep1DepartmentNames().length > 0;

    if (workspaceId == null) return false;
    if (!isSpOnboarding && (!hasProfession || !hasDepartment)) return false;
    if (isSpOnboarding && !hasDepartment) return false;
    return true;
  };

  // Persists profession + departments in a single batched request. Runs optimistically
  // in the background (see handleOnboardingNext); does not toggle onboardingSaving.
  const saveStep1 = async (): Promise<boolean> => {
    if (!validateStep1()) return false;

    const isSpOnboarding = onboardingRole === "service_provider";
    const isOtherProfession = selectedProfessionId === OTHER_VALUE;
    const uniqueDepartmentNames = collectStep1DepartmentNames();

    try {
      const headers = await headers_for_workspace_api();

      if (!isSpOnboarding) {
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
      }

      // Single batched call: create/restore all selected departments and link the
      // current user (workspace owner, or the onboarding service provider) at once.
      const deptRes = await fetch("/api/departments", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ names: uniqueDepartmentNames, link_self: true }),
      });
      if (!deptRes.ok) {
        const err = await deptRes.json().catch(() => ({}));
        throw new Error(err.error ?? "Failed to create departments");
      }

      if (isSpOnboarding) {
        await ensureSupabaseSessionOrThrow();
        await supabase.auth.updateUser({
          data: {
            pending_department_ids: null,
            pending_department_names: null,
          },
        });
        setSpDepartmentsLockedFromInvite(false);
      }

      if (!isSpOnboarding) {
        const professionName = isOtherProfession
          ? customProfession.trim()
          : professions.find((p) => p.id === Number(selectedProfessionId))?.name ?? "";
        setWorkspaceType(professionName);
      }
      await persistOnboardingStep(1);
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save");
      return false;
    }
  };

  const SP_DEFAULT_NOTIFICATIONS = {
    "sms-reminder": true,
    "email-reminder": true,
    "auto-confirm-booking": true,
    "post-meeting-follow-up": true,
    whatsapp: true,
    "whatsapp-user": true,
  } as const;

  const saveStep4 = async (): Promise<boolean> => {
    setOnboardingSaving(true);
    setError("");
    try {
      const headers = await headers_for_workspace_api();
      const meetingPayload = {
        in_person: meetingOptions.in_person,
        phone_call: meetingOptions.phone_call,
        google_meet: meetingOptions.google_meet,
      };

      if (onboardingRole === "service_provider") {
        const postRes = await fetch("/api/settings/provider-settings", {
          method: "POST",
          headers,
          body: JSON.stringify({
            notifications: { ...SP_DEFAULT_NOTIFICATIONS },
            meeting_options: meetingPayload,
          }),
        });
        if (!postRes.ok) {
          const err = await postRes.json().catch(() => ({}));
          throw new Error(err.error ?? "Failed to save meeting options");
        }
        return true;
      }

      const getRes = await fetch("/api/settings", {
        headers: { Authorization: headers.Authorization },
      });
      const existingSettings = getRes.ok ? (await getRes.json()).settings ?? {} : {};
      const merged = {
        ...existingSettings,
        meeting_options: meetingPayload,
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

  const advanceFromStep3 = async () => {
    setOnboardingSaving(true);
    try {
      await persistOnboardingStep(3);
      goToOnboardingStep(4);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save progress");
    } finally {
      setOnboardingSaving(false);
    }
  };

  const handleStep3SaveHours = async () => {
    setStep3SavingHours(true);
    try {
      const ok = (await timesheetRef.current?.saveChanges()) ?? false;
      setStep3SaveChoiceOpen(false);
      if (!ok) return; // the timesheet's feedback banner explains the failure
      await advanceFromStep3();
    } finally {
      setStep3SavingHours(false);
    }
  };

  const handleOnboardingNext = async () => {
    setError("");
    if (onboardingStep === 1) {
      // Optimistic: validate locally, kick off the single batched save in the
      // background, and advance immediately so the user doesn't wait. The promise
      // is awaited on step 2 (below) to surface any failure before dependent work.
      if (!validateStep1()) return;
      step1SavePromiseRef.current = saveStep1();
      goToOnboardingStep(2);
    } else if (onboardingStep === 2) {
      setOnboardingSaving(true);
      try {
        if (step1SavePromiseRef.current) {
          const step1Ok = await step1SavePromiseRef.current;
          if (!step1Ok) {
            goToOnboardingStep(1);
            return;
          }
        }
        if (onboardingRole === "service_provider") {
          const headers = await headers_for_workspace_api();
          await fetch("/api/settings/provider-settings", {
            method: "POST",
            headers,
            body: JSON.stringify({ init_defaults: true }),
          });
        }
        await persistOnboardingStep(2);
        goToOnboardingStep(3);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to save progress");
      } finally {
        setOnboardingSaving(false);
      }
    } else if (onboardingStep === 3) {
      if (!step3Saved) {
        // Offer to save the current hours or keep editing instead of blocking.
        setStep3SaveChoiceOpen(true);
        return;
      }
      await advanceFromStep3();
    } else if (onboardingStep === 4) {
      const ok = await saveStep4();
      if (!ok) return;
      try {
        await ensureSupabaseSessionOrThrow();
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to save progress");
        return;
      }
      if (onboardingRole === "service_provider") {
        try {
          const headers = await headers_for_workspace_api();
          const etRes = await fetch("/api/onboarding/service-provider-event-type", {
            method: "POST",
            headers,
          });
          if (!etRes.ok) {
            const err = await etRes.json().catch(() => ({}));
            throw new Error(
              (err as { error?: string }).error ?? "Failed to create your event type"
            );
          }
        } catch (e: unknown) {
          setError(e instanceof Error ? e.message : "Failed to create your event type");
          return;
        }
      }
      const { error: onboardErr } = await supabase.auth.updateUser({
        data: { onboarding_completed: true, onboarding_last_completed_step: 4 },
      });
      if (onboardErr) {
        setError(onboardErr.message || "Failed to finish setup");
        return;
      }
      if (onboardingRole === "service_provider") {
        clearInviteOnboardingContext();
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
    const isSpOnboardingUi = onboardingRole === "service_provider";
    const selectedProfessionName =
      selectedProfessionId === OTHER_VALUE
        ? customProfession.trim() || "Other"
        : professions.find((p) => p.id === Number(selectedProfessionId))?.name ?? "";
    const workspaceProfessionLabel =
      (workspaceType && workspaceType.trim()) ||
      selectedProfessionName ||
      "";
    const providerBookingPreviewUrl = build_service_provider_public_booking_url(
      workspaceSlug,
      providerLinkSlug
    );
    const onboardingNextDisabled =
      onboardingSaving ||
      (onboardingStep === 1 &&
        (isSpOnboardingUi
          ? providerLinkLoading ||
            !providerLinkSlug ||
            (selectedDepartments.length === 0 &&
              !(customDepartmentMode && customDepartment.trim()))
          : (selectedProfessionId === OTHER_VALUE ? !customProfession.trim() : !selectedProfessionId) ||
            (selectedProfessionId === OTHER_VALUE
              ? selectedDepartments.length === 0 && !customDepartment.trim()
              : selectedDepartments.length === 0)));

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 py-8">
        <div className="absolute top-0 left-0 w-full h-full bg-grid-pattern opacity-5" />
        <div className="w-full max-w-6xl px-6 relative z-10">
          <div className="text-center mb-6">
            <Link href="/" className="inline-block">
              <Image src="/getsettime-logo.svg" alt="GetSetTime Logo" width={200} height={50} className="mx-auto mb-4" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-800">
              {isSpOnboardingUi ? "Set up your profile" : "Set up your workspace"}
            </h1>
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

          {error && (
            <div className="mb-4">
              <AlertMessage type="error" message={error} />
            </div>
          )}

          {onboardingStep === 3 && timesheetSaveFeedback !== null && (
            <div className="mb-4">
              <AlertMessage
                type={timesheetSaveFeedback.type === "success" ? "success" : "error"}
                message={timesheetSaveFeedback.text}
              />
            </div>
          )}

          {onboardingStep === 3 && step3Saved && timesheetSaveFeedback === null && (
            <div className="mb-4">
              <AlertMessage
                type="success"
                message="Working hours saved. You can continue with Next."
              />
            </div>
          )}

          {onboardingStep === 3 && (
            <div className="mb-4 flex flex-col items-end gap-2">
              <button
                type="button"
                onClick={() => handleOnboardingNext()}
                disabled={onboardingNextDisabled}
                className="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {onboardingSaving ? "Saving…" : "Next"}
              </button>
            </div>
          )}

          {onboardingStep === 1 && (
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 space-y-8">
              {onboardingRole !== "service_provider" && (
              <div>
                <h2 className="text-lg font-semibold text-gray-800 mb-1">What is your profession?</h2>
                <p className="text-sm text-gray-500 mb-4">Select the option that best describes your work.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {professions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedProfessionId(String(p.id));
                        setCustomProfession("");
                        setSelectedDepartments([]);
                        setCustomDepartment("");
                        setCustomDepartmentMode(false);
                        scrollToDepartmentSection();
                      }}
                      className={`flex items-center gap-3 px-4 py-4 rounded-2xl border text-left transition ${
                        selectedProfessionId === String(p.id)
                          ? "border-violet-300 bg-violet-50 text-slate-900 shadow-sm"
                          : "border-gray-200 bg-white text-slate-900 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl text-slate-700">
                        {isCustomProfessionIcon(p.icon) ? (
                          <Image
                            src={p.icon}
                            alt={`${p.name} icon`}
                            width={24}
                            height={24}
                            className="h-6 w-6 object-contain"
                            unoptimized
                          />
                        ) : (() => {
                            const fallbackIcon = AppIcons[DEFAULT_PROFESSION_ICON_KEY];
                            const Icon =
                              (isLibraryProfessionIcon(p.icon)
                                ? AppIcons[p.icon]
                                : fallbackIcon) as IconComponent | undefined;
                            return Icon ? (
                              <Icon className="h-5 w-5 text-slate-600" />
                            ) : (
                              <span className="text-lg">💼</span>
                            );
                          })()}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-lg font-semibold leading-tight text-slate-900">{p.name}</span>
                        <span className="block text-sm text-slate-500">
                          {p.departments_count} department{p.departments_count === 1 ? "" : "s"}
                        </span>
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedProfessionId(OTHER_VALUE);
                      setSelectedDepartments([]);
                      setCustomDepartment("");
                      setCustomDepartmentMode(true);
                      scrollToDepartmentSection();
                    }}
                    className={`flex items-center gap-3 px-4 py-4 rounded-2xl border text-left transition ${
                      selectedProfessionId === OTHER_VALUE
                        ? "border-violet-300 bg-violet-50 text-slate-900 shadow-sm"
                        : "border-gray-200 bg-white text-slate-900 hover:border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl">
                      ✨
                    </span>
                    <span>
                      <span className="block text-lg font-semibold leading-tight text-slate-900">Other</span>
                      <span className="block text-sm text-slate-500">0 departments</span>
                    </span>
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
              )}

              {/* Department */}
              <div ref={departmentSectionRef} className="scroll-mt-6">
                <h2 className="text-lg font-semibold text-gray-800 mb-3">
                  {isSpOnboardingUi && spDepartmentsLockedFromInvite
                    ? "Your assigned departments"
                    : isSpOnboardingUi
                      ? "Add your department"
                      : "Department Suggestions"}
                </h2>
                {isSpOnboardingUi && spDepartmentsLockedFromInvite && (
                  <p className="mb-3 text-sm text-slate-600">
                    These departments were chosen by your workspace admin. Review and click Next to
                    continue setup.
                  </p>
                )}
                {isSpOnboardingUi && workspaceProfessionLabel && (
                  <div className="mb-4 flex justify-end">
                    <span className="inline-flex items-center rounded-full bg-violet-100 px-3 py-1 text-sm font-medium text-violet-700">
                      Profession: {workspaceProfessionLabel}
                    </span>
                  </div>
                )}
                {!isSpOnboardingUi && !!selectedProfessionName && selectedProfessionId !== OTHER_VALUE && (
                  <div className="mb-4 flex justify-end">
                    <span className="inline-flex items-center rounded-full bg-violet-100 px-3 py-1 text-sm font-medium text-violet-700">
                      {selectedProfessionName}
                    </span>
                  </div>
                )}
                <div className="rounded-3xl border border-violet-200 bg-white p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-sm font-semibold tracking-[0.2em] text-violet-700 uppercase">Selected Departments</h3>
                    <span className="inline-flex items-center rounded-full bg-violet-100 px-3 py-1 text-sm font-medium text-violet-700">
                      {selectedDepartments.length} selected
                    </span>
                  </div>
                  <div className="mb-6 flex flex-wrap gap-2">
                    {selectedDepartments.length > 0 ? (
                      selectedDepartments.map((name) => (
                        <span key={name} className="inline-flex items-center gap-2 rounded-full bg-violet-600 px-4 py-2 text-sm font-medium text-white">
                          {name}
                          {!spDepartmentsLockedFromInvite && (
                            <button
                              type="button"
                              onClick={() =>
                                setSelectedDepartments((prev) => prev.filter((dept) => dept !== name))
                              }
                              className="rounded-full bg-violet-500 px-2 py-0.5 text-xs font-semibold hover:bg-violet-400"
                            >
                              Remove
                            </button>
                          )}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No department selected yet.</p>
                    )}
                  </div>

                  {!(isSpOnboardingUi && spDepartmentsLockedFromInvite) &&
                    selectedProfessionId &&
                    selectedProfessionId !== OTHER_VALUE &&
                    departmentSuggestions.length > 0 && (
                    <div className="mb-6 flex flex-wrap gap-3">
                      {departmentSuggestions.map((name) => {
                        const isSelected = selectedDepartments.includes(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              setSelectedDepartments((prev) =>
                                prev.includes(name)
                                  ? prev.filter((dept) => dept !== name)
                                  : [...prev, name]
                              );
                              if (!isSelected) scrollToNextButton();
                            }}
                            className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 text-base font-medium transition ${
                              isSelected
                                ? "border-violet-500 bg-violet-50 text-violet-700"
                                : "border-slate-300 bg-white text-slate-700 hover:border-violet-300"
                            }`}
                          >
                            {name}
                            <span className="text-lg leading-none">{isSelected ? "−" : "+"}</span>
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => setCustomDepartmentMode((prev) => !prev)}
                        className={`inline-flex items-center gap-2 rounded-full border px-5 py-2 text-base font-medium transition ${
                          customDepartmentMode
                            ? "border-violet-500 bg-violet-50 text-violet-700"
                            : "border-slate-300 bg-white text-slate-700 hover:border-violet-300"
                        }`}
                      >
                        Other
                        <span className="text-lg leading-none">{customDepartmentMode ? "−" : "+"}</span>
                      </button>
                    </div>
                    )}

                  {!(isSpOnboardingUi && spDepartmentsLockedFromInvite) &&
                    (selectedProfessionId === OTHER_VALUE || customDepartmentMode) && (
                    <div className="rounded-2xl border border-dashed border-violet-200 p-4">
                      <p className="mb-3 text-lg text-slate-700">Add custom department</p>
                      <div className="flex flex-col gap-3 sm:flex-row">
                        <input
                          type="text"
                          placeholder="e.g. Support, Accounts"
                          className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-base focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                          value={customDepartment}
                          onChange={(e) => setCustomDepartment(e.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            const value = customDepartment.trim();
                            if (!value) return;
                            setSelectedDepartments((prev) => {
                              if (prev.some((name) => name.toLowerCase() === value.toLowerCase())) return prev;
                              return [...prev, value];
                            });
                            setCustomDepartment("");
                            scrollToNextButton();
                          }}
                          className="rounded-2xl bg-violet-600 px-6 py-3 text-white font-semibold hover:bg-violet-700 transition"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {isSpOnboardingUi && (
                <div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-1">
                    Your booking link
                  </h2>
                  <p className="text-sm text-gray-500 mb-4">
                    This is your public link for client bookings. You can change it later in
                    Settings.
                  </p>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    {providerLinkLoading ? (
                      <p className="text-sm text-slate-500">Creating your booking link…</p>
                    ) : providerLinkError ? (
                      <p className="text-sm font-medium text-red-600">{providerLinkError}</p>
                    ) : providerBookingPreviewUrl ? (
                      <p
                        className="break-all text-sm font-medium text-slate-700 select-none pointer-events-none"
                        aria-readonly="true"
                      >
                        {providerBookingPreviewUrl}
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500">
                        Your booking link will appear here once it is ready.
                      </p>
                    )}
                  </div>
                </div>
              )}
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
                        const returnTo = "/register?onboarding=1&step=2";
                        const { data: { session } } = await supabase.auth.getSession();
                        const token = session?.access_token;
                        const connectUrl = `/api/integrations/google/connect?returnTo=${encodeURIComponent(returnTo)}`;
                        const res = await fetch(connectUrl, {
                          headers: token ? { Authorization: `Bearer ${token}` } : {},
                        });
                        if (res.ok) {
                          const data = await res.json();
                          if (data.authUrl) {
                            window.location.href = data.authUrl;
                            return;
                          }
                          setError("No auth URL received");
                          setCalendarConnecting(false);
                          return;
                        }
                        const fallback = await fetch("/api/auth/google", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            enableCalendarSync: true,
                            isSignup: false,
                            returnTo,
                          }),
                        });
                        const data = await fallback.json();
                        if (!fallback.ok) {
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
                ref={timesheetRef}
                providerUserId={isSpOnboardingUi ? onboardingProviderUserId ?? undefined : undefined}
                onSave={() => {
                  setStep3Saved(true);
                  setError("");
                }}
                onSaveFeedback={setTimesheetSaveFeedback}
              />
            </div>
          )}

          {onboardingStep === 4 && (
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100 space-y-6">
              <h2 className="text-lg font-semibold text-gray-800">Meeting Options</h2>
              <p className="text-sm text-gray-600">Choose how clients can meet with you.</p>
              <div className="space-y-3">
                {[
                  { key: "in_person" as const, label: "In-person" },
                  { key: "phone_call" as const, label: "Phone call" },
                  { key: "google_meet" as const, label: "Google Meet" },
                  // { key: "whatsapp" as const, label: "Whatsapp Notification" },
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
                ref={nextButtonRef}
                type="button"
                onClick={() => handleOnboardingNext()}
                disabled={onboardingNextDisabled}
                className="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {onboardingSaving ? "Saving…" : onboardingStep === 4 ? "Finish" : "Next"}
              </button>
            </div>
          </div>

          {step3SaveChoiceOpen && (
            <ConfirmModal
              title="Save working hours?"
              message="Your working hours haven't been saved yet. Save them now and continue, or go back to modify them first."
              confirmLabel="Save hours"
              cancelLabel="Modify hours"
              variant="primary"
              loading={step3SavingHours}
              onConfirm={() => void handleStep3SaveHours()}
              onCancel={() => setStep3SaveChoiceOpen(false)}
            />
          )}
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
