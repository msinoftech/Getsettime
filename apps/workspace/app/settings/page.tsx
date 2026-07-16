"use client";

import React, { useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TIMEZONE_OPTIONS } from "@/src/constants/timezone";
import { ROLE_MANAGER, ROLE_SERVICE_PROVIDER, ROLE_STAFF, ROLE_WORKSPACE_ADMIN } from "@/src/constants/roles";
import { CURRENCY_OPTIONS, CURRENCY_SYMBOLS } from "@/src/constants/currency";
import { getTimezoneAbbreviation } from "@/lib/date-timezone";
import { useAuth } from "@/src/providers/AuthProvider";
import { useCreateBookingModal } from "@/src/providers/CreateBookingModalProvider";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";
import { WorkspaceBrandLogo } from "@/src/components/molecules/WorkspaceBrandLogo";
import { AddressAutocompleteInput } from "@/src/components/molecules/AddressAutocompleteInput";
import { BookingPhoneInput } from "@/src/components/Booking/MultiStepBooking/BookingPhoneInput";
import { resolve_workspace_logo_src } from "@/src/utils/workspace_logo";
import {
  build_address_display_line,
  type parsed_address,
} from "@/src/utils/parse_google_place_address";
import {
  build_service_provider_public_booking_url,
  build_workspace_public_booking_url,
  copy_text_to_clipboard,
} from "@/src/utils/public_booking_link";
import { is_whatsapp_user_enabled } from "@/lib/workspace-notification-flags";
import type { workspace_notifications_settings } from "@/lib/workspace-notification-flags";

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
  | "check"
  | "trash"
  | "user"
  | "externalLink"
  | "copy"
  | "share"
  | "refresh"
  | "eye";

const DATE_FORMAT_OPTIONS = ["DD MMM YYYY", "MM/DD/YYYY", "YYYY-MM-DD"] as const;
const TIME_FORMAT_OPTIONS = ["12-hour", "24-hour"] as const;
const LANGUAGE_OPTIONS = ["English", "Hindi", "Spanish", "French"] as const;
const TAGLINE_MAX_LENGTH = 50;

const TIME_FORMAT_LABELS: Record<(typeof TIME_FORMAT_OPTIONS)[number], string> = {
  "12-hour": "12 Hour (AM/PM)",
  "24-hour": "24 Hour",
};

function format_regional_timezone_option(iana: string): string {
  try {
    const date = new Date();
    const offset =
      new Intl.DateTimeFormat("en-US", {
        timeZone: iana,
        timeZoneName: "longOffset",
      })
        .formatToParts(date)
        .find((part) => part.type === "timeZoneName")?.value ?? "";
    const longName =
      new Intl.DateTimeFormat("en-US", {
        timeZone: iana,
        timeZoneName: "long",
      })
        .formatToParts(date)
        .find((part) => part.type === "timeZoneName")?.value ?? iana;
    const abbr = getTimezoneAbbreviation(iana, date);
    return offset ? `(${offset}) ${longName} (${abbr})` : `${longName} (${abbr})`;
  } catch {
    return iana;
  }
}

function currency_option_label(code: string): string {
  const symbol = CURRENCY_SYMBOLS[code];
  return symbol ? `${code} - ${symbol}` : code;
}

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

function workspace_name_initial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "W";
  const match = trimmed.match(/[A-Za-z0-9]/);
  return (match?.[0] ?? trimmed.charAt(0)).toUpperCase();
}

function get_preview_url(slug: string, host: string): string {
  const path = slug.trim() || "your-link";
  return `${host}/${path}`;
}

function get_provider_preview_url(
  workspaceSlug: string,
  providerSlug: string,
  host: string
): string {
  const workspace = workspaceSlug.trim() || "your-workspace";
  const provider = providerSlug.trim() || "your-link";
  return `${host}/${workspace}/${provider}`;
}

type snapshot = {
  accountName: string;
  workspaceSlug: string;
  serviceProviderSlug: string;
  primaryColor: string;
  accentColor: string;
  timezone: string;
  logoFileName: string;
  logoUrl: string | null;
  tagline: string;
  businessEmail: string;
  businessPhone: string;
  address: string;
  city: string;
  addressState: string;
  zipcode: string;
  country: string;
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
  smsReminder: boolean;
  whatsappReminder: boolean;
};

export default function SettingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { open: open_create_booking } = useCreateBookingModal();
  const { refetch: refetchWorkspaceShell } = useWorkspaceSettings();
  const bookingHost = useMemo(() => get_public_booking_host(), []);
  const userRole = user?.user_metadata?.role as string | undefined;
  const isServiceProvider = userRole === ROLE_SERVICE_PROVIDER;
  const isStaff = userRole === ROLE_STAFF;
  const canEditAllSettings =
    userRole === ROLE_WORKSPACE_ADMIN || userRole === ROLE_MANAGER;
  const isReadOnly = isStaff;
  const canEditProviderSlug = isServiceProvider && !isReadOnly;
  const canSave = canEditAllSettings || canEditProviderSlug;
  const nonLinkFieldsDisabled = isReadOnly || isServiceProvider;
  const loggedInUserId = user?.id ?? null;

  const [accountName, setAccountName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [serviceProviderSlug, setServiceProviderSlug] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#2ECC71");
  const [accentColor, setAccentColor] = useState("#673AB7");
  const [timezone, setTimezone] = useState("");
  const [logoFileName, setLogoFileName] = useState("No file selected");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoPath, setLogoPath] = useState<string | null>(null);
  const [tagline, setTagline] = useState("");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [addressState, setAddressState] = useState("");
  const [zipcode, setZipcode] = useState("");
  const [country, setCountry] = useState("");
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
  const [smsReminder, setSmsReminder] = useState(true);
  const [whatsappReminder, setWhatsappReminder] = useState(true);

  const snapshotRef = useRef<snapshot | null>(null);

  const previewUrl = useMemo(() => {
    if (isServiceProvider) {
      return get_provider_preview_url(
        workspaceSlug,
        serviceProviderSlug,
        bookingHost
      );
    }
    return get_preview_url(workspaceSlug, bookingHost);
  }, [
    isServiceProvider,
    workspaceSlug,
    serviceProviderSlug,
    bookingHost,
  ]);

  const publicBookingUrl = useMemo(() => {
    if (isServiceProvider) {
      return build_service_provider_public_booking_url(
        workspaceSlug,
        serviceProviderSlug
      );
    }
    return build_workspace_public_booking_url(workspaceSlug);
  }, [isServiceProvider, workspaceSlug, serviceProviderSlug]);

  const applySnapshot = (s: snapshot) => {
    setAccountName(s.accountName);
    setWorkspaceSlug(s.workspaceSlug);
    setServiceProviderSlug(s.serviceProviderSlug);
    setPrimaryColor(s.primaryColor);
    setAccentColor(s.accentColor);
    setTimezone(s.timezone);
    setLogoFileName(s.logoFileName);
    setLogoUrl(s.logoUrl);
    setTagline(s.tagline);
    setBusinessEmail(s.businessEmail);
    setBusinessPhone(s.businessPhone);
    setAddress(s.address);
    setAddressLine(
      build_address_display_line({
        address: s.address,
        city: s.city,
        addressState: s.addressState,
        zipcode: s.zipcode,
        country: s.country,
      })
    );
    setCity(s.city);
    setAddressState(s.addressState);
    setZipcode(s.zipcode);
    setCountry(s.country);
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
    setSmsReminder(s.smsReminder);
    setWhatsappReminder(s.whatsappReminder);
    setLinkError(null);
  };

  const loadSettings = async () => {
    const snap: snapshot = {
      accountName: "",
      workspaceSlug: "",
      serviceProviderSlug: "",
      primaryColor: "#2ECC71",
      accentColor: "#673AB7",
      timezone: "",
      logoFileName: "No file selected",
      logoUrl: null,
      tagline: "",
      businessEmail: "",
      businessPhone: "",
      address: "",
      city: "",
      addressState: "",
      zipcode: "",
      country: "",
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
      smsReminder: true,
      whatsappReminder: true,
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

          if (typeof general.tagline === "string") {
            snap.tagline = general.tagline;
          }
          if (typeof general.business_email === "string") {
            snap.businessEmail = general.business_email;
          }
          if (typeof general.business_phone === "string") {
            snap.businessPhone = general.business_phone;
          }
          if (typeof general.address === "string") {
            snap.address = general.address;
          }
          if (typeof general.city === "string") {
            snap.city = general.city;
          }
          if (typeof general.state === "string") {
            snap.addressState = general.state;
          }
          if (typeof general.zipcode === "string") {
            snap.zipcode = general.zipcode;
          }
          if (typeof general.country === "string") {
            snap.country = general.country;
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
          snap.smsReminder = notifications["sms-reminder"] !== false;
          snap.whatsappReminder = is_whatsapp_user_enabled(
            notifications as workspace_notifications_settings
          );

          const {
            data: { user: authUser },
          } = await supabase.auth.getUser();
          const authRole = authUser?.user_metadata?.role as string | undefined;
          if (authRole === ROLE_SERVICE_PROVIDER && authUser?.id) {
            const links = (settings.links || {}) as Record<
              string,
              { slug?: string }
            >;
            snap.serviceProviderSlug = links[authUser.id]?.slug ?? "";
          }
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
    if (!canEditAllSettings) return;

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
      void refetchWorkspaceShell();
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

  const handleLogoRemove = async () => {
    if (!canEditAllSettings || !logoUrl) return;

    setIsUploadingLogo(true);
    setSaveMessage(null);

    try {
      const { supabase } = await import("@/lib/supabaseClient");
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;

      const response = await fetch("/api/settings/logo", {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.error || "Failed to remove logo");
      }

      setLogoFileName("No file selected");
      setLogoUrl(null);
      setLogoPath(null);
      if (snapshotRef.current) {
        snapshotRef.current = {
          ...snapshotRef.current,
          logoFileName: "No file selected",
          logoUrl: null,
        };
      }
      setSaveMessage({ type: "success", text: "Logo removed successfully." });
      setTimeout(() => setSaveMessage(null), 2500);
      void refetchWorkspaceShell();
    } catch (error) {
      console.error("Error removing logo:", error);
      setSaveMessage({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Failed to remove logo. Please try again.",
      });
      setTimeout(() => setSaveMessage(null), 4000);
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;

    setLinkError(null);
    setSaveMessage(null);

    const trimmedSlug = workspaceSlug.trim();
    const trimmedProviderSlug = serviceProviderSlug.trim();

    if (isServiceProvider) {
      if (!trimmedProviderSlug) {
        setLinkError("Provider link is required");
        setSaveMessage({ type: "error", text: "Provider link is required." });
        return;
      }
      if (!trimmedSlug) {
        setLinkError("Workspace link is not configured");
        setSaveMessage({
          type: "error",
          text: "Workspace booking link is not configured yet.",
        });
        return;
      }
    } else if (!trimmedSlug) {
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

      if (isServiceProvider && loggedInUserId) {
        const settingsResponse = await fetch("/api/settings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            settings: {
              links: {
                [loggedInUserId]: { slug: trimmedProviderSlug.toLowerCase() },
              },
            },
          }),
        });

        if (!settingsResponse.ok) {
          const result = await settingsResponse.json().catch(() => ({}));
          const message =
            typeof result.error === "string"
              ? result.error
              : "Failed to save settings";
          setLinkError(message);
          throw new Error(message);
        }

        setSaveMessage({ type: "success", text: "Provider link saved successfully!" });
        setTimeout(() => setSaveMessage(null), 3000);
        void refetchWorkspaceShell();
        snapshotRef.current = {
          ...(snapshotRef.current ?? {
            accountName: "",
            workspaceSlug: trimmedSlug,
            serviceProviderSlug: trimmedProviderSlug,
            primaryColor,
            accentColor,
            timezone,
            logoFileName,
            logoUrl,
            tagline,
            businessEmail,
            businessPhone,
            address,
            city,
            addressState,
            zipcode,
            country,
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
            smsReminder,
            whatsappReminder,
          }),
          serviceProviderSlug: trimmedProviderSlug,
        };
        return;
      }

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

      const settingsData: {
        general: Record<string, unknown>;
        notifications: Record<string, unknown>;
      } = {
        general: {
          primaryColor,
          accentColor,
          timezone: timezone.trim() || undefined,
          tagline: tagline.trim().slice(0, TAGLINE_MAX_LENGTH) || undefined,
          business_email: businessEmail.trim() || undefined,
          // Send empty string (not undefined) so clearing the field overwrites the
          // stored value — JSON.stringify drops `undefined`, leaving the old value in DB.
          business_phone: businessPhone.trim(),
          address: addressLine.trim() || undefined,
          city: city.trim() || undefined,
          state: addressState.trim() || undefined,
          zipcode: zipcode.trim() || undefined,
          country: country.trim() || undefined,
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
          "sms-reminder": smsReminder,
          "whatsapp-user": whatsappReminder,
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
        const result = await settingsResponse.json().catch(() => ({}));
        const message =
          typeof result.error === "string"
            ? result.error
            : "Failed to save settings";
        if (isServiceProvider) {
          setLinkError(message);
        }
        throw new Error(message);
      }

      setSaveMessage({ type: "success", text: "Settings saved successfully!" });
      setTimeout(() => setSaveMessage(null), 3000);
      void refetchWorkspaceShell();
      snapshotRef.current = {
        accountName,
        workspaceSlug,
        serviceProviderSlug,
        primaryColor,
        accentColor,
        timezone,
        logoFileName,
        logoUrl,
        tagline,
        businessEmail,
        businessPhone,
        address: addressLine,
        city,
        addressState,
        zipcode,
        country,
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
        smsReminder,
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

  // When linked from another page (e.g. #business-phone), scroll to and focus the field.
  useEffect(() => {
    if (isLoading || typeof window === "undefined") return;
    if (window.location.hash !== "#business-phone") return;
    requestAnimationFrame(() => {
      const el = document.getElementById("business-phone");
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLInputElement).focus({ preventScroll: true });
    });
  }, [isLoading]);

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
    { label: "Workspace details added", done: accountName.trim().length > 0 },
    { label: "Booking link configured", done: isServiceProvider
        ? workspaceSlug.trim().length > 0 && serviceProviderSlug.trim().length > 0
        : workspaceSlug.trim().length > 0 },
    {
      label: "Brand colors selected",
      done: /^#[0-9A-Fa-f]{6}$/.test(primaryColor) && /^#[0-9A-Fa-f]{6}$/.test(accentColor),
    },
    {
      label: "Timezone preference set",
      done: true,
    },
    {
      label: "Notifications configured",
      done:
        autoConfirm ||
        allowReschedule ||
        allowCancellation ||
        emailReminder ||
        smsReminder ||
        whatsappReminder,
    },
  ];

  const copyWorkspaceLink = async () => {
    if (!publicBookingUrl) return;
    const ok = await copy_text_to_clipboard(publicBookingUrl);
    if (ok) {
      setLinkCopied(true);
      window.setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  const shareBookingPage = async () => {
    if (!publicBookingUrl) return;
    const workspaceTitle = accountName.trim() || "Workspace";
    const shareText = `You can book your appointment with ${workspaceTitle} using this link:`;

    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({
          title: "Book an appointment",
          text: shareText,
          url: publicBookingUrl,
        });
        setShareNotice("Booking page shared successfully.");
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${shareText}\n${publicBookingUrl}`);
        setShareNotice("Booking link copied to clipboard.");
      } else {
        const ok = await copy_text_to_clipboard(publicBookingUrl);
        if (ok) setShareNotice("Booking link copied to clipboard.");
      }
    } catch {
      setShareNotice("Share was cancelled.");
    }

    window.setTimeout(() => setShareNotice(null), 2600);
  };

  const link_field_class = (hasError: boolean) =>
    `relative flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-slate-50 transition focus-within:bg-white focus-within:ring-4 focus-within:ring-indigo-100 sm:flex-row ${
      hasError
        ? "border-red-400 focus-within:border-red-500"
        : "border-slate-200 focus-within:border-indigo-400"
    }`;

  const link_prefix_class =
    "flex max-w-full shrink-0 items-center gap-2 truncate border-b border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-500 sm:border-b-0 sm:border-r sm:px-4 sm:py-0 sm:text-sm";

  const link_slug_input_class =
    "h-14 min-w-0 w-full bg-transparent px-4 pr-20 text-base font-medium outline-none disabled:cursor-not-allowed disabled:opacity-60";

  const link_action_buttons = (
    <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
      <a
        href={publicBookingUrl ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-50"
        aria-label="Open booking page"
      >
        <SettingsIcon name="externalLink" className="h-4 w-4" />
      </a>
      <button
        type="button"
        onClick={() => void copyWorkspaceLink()}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-blue-600 transition hover:bg-blue-50"
        aria-label="Copy booking link"
      >
        <SettingsIcon name={linkCopied ? "check" : "copy"} className="h-4 w-4" />
      </button>
    </div>
  );

  const settings_input_class =
    "h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-medium outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60";

  const settings_select_class = settings_input_class;

  const handleAddressLineChange = (value: string) => {
    setAddressLine(value);
    setAddress(value);
  };

  const handleAddressPlaceSelect = (parsed: parsed_address) => {
    setAddressLine(parsed.formattedAddress);
    setAddress(parsed.address);
    setCity(parsed.city);
    setAddressState(parsed.state);
    setZipcode(parsed.zipcode);
    setCountry(parsed.country);
  };

  return (
    <main className="min-h-screen min-w-0 max-w-full text-slate-900">
      <div className="mx-auto min-w-0 max-w-full space-y-6">
        <form onSubmit={handleSubmit} className="min-w-0 max-w-full">
          <section className="min-w-0 max-w-full rounded-[2rem]">
            <div className="bg-blue-600 px-6 py-6 text-white md:px-8">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <SettingsIcon name="building" className="mt-0.5 h-5 w-5 shrink-0" />
                  <div>
                    <h1 className="text-xl font-bold md:text-2xl">Workspace Settings</h1>
                    <p className="mt-1 max-w-2xl text-sm text-blue-100 md:text-base">
                      {isReadOnly
                        ? "View workspace profile, booking link, branding, and booking rules."
                        : isServiceProvider
                          ? "Update your personal provider booking link. Other workspace settings are managed by your admin."
                          : "Manage your account, branding, preferences and booking experience."}
                    </p>
                  </div>
                </div>

                <Link
                  href="/change-password"
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                >
                  <SettingsIcon name="lock" className="h-4 w-4" />
                  Change Password
                </Link>
              </div>
            </div>

            {(isReadOnly || isServiceProvider) && (
              <div
                className={`mx-5 mt-5 rounded-2xl border px-4 py-3 text-sm font-medium md:mx-8 ${
                  isReadOnly
                    ? "border-amber-200 bg-amber-50 text-amber-900"
                    : "border-indigo-200 bg-indigo-50 text-indigo-900"
                }`}
              >
                {isReadOnly
                  ? "You have view-only access to workspace settings."
                  : "You can edit only your provider booking link on this page."}
              </div>
            )}

            <div className="grid min-w-0 max-w-full gap-6 py-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
              <div className="min-w-0 space-y-5">
                <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <SettingsIcon name="user" className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-950">
                          Account Details
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Basic information about your workspace
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                      Active
                    </span>
                  </div>

                  <div className="grid gap-5">
                    <div className="grid gap-5 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-700">
                          Workspace Name
                        </span>
                        <input
                          type="text"
                          value={accountName}
                          onChange={(e) => setAccountName(e.target.value)}
                          disabled={nonLinkFieldsDisabled}
                          className={settings_input_class}
                          placeholder="Enter workspace name"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-700">
                          {isServiceProvider ? "Provider Link" : "Workspace Link"}
                        </span>
                        {isServiceProvider ? (
                          <>
                            <div className={link_field_class(Boolean(linkError))}>
                              <div className={link_prefix_class}>
                                <SettingsIcon name="link" className="h-4 w-4 shrink-0" />
                                <span className="truncate">
                                  {bookingHost}/{workspaceSlug || "workspace"}/
                                </span>
                              </div>
                              <div className="relative min-w-0 flex-1">
                                <input
                                  type="text"
                                  value={serviceProviderSlug}
                                  onChange={(e) => {
                                    setServiceProviderSlug(e.target.value);
                                    if (linkError) setLinkError(null);
                                  }}
                                  disabled={!canEditProviderSlug}
                                  className={link_slug_input_class}
                                  placeholder="your-provider-link"
                                  required={canEditProviderSlug}
                                  aria-invalid={linkError ? true : undefined}
                                />
                                {link_action_buttons}
                              </div>
                            </div>
                            {linkError ? (
                              <p className="mt-2 text-sm font-medium text-red-600">
                                {linkError}
                              </p>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <div className={link_field_class(Boolean(linkError))}>
                              <div className={link_prefix_class}>
                                <SettingsIcon name="link" className="h-4 w-4 shrink-0" />
                                <span className="truncate">{bookingHost}/</span>
                              </div>
                              <div className="relative min-w-0 flex-1">
                                <input
                                  type="text"
                                  value={workspaceSlug}
                                  onChange={(e) => {
                                    setWorkspaceSlug(e.target.value);
                                    if (linkError) setLinkError(null);
                                  }}
                                  disabled={!canEditAllSettings}
                                  className={link_slug_input_class}
                                  placeholder="your-link"
                                  required={canEditAllSettings}
                                  aria-invalid={linkError ? true : undefined}
                                />
                                {link_action_buttons}
                              </div>
                            </div>
                            {linkError ? (
                              <p className="mt-2 text-sm font-medium text-red-600">
                                {linkError}
                              </p>
                            ) : null}
                          </>
                        )}
                      </label>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <span className="mb-2 block text-sm font-bold text-slate-700">
                          Public Booking Page
                        </span>
                        <a
                          href={publicBookingUrl ?? undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1.5 break-all text-sm font-medium text-blue-600 hover:underline"
                        >
                          {previewUrl}
                          <SettingsIcon name="externalLink" className="h-4 w-4" />
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => void shareBookingPage()}
                        disabled={!publicBookingUrl}
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <SettingsIcon name="share" className="h-4 w-4" />
                        Share
                      </button>
                    </div>
                    {shareNotice ? (
                      <p className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700">
                        {shareNotice}
                      </p>
                    ) : null}

                    <div className="grid gap-5 md:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-700">
                          Business Email
                        </span>
                        <input
                          type="email"
                          value={businessEmail}
                          onChange={(e) => setBusinessEmail(e.target.value)}
                          disabled={nonLinkFieldsDisabled}
                          className={settings_input_class}
                          placeholder="you@company.com"
                        />
                      </label>
                      <div className="block min-w-0">
                        <span className="mb-2 block text-sm font-bold text-slate-700">
                          Business Phone
                        </span>
                        <div
                          id="business-phone"
                          className={
                            nonLinkFieldsDisabled
                              ? "settings-phone-input booking-phone-input pointer-events-none min-w-0 max-w-full opacity-60"
                              : "settings-phone-input booking-phone-input min-w-0 max-w-full"
                          }
                        >
                          <BookingPhoneInput
                            value={businessPhone}
                            onChange={setBusinessPhone}
                            profileCountry={
                              user?.user_metadata?.country as string | undefined
                            }
                          />
                        </div>
                      </div>
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">
                        Address
                      </span>
                      <AddressAutocompleteInput
                        value={addressLine}
                        onChange={handleAddressLineChange}
                        onPlaceSelect={handleAddressPlaceSelect}
                        disabled={nonLinkFieldsDisabled}
                        placeholder="Start typing your address…"
                        className={settings_input_class}
                      />
                    </label>
                  </div>
                </div>

                <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-5 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <SettingsIcon name="palette" className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-950">
                        Logo &amp; Branding
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Upload logo and add tagline for your booking pages
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:items-start">
                    <div>
                      <span className="mb-2 block text-sm font-bold text-slate-700">
                        Logo
                      </span>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-2">
                          <WorkspaceBrandLogo
                            src={resolve_workspace_logo_src(logoUrl)}
                            alt="Logo preview"
                            width={64}
                            height={64}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <label
                          className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-blue-600 transition ${
                            canEditAllSettings
                              ? "cursor-pointer hover:border-blue-200 hover:bg-blue-50"
                              : "cursor-not-allowed opacity-60"
                          }`}
                        >
                          <SettingsIcon name="refresh" className="h-4 w-4" />
                          {isUploadingLogo ? "Uploading…" : "Change"}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            onChange={handleLogoChange}
                            disabled={isUploadingLogo || !canEditAllSettings}
                            className="hidden"
                          />
                        </label>
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        Recommended: PNG, JPG (300x300px)
                      </p>
                      {logoUrl && canEditAllSettings ? (
                        <button
                          type="button"
                          onClick={handleLogoRemove}
                          disabled={isUploadingLogo}
                          className="mt-1 text-xs font-medium text-slate-500 transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Remove logo
                        </button>
                      ) : null}
                    </div>

                    <label className="block">
                      <span className="mb-2 block text-sm font-bold text-slate-700">
                        Tagline
                      </span>
                      <input
                        type="text"
                        value={tagline}
                        onChange={(e) => setTagline(e.target.value)}
                        disabled={nonLinkFieldsDisabled}
                        className={settings_input_class}
                        placeholder="Book appointments with ease"
                        maxLength={TAGLINE_MAX_LENGTH}
                      />
                      <p className="mt-2 text-xs text-slate-500">
                        {tagline.length}/{TAGLINE_MAX_LENGTH} characters
                        {tagline.length > 0
                          ? ` · ${TAGLINE_MAX_LENGTH - tagline.length} remaining`
                          : ""}
                      </p>
                    </label>
                  </div>
                </div>

                <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-5 flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                      <SettingsIcon name="globe" className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-slate-950">
                        Regional Preferences
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Set your timezone, language and date/time formats
                      </p>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div className="grid gap-5 lg:grid-cols-3">
                      <label className="block">
                        <span className="mb-2 block text-sm font-bold text-slate-700">
                          Timezone
                        </span>
                        <select
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                          disabled={nonLinkFieldsDisabled}
                          className={settings_select_class}
                        >
                          <option value="">Use visitor&apos;s timezone</option>
                          {TIMEZONE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {format_regional_timezone_option(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <SelectField
                        label="Date Format"
                        value={dateFormat}
                        setValue={setDateFormat}
                        options={[...DATE_FORMAT_OPTIONS]}
                        disabled={nonLinkFieldsDisabled}
                        className={settings_select_class}
                      />
                      <SelectField
                        label="Time Format"
                        value={timeFormat}
                        setValue={setTimeFormat}
                        options={[...TIME_FORMAT_OPTIONS]}
                        optionLabels={TIME_FORMAT_LABELS}
                        disabled={nonLinkFieldsDisabled}
                        className={settings_select_class}
                      />
                    </div>

                    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                      <SelectField
                        label="Language"
                        value={language}
                        setValue={setLanguage}
                        options={[...LANGUAGE_OPTIONS]}
                        disabled={nonLinkFieldsDisabled}
                        className={settings_select_class}
                      />
                      <SelectField
                        label="Currency"
                        value={currency}
                        setValue={setCurrency}
                        options={[...CURRENCY_OPTIONS]}
                        getOptionLabel={currency_option_label}
                        disabled={nonLinkFieldsDisabled}
                        className={settings_select_class}
                      />
                    </div>
                  </div>
                </div>

                <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-5">
                    <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
                      <SettingsIcon
                        name="shield"
                        className="h-5 w-5 text-indigo-600"
                      />{" "}
                      Booking Rules &amp; Notifications
                    </h2>
                    <p className="mt-1 break-words text-sm text-slate-500">
                      Important SaaS controls for booking flow, reminders, and
                      customer actions.
                    </p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    <ToggleRow
                      label="Auto confirm new bookings"
                      value={autoConfirm}
                      setValue={setAutoConfirm}
                      disabled={nonLinkFieldsDisabled}
                    />
                    <ToggleRow
                      label="Allow customer reschedule"
                      value={allowReschedule}
                      setValue={setAllowReschedule}
                      disabled={nonLinkFieldsDisabled}
                    />
                    <ToggleRow
                      label="Allow customer cancellation"
                      value={allowCancellation}
                      setValue={setAllowCancellation}
                      disabled={nonLinkFieldsDisabled}
                    />
                    <ToggleRow
                      label="Email reminders"
                      value={emailReminder}
                      setValue={setEmailReminder}
                      disabled={nonLinkFieldsDisabled}
                    />
                    <ToggleRow
                      label="SMS reminders"
                      value={smsReminder}
                      setValue={setSmsReminder}
                      disabled={nonLinkFieldsDisabled}
                    />
                    <ToggleRow
                      label="WhatsApp reminders"
                      value={whatsappReminder}
                      setValue={setWhatsappReminder}
                      disabled={nonLinkFieldsDisabled}
                    />
                  </div>
                </div>

                <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <SettingsIcon name="palette" className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-lg font-bold text-slate-950">
                          Brand Appearance
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Customize the look and feel of your public booking pages
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
                      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-lg shadow-amber-300/60 ring-2 ring-amber-400/50 ring-offset-2">
                        <SettingsIcon name="sparkles" className="h-4 w-4" />
                        Coming Soon!
                      </span>
                      {/* <a
                        href={publicBookingUrl ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-white px-4 py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50 disabled:pointer-events-none disabled:opacity-50"
                        aria-disabled={!publicBookingUrl}
                        onClick={(event) => {
                          if (!publicBookingUrl) event.preventDefault();
                        }}
                      >
                        <SettingsIcon name="eye" className="h-4 w-4" />
                        Preview Booking Page
                      </a> */}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-x-8">
                    <ColorRow
                      label="Primary Color"
                      color={primaryColor}
                      setColor={setPrimaryColor}
                      disabled={nonLinkFieldsDisabled}
                    />
                    <ColorRow
                      label="Accent Color (CTA / Highlights)"
                      labelClassName="w-[8.5rem] sm:w-[9.5rem]"
                      color={accentColor}
                      setColor={setAccentColor}
                      disabled={nonLinkFieldsDisabled}
                    />
                    <ToggleRow
                      label="Use gradient background"
                      value={useGradientBookingBg}
                      setValue={setUseGradientBookingBg}
                      disabled={nonLinkFieldsDisabled}
                      layout="inline"
                    />
                    <ToggleRow
                      label="Enable rounded UI style (modern look)"
                      value={roundedUiStyle}
                      setValue={setRoundedUiStyle}
                      disabled={nonLinkFieldsDisabled}
                      layout="inline"
                    />
                  </div>

                  <div className="mt-5 rounded-2xl bg-blue-50 p-5">
                    <p className="text-sm font-bold text-slate-900">
                      Recommended for MVP
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {[
                        "High contrast for accessibility",
                        "Fast booking flow",
                        "Light / dark mode ready",
                        "Trusted & professional feel",
                        "Consistent brand identity",
                        "Better customer experience",
                      ].map((item) => (
                        <div
                          key={item}
                          className="flex items-center gap-2.5 text-sm text-slate-700"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                            <SettingsIcon name="check" className="h-3 w-3" />
                          </span>
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <aside className="min-w-0 space-y-5 lg:sticky lg:top-6 lg:self-start">
                <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                  <div className="mb-4">
                    <h3 className="text-lg font-bold text-slate-950">
                      Live Booking Preview
                    </h3>
                    <p className="mt-1 text-sm text-slate-500">
                      This is how your booking page looks
                    </p>
                  </div>

                  <div
                    className={`flex flex-col items-center px-5 py-10 text-center text-white ${
                      roundedUiStyle ? "rounded-3xl" : "rounded-lg"
                    }`}
                    style={{
                      background: useGradientBookingBg
                        ? `linear-gradient(135deg, ${primaryColor}, ${accentColor})`
                        : primaryColor,
                    }}
                  >
                    <div
                      className={`mb-4 flex h-16 w-16 items-center justify-center bg-white/20 text-2xl font-bold text-white shadow-inner ring-1 ring-white/30 ${
                        roundedUiStyle ? "rounded-full" : "rounded-xl"
                      }`}
                      aria-hidden
                    >
                      {workspace_name_initial(accountName)}
                    </div>
                    <h4 className="text-lg font-bold leading-snug">
                      {accountName.trim() || "Workspace Name"}
                    </h4>
                    <p className="mt-2 max-w-xs text-sm font-medium text-white/90">
                      {tagline.trim() || "Book appointments with ease"}
                    </p>
                    <button
                      type="button"
                      onClick={open_create_booking}
                      className={`mt-6 w-full max-w-xs px-4 py-3 text-sm font-bold shadow-lg transition hover:-translate-y-0.5 ${
                        roundedUiStyle ? "rounded-2xl" : "rounded-md"
                      }`}
                      style={{ backgroundColor: "#ffffff", color: primaryColor }}
                    >
                      Book Appointment
                    </button>
                  </div>
                </div>

                <div className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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

            {canSave ? (
              <div className="bottom-0 border-t border-slate-200 bg-white/90 px-5 py-4 backdrop-blur md:px-8">
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
                    {isSaving
                      ? "Saving…"
                      : isServiceProvider
                        ? "Save Provider Link"
                        : "Save Changes"}
                  </button>
                </div>
              </div>
            ) : null}
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
  disabled = false,
  className,
  optionLabels,
  getOptionLabel,
}: {
  label: string;
  value: string;
  setValue: (value: string) => void;
  options: string[];
  disabled?: boolean;
  className?: string;
  optionLabels?: Record<string, string>;
  getOptionLabel?: (option: string) => string;
}) {
  const selectClassName =
    className ??
    "h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base font-medium outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <label className="block min-w-0">
      <span className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={disabled}
        className={selectClassName}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {getOptionLabel?.(option) ?? optionLabels?.[option] ?? option}
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
  disabled = false,
  layout = "card",
}: {
  label: string;
  value: boolean;
  setValue: (value: boolean) => void;
  disabled?: boolean;
  layout?: "card" | "inline";
}) {
  const switchControl = (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={label}
      onClick={() => {
        if (!disabled) setValue(!value);
      }}
      disabled={disabled}
      className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60 ${
        value ? "bg-blue-600" : "bg-slate-300"
      }`}
    >
      <span
        className={`pointer-events-none absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
          value ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );

  if (layout === "inline") {
    return (
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <span className="min-w-0 text-sm font-bold leading-snug text-slate-800 sm:flex-1">
          {label}
        </span>
        {switchControl}
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 transition hover:border-indigo-200 hover:bg-indigo-50 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 sm:gap-4 sm:px-4">
      <span className="min-w-0 flex-1 text-sm font-bold leading-snug text-slate-700">
        {label}
      </span>
      {switchControl}
    </div>
  );
}

function ColorRow({
  label,
  color,
  setColor,
  disabled = false,
  labelClassName = "w-[6.75rem] sm:w-[7.5rem]",
}: {
  label: string;
  color: string;
  setColor: (value: string) => void;
  disabled?: boolean;
  labelClassName?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 md:gap-4">
      <span
        className={`text-sm font-bold leading-snug text-slate-800 sm:shrink-0 ${labelClassName}`}
      >
        {label}
      </span>
      <div className="flex h-11 min-w-0 w-full flex-1 items-stretch gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5">
        <label
          className={`relative min-w-0 flex-[2] overflow-hidden rounded-lg ${
            disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
          }`}
        >
          <span
            className="block h-full w-full rounded-lg"
            style={{ backgroundColor: color }}
            aria-hidden
          />
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            disabled={disabled}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            aria-label={`${label} picker`}
          />
        </label>
        <input
          type="text"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          disabled={disabled}
          className="min-w-[5.25rem] flex-1 border-0 bg-transparent px-1 text-sm font-medium text-slate-700 outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60 sm:px-2"
          spellCheck={false}
        />
      </div>
    </div>
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
    trash: (
      <>
        <path d="M3 6h18" />
        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
      </>
    ),
    user: (
      <>
        <path d="M20 21a8 8 0 0 0-16 0" />
        <circle cx="12" cy="7" r="4" />
      </>
    ),
    externalLink: (
      <>
        <path d="M15 3h6v6" />
        <path d="M10 14 21 3" />
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      </>
    ),
    copy: (
      <>
        <rect x="9" y="9" width="13" height="13" rx="2" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
      </>
    ),
    share: (
      <>
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.59 13.51 6.83 3.98" />
        <path d="M15.41 6.51l-6.82 3.98" />
      </>
    ),
    refresh: (
      <>
        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
        <path d="M16 16h5v5" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  };

  return <svg {...common}>{paths[name]}</svg>;
}
