"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import type { SVGProps } from "react";
import {
  FcFeedback,
  FcClock,
  FcPhone,
  FcOk,
  FcSettings,
  FcAutomotive,
  FcBusinessman,
  FcBusinesswoman,
} from "react-icons/fc";
import { FaWhatsapp } from "react-icons/fa";
import type { IconType } from "react-icons";
import { useAuth } from "@/src/providers/AuthProvider";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";
import { sync_settings_response } from "@/src/lib/workspace_shell_sync";
import type { WorkspaceSettings } from "@/src/types/workspace";
import { ConfirmModal } from "@/src/components/ui/ConfirmModal";
import { RequestIntegrationModal } from "@/src/components/ui/RequestIntegrationModal";
import { UpgradePlanModal } from "@/src/components/Subscription/UpgradePlanModal";
import { useSubscription } from "@/src/hooks/useSubscription";
import DashboardIcon from "@/src/components/Dashboard/DashboardIcon";

type NotificationChannel = "Email" | "SMS" | "WhatsApp" | "System";

type LayoutIconName =
  | "plug"
  | "calendar"
  | "video"
  | "check"
  | "refresh"
  | "link"
  | "unplug"
  | "shield"
  | "bell"
  | "sparkles"
  | "zap"
  | "messageSquare"
  | "mail"
  | "smartphone"
  | "messageCircle"
  | "clock"
  | "users";

interface IntegrationStatus {
  google_calendar: boolean;
  zoom: boolean;
  google_calendar_email?: string;
}

interface Workflow {
  id: number;
  name: string;
  description: string;
  active: boolean;
  iconIndex?: number;
  settingsKey?: string;
}

const WORKFLOW_DEFINITIONS = [
  {
    settingsKey: "email-reminder",
    name: "24h reminder email",
    description: "Reminder email sent 24 hours before meeting",
    iconIndex: 0,
  },
  {
    settingsKey: "sms-reminder",
    name: "SMS 1h before",
    description: "SMS notification 1 hour prior",
    iconIndex: 1,
  },
  {
    settingsKey: "post-meeting-follow-up",
    name: "Post-meeting follow-up",
    description: "Send thank you email after meeting",
    iconIndex: 2,
  },
  {
    settingsKey: "auto-confirm-booking",
    name: "Auto-confirm bookings",
    description: "Automatically confirm new bookings without manual approval",
    iconIndex: 3,
  },
  {
    settingsKey: "whatsapp",
    name: "Whatsapp Notification to Admin",
    description: "Send booking alerts and updates to admin numbers on WhatsApp",
    iconIndex: 8,
  },
  {
    settingsKey: "whatsapp-user",
    name: "Whatsapp Notification to User",
    description: "Send booking confirmations, reminders, and related messages to invitees on WhatsApp",
    iconIndex: 8,
  },
] as const;

const WORKFLOW_META: Record<string, { channel: NotificationChannel; timing: string; audience: string }> = {
  "email-reminder": { channel: "Email", timing: "24 hours before", audience: "Customer" },
  "sms-reminder": { channel: "SMS", timing: "1 hour before", audience: "Customer" },
  "post-meeting-follow-up": { channel: "Email", timing: "After meeting", audience: "Customer" },
  "auto-confirm-booking": { channel: "System", timing: "Instant", audience: "Admin + Customer" },
  whatsapp: { channel: "WhatsApp", timing: "Instant", audience: "Admin" },
  "whatsapp-user": { channel: "WhatsApp", timing: "Instant", audience: "Customer" },
};

const CHANNEL_META: Record<NotificationChannel, { className: string }> = {
  Email: { className: "bg-blue-50 text-blue-700 ring-blue-100" },
  SMS: { className: "bg-cyan-50 text-cyan-700 ring-cyan-100" },
  WhatsApp: { className: "bg-emerald-50 text-emerald-700 ring-emerald-100" },
  System: { className: "bg-violet-50 text-violet-700 ring-violet-100" },
};

function workflowInitialActive(
  def: (typeof WORKFLOW_DEFINITIONS)[number],
  notificationSettings: Record<string, boolean | undefined>,
): boolean {
  if (def.settingsKey === "whatsapp-user") {
    return notificationSettings["whatsapp-user"] ?? notificationSettings.whatsapp ?? true;
  }
  return notificationSettings[def.settingsKey] ?? true;
}

function LayoutIcon({
  name,
  size = 20,
  className = "",
  ...props
}: SVGProps<SVGSVGElement> & { name: LayoutIconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    ...props,
  };

  const icons: Record<LayoutIconName, React.JSX.Element> = {
    plug: (
      <svg {...common}>
        <path d="M12 22v-5" />
        <path d="M9 8V2" />
        <path d="M15 8V2" />
        <path d="M6 8h12v4a6 6 0 0 1-12 0Z" />
      </svg>
    ),
    calendar: (
      <svg {...common}>
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <rect x="3" y="4" width="18" height="18" rx="4" />
        <path d="M3 10h18" />
      </svg>
    ),
    video: (
      <svg {...common}>
        <rect x="3" y="6" width="13" height="12" rx="3" />
        <path d="m16 10 5-3v10l-5-3" />
      </svg>
    ),
    check: (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </svg>
    ),
    refresh: (
      <svg {...common}>
        <path d="M20 12a8 8 0 0 0-14-5" />
        <path d="M4 4v5h5" />
        <path d="M4 12a8 8 0 0 0 14 5" />
        <path d="M20 20v-5h-5" />
      </svg>
    ),
    link: (
      <svg {...common}>
        <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
        <path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1" />
      </svg>
    ),
    unplug: (
      <svg {...common}>
        <path d="m19 5-3 3" />
        <path d="m5 19 3-3" />
        <path d="M6 6 18 18" />
        <path d="M8 2v4" />
        <path d="M16 2v4" />
        <path d="M9 9v3a3 3 0 0 0 3 3" />
      </svg>
    ),
    shield: (
      <svg {...common}>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
        <path d="m9 12 2 2 4-5" />
      </svg>
    ),
    bell: (
      <svg {...common}>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    sparkles: (
      <svg {...common}>
        <path d="M12 3 9.5 8.5 4 11l5.5 2.5L12 19l2.5-5.5L20 11l-5.5-2.5Z" />
        <path d="M19 3v4" />
        <path d="M21 5h-4" />
      </svg>
    ),
    zap: (
      <svg {...common}>
        <path d="M13 2 3 14h8l-1 8 11-14h-8Z" />
      </svg>
    ),
    messageSquare: (
      <svg {...common}>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
      </svg>
    ),
    mail: (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
    ),
    smartphone: (
      <svg {...common}>
        <rect x="7" y="2" width="10" height="20" rx="2" />
        <path d="M11 18h2" />
      </svg>
    ),
    messageCircle: (
      <svg {...common}>
        <path d="M21 11.5a8.4 8.4 0 0 1-12.2 7.4L3 21l2.1-5.5A8.4 8.4 0 1 1 21 11.5Z" />
        <path d="M8 12h.01M12 12h.01M16 12h.01" />
      </svg>
    ),
    clock: (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
    users: (
      <svg {...common}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.9" />
        <path d="M16 3.1a4 4 0 0 1 0 7.8" />
      </svg>
    ),
  };

  return icons[name];
}

function PanelHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-600">{eyebrow}</p>
      <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

const INTEGRATION_BRAND_ICONS: Record<"google_calendar" | "zoom", { src: string; alt: string }> = {
  google_calendar: { src: "/integrations/google-calendar.png", alt: "Google Calendar" },
  zoom: { src: "/integrations/zoom.png", alt: "Zoom" },
};

function IntegrationBrandIcon({
  id,
  className = "h-8 w-8 min-[1350px]:h-10 min-[1350px]:w-10",
}: {
  id: "google_calendar" | "zoom";
  className?: string;
}) {
  const { src, alt } = INTEGRATION_BRAND_ICONS[id];
  return (
    <Image
      src={src}
      alt={alt}
      width={40}
      height={40}
      className={`object-contain ${className}`}
    />
  );
}

function StatCard({
  icon,
  label,
  value,
  helper,
  valueClassName,
  iconClassName,
}: {
  icon: LayoutIconName;
  label: string;
  value: string;
  helper: string;
  valueClassName?: string;
  iconClassName?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm transition hover:border-slate-300">
      <div className="flex items-top gap-3">
        <div
          className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-xl ring-1 ${iconClassName ?? ""}`}
        >
          <LayoutIcon name={icon} size={28} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-slate-500">{label}</p>
          <p className={`mt-0.5 text-2xl font-bold leading-none py-2 text-slate-950 ${valueClassName ?? ""}`}>{value}</p>
          <p className="mt-1 truncate text-xs font-medium text-slate-400">{helper}</p>
        </div>
        <div className="text-slate-400" aria-hidden>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="stroke-current"
          >
            <path d="M9 6 15 12 9 18" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function InfoPill({ icon, label }: { icon: LayoutIconName; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
      <LayoutIcon name={icon} size={14} className="shrink-0 text-slate-400" />
      <span className="truncate">{label}</span>
    </div>
  );
}

function ChannelTypeIcon({
  channel,
  variant = "flow",
}: {
  channel: NotificationChannel;
  variant?: "flow" | "channel";
}) {
  if (channel === "WhatsApp") {
    return <DashboardIcon name="whatsapp" size={20} />;
  }

  const map: Record<Exclude<NotificationChannel, "WhatsApp">, LayoutIconName> = {
    Email: "mail",
    SMS: variant === "channel" ? "messageCircle" : "smartphone",
    System: "shield",
  };
  return <LayoutIcon name={map[channel]} size={20} />;
}

function ChannelBlock({ channel }: { channel: NotificationChannel }) {
  const chMeta = CHANNEL_META[channel];
  return (
    <div className="flex h-full w-[8.5rem] shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-2">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${chMeta.className}`}
      >
        <ChannelTypeIcon channel={channel} variant="channel" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight text-slate-900">{channel}</p>
        <p className="text-[10px] leading-tight text-slate-400">Channel</p>
      </div>
    </div>
  );
}

interface IntegrationPrerequisiteContext {
  businessPhone: string;
}

interface IntegrationPrerequisiteResult {
  ok: boolean;
  title?: string;
  message?: string;
  /** Optional anchor on the /settings page to scroll/focus when redirecting. */
  settingsHash?: string;
}

function hasConfiguredBusinessPhone(businessPhone: string): boolean {
  const trimmed = (businessPhone ?? "").trim();
  return trimmed.length > 0 && /\d/.test(trimmed);
}

/**
 * Pre-enable validation for integrations / notification workflows, keyed by the
 * workflow `settingsKey`. Returns `ok: false` with modal content when a prerequisite
 * is missing. Extend the switch to add future checks (e.g. SMS sender, Google Calendar
 * sync, payment gateway, email sender) without changing the toggle/save flow.
 */
function validateIntegrationPrerequisites(
  type: string,
  ctx: IntegrationPrerequisiteContext,
): IntegrationPrerequisiteResult {
  switch (type) {
    case "whatsapp": // WhatsApp notifications to Admin
      if (!hasConfiguredBusinessPhone(ctx.businessPhone)) {
        return {
          ok: false,
          title: "Business Phone Number Required",
          message:
            "Please add a business phone number in Settings before enabling WhatsApp notifications to admin.",
          settingsHash: "business-phone",
        };
      }
      return { ok: true };
    default:
      return { ok: true };
  }
}

/**
 * Builds the workflow list from saved settings, forcing a workflow OFF when its
 * prerequisites are not met (e.g. WhatsApp-to-admin without a business phone) so a
 * default-on workflow never appears enabled while its requirement is missing.
 */
function buildWorkflowFlows(
  notificationSettings: Record<string, boolean | undefined>,
  businessPhone: string,
): Workflow[] {
  return WORKFLOW_DEFINITIONS.map((def, index) => {
    let active = workflowInitialActive(def, notificationSettings);
    if (
      active &&
      def.settingsKey &&
      !validateIntegrationPrerequisites(def.settingsKey, { businessPhone }).ok
    ) {
      active = false;
    }
    return {
      id: index + 1,
      name: def.name,
      description: def.description,
      active,
      iconIndex: def.iconIndex,
      settingsKey: def.settingsKey,
    };
  });
}

export function IntegrationsNotificationsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { settings, loading: settingsLoading } = useWorkspaceSettings();

  const [integrations, setIntegrations] = useState<IntegrationStatus>({
    google_calendar: false,
    zoom: false,
  });
  const [integrationsLoading, setIntegrationsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [disconnectConfirm, setDisconnectConfirm] = useState<"google_calendar" | "zoom" | null>(null);
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  const [flows, setFlows] = useState<Workflow[]>([]);
  const [workflowsLoading, setWorkflowsLoading] = useState(true);
  const [businessPhone, setBusinessPhone] = useState("");
  const [prereqModal, setPrereqModal] = useState<{
    title: string;
    message: string;
    settingsHash?: string;
  } | null>(null);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [upgradeModalMessage, setUpgradeModalMessage] = useState(
    "Available on paid plans. Upgrade to continue."
  );
  const { data: subscription } = useSubscription(Boolean(user));

  const fetchIntegrations = async () => {
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch("/api/integrations/status", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const data = await response.json();
        setIntegrations({
          google_calendar: false,
          zoom: false,
          ...data.integrations,
        });
      }
    } catch (error) {
      console.error("Failed to fetch integrations:", error);
    } finally {
      setIntegrationsLoading(false);
    }
  };

  useEffect(() => {
    fetchIntegrations();

    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const errorMessage = searchParams.get("message");

    if (success) {
      setMessage({ type: "success", text: getSuccessMessage(success) });
      fetchIntegrations();
    } else if (error) {
      const msg = errorMessage
        ? `${getErrorMessage(error)}: ${decodeURIComponent(errorMessage)}`
        : getErrorMessage(error);
      setMessage({ type: "error", text: msg });
    }
  }, [searchParams]);

  useEffect(() => {
    if (!user) {
      setWorkflowsLoading(false);
      return;
    }
    if (settingsLoading) return;

    try {
      const general = (settings?.general || {}) as Record<string, unknown>;
      const generalPhone = typeof general.business_phone === "string" ? general.business_phone : "";
      setBusinessPhone(generalPhone);
      const notificationSettings = (settings?.notifications || {}) as Record<string, boolean | undefined>;
      setFlows(buildWorkflowFlows(notificationSettings, generalPhone));
    } catch (error) {
      console.error("Error loading notification settings:", error);
      setFlows(buildWorkflowFlows({}, ""));
    } finally {
      setWorkflowsLoading(false);
    }
  }, [user, settings, settingsLoading]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace("#", "");
    if (hash === "workspace-notifications") {
      requestAnimationFrame(() => {
        document.getElementById("workspace-notifications")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [workflowsLoading]);

  const saveNotificationSettings = async (updatedFlows: Workflow[]) => {
    if (!user) return;

    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) return;

      const notificationSettings: Record<string, boolean> = {};
      updatedFlows.forEach((flow) => {
        if (flow.settingsKey) {
          notificationSettings[flow.settingsKey] = flow.active;
        }
      });

      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          settings: { notifications: notificationSettings },
        }),
      });

      const result = await response.json().catch(() => ({})) as {
        error?: string;
        upgradeRequired?: boolean;
        settings?: WorkspaceSettings | null;
      };

      if (!response.ok) {
        if (result.upgradeRequired) {
          setUpgradeModalMessage(
            result.error || "Available on paid plans. Upgrade to continue."
          );
          setUpgradeModalOpen(true);
          return false;
        }
        throw new Error(result.error || "Failed to save notification settings");
      }
      if (user.id && result.settings) sync_settings_response(user.id, result);
      return true;
    } catch (error) {
      console.error("Error saving notification settings:", error);
      return false;
    }
  };

  const toggleFlow = async (id: number) => {
    const target = flows.find((f) => f.id === id);
    if (!target) return;

    // Pre-validation: block enabling a workflow when its prerequisites are missing.
    const willEnable = !target.active;
    if (willEnable && target.settingsKey) {
      const prereq = validateIntegrationPrerequisites(target.settingsKey, { businessPhone });
      if (!prereq.ok) {
        setPrereqModal({
          title: prereq.title ?? "Action Required",
          message: prereq.message ?? "A prerequisite is missing.",
          settingsHash: prereq.settingsHash,
        });
        return;
      }
    }

    const previousFlows = flows;
    const updatedFlows = flows.map((f) => (f.id === id ? { ...f, active: !f.active } : f));
    setFlows(updatedFlows);
    const saved = await saveNotificationSettings(updatedFlows);
    if (!saved) {
      setFlows(previousFlows);
    }
  };

  const workflowIcons: IconType[] = [
    FcFeedback,
    FcClock,
    FcPhone,
    FcOk,
    FcSettings,
    FcAutomotive,
    FcBusinessman,
    FcBusinesswoman,
    FaWhatsapp,
  ];

  const getWorkflowIcon = (flow: Workflow): IconType => {
    const iconIndex = flow.iconIndex ?? ((flow.id - 1) % workflowIcons.length);
    return workflowIcons[iconIndex] ?? FcAutomotive;
  };

  const handleConnect = async (type: "google" | "zoom") => {
    setActionLoading(type);
    setMessage(null);
    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`/api/integrations/${type}/connect`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (response.ok) {
        const data = await response.json();
        if (data.authUrl) {
          window.location.href = data.authUrl;
        } else if (data.success) {
          setMessage({ type: "success", text: `${type} connected successfully!` });
          await fetchIntegrations();
        } else {
          setMessage({ type: "error", text: "Failed to get authorization URL" });
        }
      } else {
        const error = await response.json();
        setMessage({ type: "error", text: error.error || "Failed to connect" });
      }
    } catch (error: unknown) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to connect",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnectClick = (type: "google_calendar" | "zoom") => {
    setDisconnectConfirm(type);
  };

  const handleDisconnectConfirm = async () => {
    if (!disconnectConfirm) return;

    const type = disconnectConfirm;
    setActionLoading(type);
    setMessage(null);
    setDisconnectConfirm(null);

    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch("/api/integrations/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ type }),
      });

      if (response.ok) {
        setMessage({ type: "success", text: `${type} disconnected successfully` });
        await fetchIntegrations();
      } else {
        const error = await response.json();
        setMessage({ type: "error", text: error.error || "Failed to disconnect" });
      }
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to disconnect",
      });
    } finally {
      setActionLoading(null);
    }
  };

  const getSuccessMessage = (success: string) => {
    const messages: Record<string, string> = {
      google_connected: "Google Calendar connected successfully!",
      zoom_connected: "Zoom connected successfully!",
    };
    return messages[success] || "Connection successful!";
  };

  const getErrorMessage = (error: string) => {
    const messages: Record<string, string> = {
      missing_params: "Missing required parameters",
      no_token: "Failed to get access token",
      save_failed: "Failed to save integration",
      callback_failed: "OAuth callback failed",
      config_missing: "Integration not configured",
      no_workspace: "No workspace found. Please complete onboarding first.",
      unauthorized: "Unauthorized. Please log in and try again.",
      oauth_error: "OAuth authorization error. Please check your Google Cloud Console settings.",
      redirect_uri_mismatch:
        "Redirect URI mismatch. Please ensure the redirect URI in Google Cloud Console matches your application URL.",
    };
    return messages[error] || "An error occurred";
  };

  const items = useMemo(
    () =>
      [
        {
          id: "google_calendar" as const,
          name: "Google Calendar & Meet",
          desc: "Sync bookings, avoid double booking, and manage availability in real time.",
          category: "Calendar",
          icon: "calendar" as const,
          connected: integrations.google_calendar,
          connectType: "google" as const,
          comingSoon: false,
        },
        {
          id: "zoom" as const,
          name: "Zoom Information",
          desc: "Includes Zoom details in your Getsettime App",
          category: "Video Meeting",
          icon: "video" as const,
          connected: integrations.zoom,
          connectType: "zoom" as const,
          comingSoon: true,
        },
      ],
    [integrations.google_calendar, integrations.zoom],
  );

  const totalCount = items.length;
  const connectedCount = items.filter((i) => i.connected).length;

  const stats = useMemo(() => {
    const activeRules = flows.filter((f) => f.active).length;
    const channels = new Set(
      flows.map((f) => (f.settingsKey ? WORKFLOW_META[f.settingsKey]?.channel : "Email") as NotificationChannel),
    ).size;
    const healthOk = !integrationsLoading && !workflowsLoading && connectedCount > 0 && activeRules > 0;
    return {
      connected: connectedCount,
      totalIntegrations: totalCount,
      activeRules,
      totalRules: flows.length,
      channels,
      healthLabel: healthOk ? "Good" : "Setup",
      healthHint: healthOk ? "All core workflows ready" : "Connect apps and enable workflows",
      healthClass: healthOk ? "text-emerald-600" : "text-amber-600",
    };
  }, [flows, connectedCount, totalCount, integrationsLoading, workflowsLoading]);

  return (
    <main className="min-h-screen text-slate-950">
      <section className="mx-auto space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm md:px-6">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
              <LayoutIcon name="zap" size={45} />
            </div>
            <div className="min-w-0">
              <h1 className="text-[30px] font-bold leading-tight tracking-tight text-slate-900 md:text-[30px]">
                Integrations &amp; Notifications
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Connect your favorite tools and automate communication across your workflows.<br></br>
                Stay organized, save time, and never miss a step.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon="calendar"
            iconClassName="bg-violet-50 text-violet-600 ring-violet-100"
            label="Connected Apps"
            value={
              integrationsLoading ? "—" : `${stats.connected}/${stats.totalIntegrations}`
            }
            helper={`${stats.connected} app connected`}
          />
          <StatCard
            icon="zap"
            iconClassName="bg-emerald-50 text-emerald-600 ring-emerald-100"
            label="Active Automations"
            value={workflowsLoading ? "—" : String(stats.activeRules)}
            helper={`${stats.totalRules} total rules configured`}
          />
          <StatCard
            icon="messageSquare"
            iconClassName="bg-blue-50 text-blue-600 ring-blue-100"
            label="Channels"
            value={workflowsLoading ? "—" : String(stats.channels)}
            helper="Email, SMS, WhatsApp, System"
          />
          <StatCard
            icon="shield"
            iconClassName="bg-emerald-50 text-emerald-600 ring-emerald-100"
            label="System Health"
            value={integrationsLoading || workflowsLoading ? "—" : stats.healthLabel}
            helper={stats.healthHint}
            valueClassName={stats.healthClass}
          />
        </div>

        {message && (
          <div
            className={`rounded-[1.25rem] border px-4 py-3 text-sm font-semibold shadow-sm ${
              message.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.95fr)] lg:items-start lg:max-[1349px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1.7fr)]">
          <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Connected Apps</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Manage calendar, video meeting, and communication apps.
                </p>
              </div>
              {/* <button
                type="button"
                onClick={() => setRequestModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                <span className="text-sm leading-none">+</span> Add App
              </button> */}
            </div>

            {integrationsLoading ? (
              <div className="space-y-3">
                <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-44 animate-pulse rounded-2xl bg-slate-100" />
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <p className="text-lg font-bold text-slate-950">No integrations found</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {items.map((it) => {
                  const connected = it.connected;
                  const comingSoon = it.comingSoon;
                  const selected = selectedIntegrationId === it.id;
                  return (
                    <article
                      key={it.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedIntegrationId(it.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedIntegrationId(it.id);
                        }
                      }}
                      className={`cursor-pointer rounded-xl border bg-white p-3 transition min-[1350px]:p-4 ${
                        selected ? "border-blue-200 ring-2 ring-blue-50" : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start gap-3 min-[1350px]:gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white min-[1350px]:h-16 min-[1350px]:w-16">
                          {it.id === "google_calendar" || it.id === "zoom" ? (
                            <IntegrationBrandIcon id={it.id} />
                          ) : (
                            <LayoutIcon name="calendar" size={20} className="min-[1350px]:!h-6 min-[1350px]:!w-6" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 min-[1350px]:gap-2">
                            <h3 className="truncate text-sm font-semibold leading-tight text-slate-900 min-[1350px]:text-base">
                              {it.name}
                            </h3>
                            <span
                              className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold min-[1350px]:text-[10px] ${
                                comingSoon
                                  ? "bg-amber-50 text-amber-700"
                                  : connected
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {comingSoon ? "Coming Soon" : connected ? "Connected" : "Not connected"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <p className="mt-2 text-xs leading-5 break-words text-slate-500 min-[1350px]:mt-1 min-[1350px]:text-sm">
                        {it.desc}
                      </p>

                      <div className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] text-slate-500 min-[1350px]:mt-3 min-[1350px]:px-3 min-[1350px]:py-2.5 min-[1350px]:text-xs">
                        {connected && it.id === "google_calendar" && integrations.google_calendar_email ? (
                          <span className="block truncate font-medium text-slate-700">
                            {integrations.google_calendar_email}
                          </span>
                        ) : connected ? (
                          <span className="font-medium text-slate-600">Account linked</span>
                        ) : (
                          <span className="font-medium text-slate-600">Connect account to enable sync</span>
                        )}
                        <span className="mt-1 flex items-center gap-1.5 text-slate-500">
                          <span
                            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                              connected ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                            aria-hidden
                          />
                          {connected ? "Status: ready for bookings" : "Not synced"}
                        </span>
                      </div>

                      <div className="mt-2 flex items-stretch gap-2 min-[1350px]:mt-3">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (comingSoon) return;
                            if (connected) handleDisconnectClick(it.id);
                            else void handleConnect(it.connectType);
                          }}
                          disabled={comingSoon || actionLoading !== null}
                          aria-disabled={comingSoon || actionLoading !== null}
                          title={comingSoon ? "Coming soon" : undefined}
                          className={`w-full rounded-lg px-2 py-1.5 text-center text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 min-[1350px]:py-2 min-[1350px]:text-sm ${
                            connected
                              ? "border border-slate-200 text-slate-700 hover:bg-slate-50"
                              : "bg-blue-600 text-white hover:bg-blue-700"
                          }`}
                        >
                              {comingSoon
                                ? "Coming Soon"
                                : actionLoading === it.id || actionLoading === it.connectType
                                  ? "Loading..."
                                  : connected
                                    ? "Disconnect"
                                    : "Connect"}
                            </button>
                          </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>

          <section id="workspace-notifications" className="min-w-0 scroll-mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Notification Automations</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Automate reminders, confirmations, follow-ups, and internal alerts.
                </p>
              </div>
              {/* <button
                type="button"
                onClick={() => setRequestModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                <span className="text-sm leading-none">+</span> New Rule
              </button> */}
            </div>

            {workflowsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-20 animate-pulse rounded-xl bg-slate-100" />
                ))}
              </div>
            ) : (
              <div className="space-y-2.5">
                {flows.map((flow) => {
                  const meta = flow.settingsKey ? WORKFLOW_META[flow.settingsKey] : null;
                  const channel = meta?.channel ?? "Email";
                  const chMeta = CHANNEL_META[channel];
                  return (
                    <div
                      key={flow.id}
                      className="grid grid-cols-1 items-stretch gap-2 md:grid-cols-[minmax(0,1fr)_8.5rem]"
                    >
                      <article className="grid min-w-0 grid-cols-[minmax(0,1fr)_3rem] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 transition hover:border-slate-300 min-[1350px]:grid-cols-[minmax(0,1fr)_auto_auto_3rem]">
                        <div className="flex min-w-0 items-start gap-3">
                          <div
                            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1 ${chMeta.className}`}
                          >
                            <ChannelTypeIcon channel={channel} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="text-[15px] font-semibold text-slate-900">{flow.name}</h3>
                              <span
                                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  flow.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {flow.active ? "Active" : "Inactive"}
                              </span>
                            </div>
                            <p className="mt-0.5 text-xs leading-5 break-words text-slate-500">{flow.description}</p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 max-md:hidden min-[1350px]:hidden">
                              <span className="w-fit shrink-0 whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-1 text-[11px] font-medium leading-tight text-slate-500">
                                {meta?.timing ?? "Instant"}
                              </span>
                              <span className="inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-1 text-[11px] font-medium leading-tight text-slate-500">
                                <LayoutIcon name="users" size={14} className="shrink-0 text-slate-400" />
                                {meta?.audience ?? "Customer"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className="hidden w-fit shrink-0 whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-1 text-[11px] font-medium leading-tight text-slate-500 min-[1350px]:inline-block">
                          {meta?.timing ?? "Instant"}
                        </span>
                        <span className="hidden w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-slate-100 px-1.5 py-1 text-[11px] font-medium leading-tight text-slate-500 min-[1350px]:inline-flex">
                          <LayoutIcon name="users" size={14} className="shrink-0 text-slate-400" />
                          {meta?.audience ?? "Customer"}
                        </span>

                        <div className="flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => void toggleFlow(flow.id)}
                            className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                              flow.active ? "bg-emerald-500" : "bg-slate-300"
                            }`}
                            aria-label={flow.active ? "Disable workflow" : "Enable workflow"}
                          >
                            <span
                              className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${
                                flow.active ? "left-6" : "left-1"
                              }`}
                            />
                          </button>
                        </div>
                      </article>

                      <div className="max-md:hidden">
                        <ChannelBlock channel={channel} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div
          id="workspace-request-integration"
          className="scroll-mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 shadow-sm md:p-5"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-15 w-15 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-indigo-500 shadow-sm">
                <LayoutIcon name="sparkles" size={30} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Need another calendar, CRM, or messaging channel?</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Request a new integration and the GetSetTime team will review it for your workspace.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRequestModalOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Request New Integration
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="stroke-current"
                aria-hidden
              >
                <path d="M5 12h14M13 6l6 6-6 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {disconnectConfirm && (
        <ConfirmModal
          title="Disconnect Integration"
          message={`Are you sure you want to disconnect ${disconnectConfirm.replace("_", " ")}?`}
          confirmLabel="Disconnect"
          variant="danger"
          onConfirm={handleDisconnectConfirm}
          onCancel={() => setDisconnectConfirm(null)}
        />
      )}

      <RequestIntegrationModal
        open={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
        onSubmitted={() =>
          setMessage({
            type: "success",
            text: "Your request was sent. The GetSetTime team will review it shortly.",
          })
        }
      />

      <UpgradePlanModal
        open={upgradeModalOpen}
        message={upgradeModalMessage}
        onClose={() => setUpgradeModalOpen(false)}
      />

      {prereqModal && (
        <ConfirmModal
          title={prereqModal.title}
          message={prereqModal.message}
          confirmLabel="Go to Settings"
          cancelLabel="Cancel"
          variant="primary"
          onConfirm={() => {
            const hash = prereqModal.settingsHash ? `#${prereqModal.settingsHash}` : "";
            setPrereqModal(null);
            router.push(`/settings${hash}`);
          }}
          onCancel={() => setPrereqModal(null)}
        />
      )}
    </main>
  );
}
