"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
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
import { ConfirmModal } from "@/src/components/ui/ConfirmModal";
import { RequestIntegrationModal } from "@/src/components/ui/RequestIntegrationModal";

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

function StatCard({
  icon,
  label,
  value,
  helper,
  valueClassName,
}: {
  icon: LayoutIconName;
  label: string;
  value: string;
  helper: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{label}</p>
          <p className={`mt-1 text-2xl font-bold text-slate-950 ${valueClassName ?? ""}`}>{value}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
          <LayoutIcon name={icon} size={22} />
        </div>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-400">{helper}</p>
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

function ChannelTypeIcon({ channel }: { channel: NotificationChannel }) {
  const map: Record<NotificationChannel, LayoutIconName> = {
    Email: "mail",
    SMS: "smartphone",
    WhatsApp: "messageCircle",
    System: "shield",
  };
  return <LayoutIcon name={map[channel]} size={20} />;
}

export function IntegrationsNotificationsView() {
  const searchParams = useSearchParams();
  const { user } = useAuth();

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
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);

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
    const loadSettings = async () => {
      if (!user) {
        setWorkflowsLoading(false);
        return;
      }

      try {
        const { supabase } = await import("@/lib/supabaseClient");
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token) {
          setWorkflowsLoading(false);
          return;
        }

        const response = await fetch("/api/settings", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });

        if (response.ok) {
          const result = await response.json();
          const notificationSettings = (result.settings?.notifications || {}) as Record<string, boolean | undefined>;
          const loadedFlows: Workflow[] = WORKFLOW_DEFINITIONS.map((def, index) => ({
            id: index + 1,
            name: def.name,
            description: def.description,
            active: workflowInitialActive(def, notificationSettings),
            iconIndex: def.iconIndex,
            settingsKey: def.settingsKey,
          }));
          setFlows(loadedFlows);
        }
      } catch (error) {
        console.error("Error loading notification settings:", error);
        const defaultFlows: Workflow[] = WORKFLOW_DEFINITIONS.map((def, index) => ({
          id: index + 1,
          name: def.name,
          description: def.description,
          active: workflowInitialActive(def, {}),
          iconIndex: def.iconIndex,
          settingsKey: def.settingsKey,
        }));
        setFlows(defaultFlows);
      } finally {
        setWorkflowsLoading(false);
      }
    };

    loadSettings();
  }, [user]);

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

      if (!response.ok) {
        throw new Error("Failed to save notification settings");
      }
    } catch (error) {
      console.error("Error saving notification settings:", error);
    }
  };

  const toggleFlow = async (id: number) => {
    const updatedFlows = flows.map((f) => (f.id === id ? { ...f, active: !f.active } : f));
    setFlows(updatedFlows);
    await saveNotificationSettings(updatedFlows);
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
          name: "Google Calendar",
          desc: "Sync bookings, avoid double booking, and manage availability in real time.",
          category: "Calendar",
          icon: "calendar" as const,
          connected: integrations.google_calendar,
          connectType: "google" as const,
        },
        {
          id: "zoom" as const,
          name: "Zoom Information",
          desc: "Includes Zoom details in your Getsettime App",
          category: "Video Meeting",
          icon: "video" as const,
          connected: integrations.zoom,
          connectType: "zoom" as const,
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
    <main className="min-h-screen bg-slate-50 px-6 py-6 text-slate-950">
      <section className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
          <div className="relative px-6 py-7 md:px-8">
            <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-emerald-50" />
            <div className="relative">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm">
                  <LayoutIcon name="sparkles" size={14} />
                  Automation Control Center
                </div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
                  Integrations &amp; Notifications
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Connect calendars, video meeting tools, WhatsApp, SMS, and email workflows from one premium GetSetTime
                  settings page.
                </p>
              </div>
            </div>
          </div>
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

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            icon="calendar"
            label="Connected Apps"
            value={
              integrationsLoading ? "—" : `${stats.connected}/${stats.totalIntegrations}`
            }
            helper="Live integrations"
          />
          <StatCard
            icon="zap"
            label="Active Rules"
            value={workflowsLoading ? "—" : String(stats.activeRules)}
            helper={`${stats.totalRules} workflows configured`}
          />
          <StatCard
            icon="messageSquare"
            label="Channels"
            value={workflowsLoading ? "—" : String(stats.channels)}
            helper="Email, SMS, WhatsApp"
          />
          <StatCard
            icon="bell"
            label="System Health"
            value={integrationsLoading || workflowsLoading ? "—" : stats.healthLabel}
            helper={stats.healthHint}
            valueClassName={stats.healthClass}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:items-start">
          <section className="min-w-0 space-y-5">
            <PanelHeader
              eyebrow="Connected Apps"
              title="Integrations"
              description="Manage calendar, video meeting, and communication apps."
            />

            {integrationsLoading ? (
              <div className="space-y-4">
                <div className="h-48 animate-pulse rounded-[1.75rem] bg-slate-200/80" />
                <div className="h-48 animate-pulse rounded-[1.75rem] bg-slate-200/80" />
              </div>
            ) : (
              <>
                {items.length === 0 ? (
                  <div className="rounded-[1.75rem] border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
                    <p className="text-lg font-bold text-slate-950">No integrations found</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {items.map((it) => {
                      const connected = it.connected;
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
                          className={`cursor-pointer rounded-[1.75rem] border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/70 ${
                            selected ? "border-blue-200 ring-4 ring-blue-50" : "border-slate-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex gap-4">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                                <LayoutIcon name={it.icon} size={22} />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-slate-900">{it.name}</h3>
                                <p className="mt-1 text-sm leading-5 text-slate-500">{it.desc}</p>
                              </div>
                            </div>
                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                                connected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                              }`}
                            >
                              {connected ? "Connected" : "Not connected"}
                            </span>
                          </div>

                          <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500">
                            {connected && it.id === "google_calendar" && integrations.google_calendar_email ? (
                              <span className="block truncate text-slate-700">{integrations.google_calendar_email}</span>
                            ) : connected ? (
                              <span className="text-slate-600">Account linked</span>
                            ) : (
                              <span>Connect account to enable sync</span>
                            )}
                            <span className="mt-1 block text-slate-400">
                              {connected ? "Status: ready for bookings" : "Not synced"}
                            </span>
                          </div>

                          <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (connected) handleDisconnectClick(it.id);
                                else void handleConnect(it.connectType);
                              }}
                              disabled={actionLoading !== null}
                              className={`rounded-2xl px-4 py-2.5 text-sm font-bold transition disabled:opacity-50 ${
                                connected
                                  ? "border border-slate-200 text-slate-700 hover:bg-slate-50"
                                  : "bg-blue-600 text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
                              }`}
                            >
                              {actionLoading === it.id || actionLoading === it.connectType
                                ? "Loading..."
                                : connected
                                  ? "Disconnect"
                                  : "Connect"}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void fetchIntegrations();
                              }}
                              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-blue-200 hover:text-blue-700"
                            >
                              Sync
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setRequestModalOpen(true);
                              }}
                              className="rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:border-blue-200 hover:text-blue-700"
                            >
                              Manage
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </section>

          <section id="workspace-notifications" className="min-w-0 scroll-mt-6 space-y-5">
            <div className="space-y-5">
                <PanelHeader
                  eyebrow="Workflow Automation"
                  title="Notifications"
                  description="Automate reminders, confirmations, follow-ups, and internal alerts."
                />

                {workflowsLoading ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-48 animate-pulse rounded-[1.75rem] bg-slate-200/80" />
                    ))}
                  </div>
                ) : (
                  <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                    {flows.map((flow) => {
                        const meta = flow.settingsKey ? WORKFLOW_META[flow.settingsKey] : null;
                        const channel = meta?.channel ?? "Email";
                        const chMeta = CHANNEL_META[channel];
                        const IconComponent = getWorkflowIcon(flow);
                        return (
                          <article
                            key={flow.id}
                            className="group rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-200/70"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex min-w-0 gap-4">
                                <div
                                  className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ${chMeta.className}`}
                                >
                                  <ChannelTypeIcon channel={channel} />
                                </div>
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <h3 className="truncate text-base font-bold text-slate-900">{flow.name}</h3>
                                    {flow.active && (
                                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700">
                                        <LayoutIcon name="check" size={12} /> Active
                                      </span>
                                    )}
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-500">
                                    {flow.description}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => void toggleFlow(flow.id)}
                                className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                                  flow.active ? "bg-emerald-500" : "bg-slate-300"
                                }`}
                                aria-label={flow.active ? "Disable workflow" : "Enable workflow"}
                              >
                                <span
                                  className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${
                                    flow.active ? "left-6" : "left-1"
                                  }`}
                                />
                              </button>
                            </div>

                            {meta && (
                              <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                                <InfoPill icon="clock" label={meta.timing} />
                                <InfoPill icon="users" label={meta.audience} />
                              </div>
                            )}

                            <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                              <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500">
                                {channel} Channel
                              </span>
                              <div className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400">
                                <IconComponent className="h-6 w-6" aria-hidden />
                              </div>
                            </div>
                          </article>
                        );
                    })}
                  </div>
                )}
            </div>
          </section>
        </div>

        <div
          id="workspace-request-integration"
          className="scroll-mt-6 rounded-[2rem] border border-blue-100 bg-gradient-to-r from-blue-600 to-cyan-500 p-6 text-white shadow-lg shadow-blue-600/20"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-bold text-blue-100">
                <LayoutIcon name="shield" size={17} className="text-blue-100" />
                Secure integration layer
              </div>
              <h2 className="text-2xl font-bold">Need another calendar, CRM, or messaging channel?</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-50">
                Request a new integration and the GetSetTime team will review it for your workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRequestModalOpen(true)}
              className="shrink-0 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-blue-700 shadow-sm transition hover:bg-blue-50"
            >
              Request New Integration
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
    </main>
  );
}
