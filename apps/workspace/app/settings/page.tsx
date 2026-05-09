"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TIMEZONE_OPTIONS } from "@/src/constants/timezone";

type settings_icon_name =
  | "palette"
  | "upload"
  | "globe"
  | "shield"
  | "lock"
  | "save"
  | "close"
  | "sparkles"
  | "link"
  | "building"
  | "check";

const DATE_FORMAT_OPTIONS = ["DD MMM YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;
const TIME_FORMAT_OPTIONS = ["12-hour", "24-hour"] as const;
const LANGUAGE_OPTIONS = ["English", "Hindi", "Spanish", "French"] as const;
const CURRENCY_OPTIONS = ["INR", "USD", "EUR", "GBP", "CAD"] as const;

function get_public_booking_host(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw) {
    try {
      return new URL(raw).host;
    } catch {
      const stripped = raw.replace(/^https?:\/\//, "").split("/")[0];
      return stripped || "getsettime.com";
    }
  }
  return "getsettime.com";
}

function get_preview_url(slug: string, host: string): string {
  const path = slug.trim() || "your-link";
  return `${host}/${path}`;
}

type snapshot = {
  accountName: string;
  workspaceSlug: string;
  primaryColor: string;
  accentColor: string;
  timezone: string;
  logoFileName: string;
  logoUrl: string | null;
  businessEmail: string;
  businessPhone: string;
  dateFormat: string;
  timeFormat: string;
  language: string;
  currency: string;
  useGradientBookingBg: boolean;
  roundedUiStyle: boolean;
  autoConfirm: boolean;
  allowReschedule: boolean;
  allowCancellation: boolean;
  emailReminder: boolean;
  whatsappReminder: boolean;
};

export default function SettingsPage() {
  const router = useRouter();
  const bookingHost = useMemo(() => get_public_booking_host(), []);

  const [accountName, setAccountName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2ECC71");
  const [accentColor, setAccentColor] = useState("#673AB7");
  const [timezone, setTimezone] = useState("");
  const [logoFileName, setLogoFileName] = useState("No file selected");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [dateFormat, setDateFormat] = useState<string>(DATE_FORMAT_OPTIONS[0]);
  const [timeFormat, setTimeFormat] = useState<string>(TIME_FORMAT_OPTIONS[0]);
  const [language, setLanguage] = useState<string>(LANGUAGE_OPTIONS[0]);
  const [currency, setCurrency] = useState<string>(CURRENCY_OPTIONS[0]);
  const [useGradientBookingBg, setUseGradientBookingBg] = useState(true);
  const [roundedUiStyle, setRoundedUiStyle] = useState(true);
  const [autoConfirm, setAutoConfirm] = useState(false);
  const [allowReschedule, setAllowReschedule] = useState(true);
  const [allowCancellation, setAllowCancellation] = useState(true);
  const [emailReminder, setEmailReminder] = useState(true);
  const [whatsappReminder, setWhatsappReminder] = useState(false);

  const snapshotRef = useRef<snapshot | null>(null);

  const previewUrl = useMemo(
    () => get_preview_url(workspaceSlug, bookingHost),
    [workspaceSlug, bookingHost]
  );

  const applySnapshot = (s: snapshot) => {
    setAccountName(s.accountName);
    setWorkspaceSlug(s.workspaceSlug);
    setPrimaryColor(s.primaryColor);
    setAccentColor(s.accentColor);
    setTimezone(s.timezone);
    setLogoFileName(s.logoFileName);
    setLogoUrl(s.logoUrl);
    setBusinessEmail(s.businessEmail);
    setBusinessPhone(s.businessPhone);
    setDateFormat(s.dateFormat);
    setTimeFormat(s.timeFormat);
    setLanguage(s.language);
    setCurrency(s.currency);
    setUseGradientBookingBg(s.useGradientBookingBg);
    setRoundedUiStyle(s.roundedUiStyle);
    setAutoConfirm(s.autoConfirm);
    setAllowReschedule(s.allowReschedule);
    setAllowCancellation(s.allowCancellation);
    setEmailReminder(s.emailReminder);
    setWhatsappReminder(s.whatsappReminder);
    setLinkError(null);
  };

  const loadSettings = async () => {
    const snap: snapshot = {
      accountName: "",
      workspaceSlug: "",
      primaryColor: "#2ECC71",
      accentColor: "#673AB7",
      timezone: "",
      logoFileName: "No file selected",
      logoUrl: null,
      businessEmail: "",
      businessPhone: "",
      dateFormat: DATE_FORMAT_OPTIONS[0],
      timeFormat: TIME_FORMAT_OPTIONS[0],
      language: LANGUAGE_OPTIONS[0],
      currency: CURRENCY_OPTIONS[0],
      useGradientBookingBg: true,
      roundedUiStyle: true,
      autoConfirm: false,
      allowReschedule: true,
      allowCancellation: true,
      emailReminder: true,
      whatsappReminder: false,
    };

    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setIsLoading(false);
        return;
      }

      const token = session.access_token;

      const workspaceResponse = await fetch("/api/workspace", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!workspaceResponse.ok) {
        const errorData = await workspaceResponse.json().catch(() => ({}));
        console.error("Failed to load workspace:", errorData);
        throw new Error(errorData.error || "Failed to load workspace data");
      }

      const workspaceData = await workspaceResponse.json();
      if (workspaceData?.workspace) {
        const workspace = workspaceData.workspace;
        snap.accountName = workspace.name || "";
        snap.workspaceSlug = workspace.slug || "";

        if (workspace.logo_url) {
          snap.logoUrl = workspace.logo_url;
          const urlParts = workspace.logo_url.split("/");
          const fileName = urlParts[urlParts.length - 1];
          snap.logoFileName = fileName || "No file selected";
        } else {
          snap.logoUrl = null;
          snap.logoFileName = "No file selected";
        }
      }

      const settingsResponse = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (settingsResponse.ok) {
        const data = await settingsResponse.json();
        if (data?.settings) {
          const settings = data.settings;
          const general = (settings.general || {}) as Record<string, unknown>;
          if (typeof general.primaryColor === "string") {
            snap.primaryColor = general.primaryColor;
          }
          if (typeof general.accentColor === "string") {
            snap.accentColor = general.accentColor;
          }
          snap.timezone =
            typeof general.timezone === "string" ? general.timezone : "";

          if (typeof general.business_email === "string") {
            snap.businessEmail = general.business_email;
          }
          if (typeof general.business_phone === "string") {
            snap.businessPhone = general.business_phone;
          }
          if (
            typeof general.date_format === "string" &&
            DATE_FORMAT_OPTIONS.includes(
              general.date_format as (typeof DATE_FORMAT_OPTIONS)[number]
            )
          ) {
            snap.dateFormat = general.date_format;
          }
          if (
            typeof general.time_format === "string" &&
            TIME_FORMAT_OPTIONS.includes(
              general.time_format as (typeof TIME_FORMAT_OPTIONS)[number]
            )
          ) {
            snap.timeFormat = general.time_format;
          }
          if (
            typeof general.default_language === "string" &&
            LANGUAGE_OPTIONS.includes(
              general.default_language as (typeof LANGUAGE_OPTIONS)[number]
            )
          ) {
            snap.language = general.default_language;
          }
          if (
            typeof general.currency === "string" &&
            CURRENCY_OPTIONS.includes(
              general.currency as (typeof CURRENCY_OPTIONS)[number]
            )
          ) {
            snap.currency = general.currency;
          }
          if (typeof general.booking_page_gradient === "boolean") {
            snap.useGradientBookingBg = general.booking_page_gradient;
          }
          if (typeof general.rounded_ui_style === "boolean") {
            snap.roundedUiStyle = general.rounded_ui_style;
          }
          if (typeof general.allow_customer_reschedule === "boolean") {
            snap.allowReschedule = general.allow_customer_reschedule;
          }
          if (typeof general.allow_customer_cancellation === "boolean") {
            snap.allowCancellation = general.allow_customer_cancellation;
          }

          const notifications = (settings.notifications || {}) as Record<
            string,
            unknown
          >;
          snap.autoConfirm = notifications["auto-confirm-booking"] === true;
          snap.emailReminder = notifications["email-reminder"] !== false;
          snap.whatsappReminder = notifications["sms-reminder"] === true;
        }
      }

      snapshotRef.current = snap;
      applySnapshot(snap);
    } catch (error) {
      console.error("Error loading settings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    setSaveMessage(null);

    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/settings/logo", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Failed to upload logo");
      }

      const result = await response.json();
      setLogoFileName(file.name);
      setLogoUrl(result.url);
      setLogoPath(result.path);
      if (snapshotRef.current) {
        snapshotRef.current = {
          ...snapshotRef.current,
          logoFileName: file.name,
          logoUrl: result.url as string,
        };
      }
      setSaveMessage({ type: "success", text: "Logo uploaded successfully." });
      setTimeout(() => setSaveMessage(null), 2500);
    } catch (error) {
      console.error("Error uploading logo:", error);
      setSaveMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to upload logo. Please try again.",
      });
      setTimeout(() => setSaveMessage(null), 4000);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLinkError(null);
    setSaveMessage(null);

    const trimmedSlug = workspaceSlug.trim();
    if (!trimmedSlug) {
      setLinkError("Link is required");
      setSaveMessage({ type: "error", text: "Link is required." });
      return;
    }

    setIsSaving(true);

    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const workspaceResponse = await fetch("/api/workspace", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: accountName,
          slug: workspaceSlug.trim().toLowerCase() || undefined,
          logo_url: logoUrl,
        }),
      });

      if (!workspaceResponse.ok) {
        const result = await workspaceResponse.json().catch(() => ({}));
        throw new Error(result.error || "Failed to save workspace settings");
      }

      const settingsData = {
        general: {
          primaryColor,
          accentColor,
          timezone: timezone.trim() || undefined,
          business_email: businessEmail.trim() || undefined,
          business_phone: businessPhone.trim() || undefined,
          date_format: dateFormat,
          time_format: timeFormat,
          default_language: language,
          currency,
          booking_page_gradient: useGradientBookingBg,
          rounded_ui_style: roundedUiStyle,
          allow_customer_reschedule: allowReschedule,
          allow_customer_cancellation: allowCancellation,
        },
        notifications: {
          "auto-confirm-booking": autoConfirm,
          "email-reminder": emailReminder,
          "sms-reminder": whatsappReminder,
        },
      };

      const settingsResponse = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ settings: settingsData }),
      });

      if (!settingsResponse.ok) {
        console.warn(
          "Failed to save extended settings:",
          await settingsResponse.json().catch(() => ({}))
        );
      }

      setSaveMessage({ type: "success", text: "Settings saved successfully!" });
      setTimeout(() => setSaveMessage(null), 3000);
      snapshotRef.current = {
        accountName,
        workspaceSlug,
        primaryColor,
        accentColor,
        timezone,
        logoFileName,
        logoUrl,
        businessEmail,
        businessPhone,
        dateFormat,
        timeFormat,
        language,
        currency,
        useGradientBookingBg,
        roundedUiStyle,
        autoConfirm,
        allowReschedule,
        allowCancellation,
        emailReminder,
        whatsappReminder,
      };
    } catch (error) {
      console.error("Error saving settings:", error);
      setSaveMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to save settings. Please try again.",
      });
      setTimeout(() => setSaveMessage(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    const snap = snapshotRef.current;
    if (snap) {
      applySnapshot(snap);
    } else {
      router.back();
    }
    setSaveMessage(null);
  };

  useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once on mount
  }, []);

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 px-5 py-6 text-slate-900 md:px-8 lg:px-10">
        <div className="mx-auto max-w-7xl py-16 text-center text-slate-500">
          Loading settings…
        </div>
      </main>
    );
  }

  const checklist_items: { label: string; done: boolean }[] = [
    { label: "Workspace name added", done: accountName.trim().length > 0 },
    { label: "Booking link configured", done: workspaceSlug.trim().length > 0 },
    {
      label: "Brand colors selected",
      done: /^#[0-9A-Fa-f]{6}$/.test(primaryColor) && /^#[0-9A-Fa-f]{6}$/.test(accentColor),
    },
    {
      label: "Timezone preference set",
      done: true,
    },
  ];

  const previewHref = `https://${previewUrl}`;

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-6 text-slate-900 md:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <form onSubmit={handleSubmit}>
          <section className="overflow-hidden rounded-[2rem] border border-white bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)]">
            <div className="relative bg-gradient-to-br from-indigo-600 via-violet-600 to-cyan-500 p-6 text-white md:p-8">
              <div className="absolute -right-20 -top-20 h-56 w-56 rounded-full bg-white/20 blur-3xl" />
              <div className="absolute bottom-0 right-1/3 h-32 w-32 rounded-full bg-emerald-300/20 blur-2xl" />

              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold backdrop-blur">
                    <SettingsIcon name="sparkles" className="h-4 w-4" />{" "}
                    Workspace Settings
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
                    Settings
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-indigo-50 md:text-base">
                    Manage your account profile, booking link, brand colors,
                    timezone, and workspace identity.
                  </p>
                </div>

                <Link
                  href="/change-password"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-indigo-700 shadow-lg shadow-indigo-950/20 transition hover:-translate-y-0.5 hover:bg-indigo-50"
                >
                  <SettingsIcon name="lock" className="h-4 w-4" />
                  Change Password
                </Link>
              </div>
            </div>

            <div className="grid gap-6 p-5 md:p-8 lg:grid-cols-[1fr_360px]">
              <div className="space-y-5">
                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
                        <SettingsIcon
                          name="building"
                          className="h-5 w-5 text-indigo-600"
                        />{" "}
                        Account Details
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Basic workspace information visible across your booking
                        pages.
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      Active
                    </span>
                  </div>

                  <div className="grid gap-5">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">
                        Account Name
                      </span>
                      <input
                        type="text"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-medium outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                        placeholder="Enter account name"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">
                        My Link
                      </span>
                      <div
                        className={`flex overflow-hidden rounded-2xl border bg-slate-50 transition focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-100 ${
                          linkError
                            ? "border-red-400 focus-within:border-red-500"
                            : "border-slate-200 focus-within:border-indigo-400"
                        }`}
                      >
                        <div className="hidden items-center gap-2 border-r border-slate-200 bg-white px-4 text-sm font-semibold text-slate-500 md:flex">
                          <SettingsIcon name="link" className="h-4 w-4" />
                          {bookingHost}/
                        </div>
                        <input
                          type="text"
                          value={workspaceSlug}
                          onChange={(e) => {
                            setWorkspaceSlug(e.target.value);
                            if (linkError) setLinkError(null);
                          }}
                          className="h-14 min-w-0 flex-1 bg-transparent px-4 text-base font-medium outline-none"
                          placeholder="your-link"
                          required
                          aria-invalid={linkError ? true : undefined}
                        />
                      </div>
                      {linkError ? (
                        <p className="mt-2 text-sm font-medium text-red-600">
                          {linkError}
                        </p>
                      ) : (
                        <a
                          href={previewHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 block text-sm font-medium text-indigo-600 hover:underline"
                        >
                          {previewUrl}
                        </a>
                      )}
                    </label>

                    <div className="grid gap-5 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-700">
                          Business Email
                        </span>
                        <input
                          type="email"
                          value={businessEmail}
                          onChange={(e) => setBusinessEmail(e.target.value)}
                          className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-medium outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                          placeholder="you@company.com"
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-700">
                          Business Phone
                        </span>
                        <input
                          type="tel"
                          value={businessPhone}
                          onChange={(e) => setBusinessPhone(e.target.value)}
                          className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-medium outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                          placeholder="+1 …"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-5">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
                      <SettingsIcon
                        name="palette"
                        className="h-5 w-5 text-indigo-600"
                      />{" "}
                      Brand Appearance
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Control the colors used on public booking pages and
                      notifications.
                    </p>
                  </div>

                  <div className="space-y-5">
                    <ColorRow
                      label="Primary Color (Main brand color)"
                      color={primaryColor}
                      setColor={setPrimaryColor}
                    />
                    <ColorRow
                      label="Accent Color (CTA / highlights)"
                      color={accentColor}
                      setColor={setAccentColor}
                    />

                    <ToggleRow
                      label="Use gradient background on booking page."
                      value={useGradientBookingBg}
                      setValue={setUseGradientBookingBg}
                    />
                    <ToggleRow
                      label="Enable rounded UI style (modern look)."
                      value={roundedUiStyle}
                      setValue={setRoundedUiStyle}
                    />
                  </div>

                  <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-600">
                      Recommended for MVP:
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-500">
                      <li>Primary + Accent colors (keep simple)</li>
                      <li>Light UI (avoid dark mode in MVP)</li>
                      <li>Minimal branding for faster load and consistency</li>
                    </ul>
                    <p className="mt-3 text-xs font-semibold text-slate-600">
                      Avoid in MVP:
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-500">
                      <li>Full theme builder (too complex)</li>
                      <li>Font customization</li>
                      <li>Advanced layout control</li>
                      <li>Per-page branding overrides</li>
                    </ul>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-5">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
                      <SettingsIcon
                        name="globe"
                        className="h-5 w-5 text-indigo-600"
                      />{" "}
                      Timezone &amp; Logo
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Used for booking times in sidebar, emails, reminders, and
                      API responses.
                    </p>
                  </div>

                  <div className="grid gap-5">
                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">
                        Timezone
                      </span>
                      <select
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                        className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-medium outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                      >
                        <option value="">Use visitor&apos;s timezone</option>
                        {TIMEZONE_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div>
                      <span className="mb-2 block text-sm font-bold text-slate-700">
                        Logo
                      </span>
                      <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                        <div className="flex h-14 min-w-0 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-medium text-slate-700">
                          <span className="truncate">{logoFileName}</span>
                        </div>
                        <label className="inline-flex h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
                          <SettingsIcon name="upload" className="h-4 w-4" />
                          {isUploadingLogo ? "Uploading…" : "Browse"}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoChange}
                            disabled={isUploadingLogo}
                            className="hidden"
                          />
                        </label>
                      </div>
                      {logoUrl && (
                        <div className="mt-3 flex items-center gap-3">
                          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-white">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={logoUrl}
                              alt="Logo preview"
                              className="h-full w-full object-contain"
                            />
                          </div>
                          {logoPath ? (
                            <span className="truncate text-xs text-slate-500">
                              {logoPath}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-5">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
                      <SettingsIcon
                        name="globe"
                        className="h-5 w-5 text-indigo-600"
                      />{" "}
                      Regional Preferences
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      MVP-ready defaults for date, time, language, and currency
                      display.
                    </p>
                  </div>
                  <div className="grid gap-5 md:grid-cols-2">
                    <SelectField
                      label="Date Format"
                      value={dateFormat}
                      setValue={setDateFormat}
                      options={[...DATE_FORMAT_OPTIONS]}
                    />
                    <SelectField
                      label="Time Format"
                      value={timeFormat}
                      setValue={setTimeFormat}
                      options={[...TIME_FORMAT_OPTIONS]}
                    />
                    <SelectField
                      label="Default Language"
                      value={language}
                      setValue={setLanguage}
                      options={[...LANGUAGE_OPTIONS]}
                    />
                    <SelectField
                      label="Currency"
                      value={currency}
                      setValue={setCurrency}
                      options={[...CURRENCY_OPTIONS]}
                    />
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-5">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
                      <SettingsIcon
                        name="shield"
                        className="h-5 w-5 text-indigo-600"
                      />{" "}
                      Booking Rules &amp; Notifications
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Important SaaS controls for booking flow, reminders, and
                      customer actions.
                    </p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <ToggleRow
                      label="Auto-confirm new bookings"
                      value={autoConfirm}
                      setValue={setAutoConfirm}
                    />
                    <ToggleRow
                      label="Allow customer reschedule"
                      value={allowReschedule}
                      setValue={setAllowReschedule}
                    />
                    <ToggleRow
                      label="Allow customer cancellation"
                      value={allowCancellation}
                      setValue={setAllowCancellation}
                    />
                    <ToggleRow
                      label="Email reminders"
                      value={emailReminder}
                      setValue={setEmailReminder}
                    />
                    <ToggleRow
                      label="WhatsApp reminders"
                      value={whatsappReminder}
                      setValue={setWhatsappReminder}
                    />
                  </div>
                </div>
              </div>

              <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
                <div className="rounded-3xl border border-slate-200 bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/10">
                  <div className="mb-5 flex items-center justify-between gap-2">
                    <div>
                      <h3 className="text-lg font-bold">Live Brand Preview</h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Customer booking page style
                      </p>
                    </div>
                    <SettingsIcon
                      name="shield"
                      className="h-6 w-6 shrink-0 text-emerald-300"
                    />
                  </div>

                  <div
                    className={`rounded-3xl bg-white p-4 text-slate-900 ${roundedUiStyle ? "" : "rounded-lg"}`}
                  >
                    <div
                      className={`mb-4 h-24 ${roundedUiStyle ? "rounded-2xl" : "rounded-sm"}`}
                      style={{
                        background: useGradientBookingBg
                          ? `linear-gradient(135deg, ${primaryColor}, ${accentColor})`
                          : primaryColor,
                      }}
                    />
                    <div className="space-y-2">
                      <h4 className="text-lg font-bold">
                        {accountName.trim() || "Workspace Name"}
                      </h4>
                      <p className="text-sm text-slate-500">
                        Book appointments with a clean, branded experience.
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`mt-5 w-full px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 ${roundedUiStyle ? "rounded-2xl" : "rounded-md"}`}
                      style={{ backgroundColor: primaryColor }}
                    >
                      Book Appointment
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-base font-bold text-slate-950">
                    Setup Checklist
                  </h3>
                  <div className="mt-4 space-y-3">
                    {checklist_items.map((item) => (
                      <div
                        key={item.label}
                        className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold ${
                          item.done
                            ? "bg-slate-50 text-slate-700"
                            : "bg-amber-50 text-amber-900"
                        }`}
                      >
                        <SettingsIcon
                          name="check"
                          className={`h-5 w-5 shrink-0 ${item.done ? "text-emerald-500" : "text-amber-500"}`}
                        />
                        {item.label}
                      </div>
                    ))}
                  </div>
                </div>
              </aside>
            </div>

            {saveMessage && (
              <div
                className={`mx-5 mb-4 rounded-2xl border px-4 py-3 text-sm font-medium md:mx-8 ${
                  saveMessage.type === "success"
                    ? "border-green-200 bg-green-50 text-green-800"
                    : "border-red-200 bg-red-50 text-red-800"
                }`}
              >
                {saveMessage.text}
              </div>
            )}

            <div className="sticky bottom-0 border-t border-slate-200 bg-white/90 px-5 py-4 backdrop-blur md:px-8">
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                >
                  <SettingsIcon name="close" className="h-4 w-4" /> Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/25 transition hover:-translate-y-0.5 hover:bg-indigo-700 disabled:pointer-events-none disabled:opacity-50"
                >
                  <SettingsIcon name="save" className="h-4 w-4" />
                  {isSaving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </section>
        </form>
      </div>
    </main>
  );
}

function SelectField({
  label,
  value,
  setValue,
  options,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-medium outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ToggleRow({
  label,
  value,
  setValue,
}: {
  label: string;
  value: boolean;
  setValue: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => setValue(!value)}
      className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50"
    >
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition ${value ? "bg-indigo-600" : "bg-slate-300"}`}
        aria-hidden
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition ${value ? "left-6" : "left-1"}`}
        />
      </span>
    </button>
  );
}

function ColorRow({
  label,
  color,
  setColor,
}: {
  label: string;
  color: string;
  setColor: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </span>
      <div className="grid gap-3 md:grid-cols-[1fr_150px]">
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-14 w-full cursor-pointer rounded-2xl border border-slate-200 bg-white p-1 shadow-inner"
        />
        <input
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="h-14 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-center text-base font-bold text-slate-800 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
        />
      </div>
    </label>
  );
}

function SettingsIcon({
  name,
  className = "h-5 w-5",
}: {
  name: settings_icon_name;
  className?: string;
}) {
  const common = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true as const,
  };

  const paths: Record<settings_icon_name, React.ReactNode> = {
    palette: (
      <>
        <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
        <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" stroke="none" />
        <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" stroke="none" />
        <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" stroke="none" />
        <path d="M12 3a9 9 0 0 0 0 18h1.5a2.5 2.5 0 0 0 1.7-4.35 1.7 1.7 0 0 1 1.15-2.95H18a3 3 0 0 0 3-3A7.7 7.7 0 0 0 12 3Z" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M20 16v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3" />
      </>
    ),
    globe: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18" />
        <path d="M12 3a14 14 0 0 1 0 18" />
        <path d="M12 3a14 14 0 0 0 0 18" />
      </>
    ),
    shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />,
    lock: (
      <>
        <rect x="4" y="11" width="16" height="9" rx="2" />
        <path d="M8 11V8a4 4 0 0 1 8 0v3" />
      </>
    ),
    save: (
      <>
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2Z" />
        <path d="M17 21v-8H7v8" />
        <path d="M7 3v5h8" />
      </>
    ),
    close: (
      <>
        <path d="M18 6 6 18" />
        <path d="m6 6 12 12" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3 1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" />
        <path d="m19 14 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" />
        <path d="m5 15 .8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8L5 15Z" />
      </>
    ),
    link: (
      <>
        <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
        <path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1" />
      </>
    ),
    building: (
      <>
        <path d="M3 21h18" />
        <path d="M5 21V5a2 2 0 0 1 2-2h7v18" />
        <path d="M19 21V9a2 2 0 0 0-2-2h-3" />
        <path d="M9 7h1" />
        <path d="M9 11h1" />
        <path d="M9 15h1" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}
