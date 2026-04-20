"use client";

import { useMemo, useState, useEffect, useRef, type FormEvent } from "react";
import {
  LuCalendarDays as CalendarDays,
  LuClock3 as Clock3,
  LuCopy as Copy,
  LuPencil as Edit3,
  LuLink2 as Link2,
  LuMapPin as MapPin,
  LuPlus as Plus,
  LuSearch as Search,
  LuShield as Shield,
  LuTrash2 as Trash2,
  LuUsers as Users,
  LuVideo as Video,
  LuPhoneCall as PhoneCall,
  LuBriefcase as Briefcase,
  LuX as X,
  LuSettings2 as Settings2,
  LuCircleCheckBig as CheckCircle2,
  LuRotateCcw as RotateCcw,
} from "react-icons/lu";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/src/providers/AuthProvider";
import { AlertModal } from "@/src/components/ui/AlertModal";
import { ConfirmModal } from "@/src/components/ui/ConfirmModal";
import { EventTypeSkeleton } from "@/src/components/ui/EventTypeSkeleton";
import {
  EventTypeFormLayout,
  split_duration_minutes,
  total_duration_minutes,
  type event_type_form_state,
} from "@/src/features/event-types/EventTypeFormLayout";

interface EventType {
  id: number;
  title: string;
  slug: string;
  duration_minutes: number | null;
  buffer_before: number | null;
  buffer_after: number | null;
  location_type: string | null;
  location_value: any;
  is_public: boolean | null;
  settings: any;
  created_at: string;
  bookings_count?: number | null;
}

const CARD_GRADIENTS = [
  "from-cyan-500 to-sky-600",
  "from-violet-500 to-indigo-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-blue-500 to-indigo-600",
] as const;

type event_type_location = "video" | "phone" | "in_person" | "custom";

type event_settings_state = {
  default_visibility: "private" | "public";
  default_location: event_type_location;
  admin_notice: string;
};

const DEFAULT_EVENT_SETTINGS: event_settings_state = {
  default_visibility: "public",
  default_location: "video",
  admin_notice:
    "These settings will be used as default values while creating new event types.",
};

const USER_META_EVENT_TYPE_SETTINGS_KEY = "event_type_settings";

const ALLOWED_VISIBILITIES = new Set<event_settings_state["default_visibility"]>([
  "private",
  "public",
]);
const ALLOWED_LOCATIONS = new Set<event_type_location>([
  "video",
  "phone",
  "in_person",
  "custom",
]);

function normalize_event_settings(
  raw: unknown
): event_settings_state | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;
  const visibility =
    typeof source.default_visibility === "string" &&
    ALLOWED_VISIBILITIES.has(
      source.default_visibility as event_settings_state["default_visibility"]
    )
      ? (source.default_visibility as event_settings_state["default_visibility"])
      : DEFAULT_EVENT_SETTINGS.default_visibility;
  const location =
    typeof source.default_location === "string" &&
    ALLOWED_LOCATIONS.has(source.default_location as event_type_location)
      ? (source.default_location as event_type_location)
      : DEFAULT_EVENT_SETTINGS.default_location;
  const notice =
    typeof source.admin_notice === "string"
      ? source.admin_notice
      : DEFAULT_EVENT_SETTINGS.admin_notice;
  return {
    default_visibility: visibility,
    default_location: location,
    admin_notice: notice,
  };
}

/**
 * Pick a default location from workspace `meeting_options`. Order matters:
 * in_person → phone_call → google_meet. First true wins. WhatsApp is ignored.
 */
function workspace_meeting_options_to_location(
  meeting_options: unknown
): event_type_location | null {
  if (!meeting_options || typeof meeting_options !== "object") return null;
  const opts = meeting_options as Record<string, unknown>;
  if (opts.in_person === true) return "in_person";
  if (opts.phone_call === true) return "phone";
  if (opts.google_meet === true) return "video";
  return null;
}

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function get_card_gradient(id: number): string {
  return CARD_GRADIENTS[Math.abs(id) % CARD_GRADIENTS.length];
}

function get_location_label(location: string | null): string {
  switch (location) {
    case "video":
      return "Video Call";
    case "phone":
      return "Phone Call";
    case "in_person":
      return "In Person";
    case "custom":
      return "Custom";
    default:
      return "Not set";
  }
}

function get_location_icon(location: string | null) {
  switch (location) {
    case "video":
      return <Video className="h-4 w-4" />;
    case "phone":
      return <PhoneCall className="h-4 w-4" />;
    case "in_person":
      return <MapPin className="h-4 w-4" />;
    case "custom":
      return <Briefcase className="h-4 w-4" />;
    default:
      return <MapPin className="h-4 w-4" />;
  }
}

function format_duration(totalMinutes: number | null): string {
  if (totalMinutes == null) return "—";
  if (totalMinutes < 60) return `${totalMinutes} minutes`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (m === 0) return `${h} hour${h === 1 ? "" : "s"}`;
  return `${h}h ${m}m`;
}

export default function EventTypes() {
  const { user } = useAuth();
  const [items, setItems] = useState<EventType[]>([]);
  const [totalBookings, setTotalBookings] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [workspaceSlug, setWorkspaceSlug] = useState<string>("");
  const [loadingSlug, setLoadingSlug] = useState(true);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [alertMessage, setAlertMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [visibility_filter, set_visibility_filter] = useState<
    "all" | "private" | "public"
  >("all");
  const [settings_open, set_settings_open] = useState(false);
  const [settings_saved_message, set_settings_saved_message] = useState("");
  const [event_settings, set_event_settings] = useState<event_settings_state>(
    DEFAULT_EVENT_SETTINGS
  );
  const [settings_loaded, set_settings_loaded] = useState(false);
  const [settings_saving, set_settings_saving] = useState(false);
  const submitInFlightRef = useRef(false);

  const empty_form = (): event_type_form_state => {
    const default_location_for_form =
      event_settings.default_location === "custom"
        ? ""
        : event_settings.default_location;
    return {
      title: "",
      duration_hours: "",
      duration_minutes_part: "",
      buffer_before: "",
      buffer_after: "",
      location_type: default_location_for_form,
      is_public: event_settings.default_visibility === "public",
    };
  };

  const [form, setForm] = useState<event_type_form_state>(empty_form);

  const fetchWorkspaceSlug = async () => {
    setLoadingSlug(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const response = await fetch("/api/workspace/slug", {
        method: "GET",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) return;
      const result = await response.json();
      if (result.slug) setWorkspaceSlug(result.slug);
    } catch (err) {
      console.error("Exception fetching workspace slug:", err);
    } finally {
      setLoadingSlug(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchEventTypes();
    fetchWorkspaceSlug();
    load_event_settings();
  }, [user]);

  const load_event_settings = async () => {
    try {
      const from_meta = normalize_event_settings(
        user?.user_metadata?.[USER_META_EVENT_TYPE_SETTINGS_KEY]
      );
      if (from_meta) {
        set_event_settings(from_meta);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;
      const response = await fetch("/api/settings", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) return;
      const body = await response.json();
      const workspace_settings = (body?.settings ?? {}) as Record<string, unknown>;
      const location_from_workspace = workspace_meeting_options_to_location(
        workspace_settings.meeting_options
      );
      if (location_from_workspace) {
        set_event_settings((prev) => ({
          ...prev,
          default_location: location_from_workspace,
        }));
      }
    } catch (err) {
      console.error("Failed to load event type settings:", err);
    } finally {
      set_settings_loaded(true);
    }
  };

  const fetchEventTypes = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }
      const response = await fetch("/api/event-types", {
        method: "GET",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) {
        setLoading(false);
        return;
      }
      const result = await response.json();
      setItems(result.data || []);
      if (typeof result.total_bookings_count === "number") {
        setTotalBookings(result.total_bookings_count);
      } else {
        setTotalBookings(
          (result.data || []).reduce(
            (sum: number, item: EventType) => sum + (item.bookings_count ?? 0),
            0
          )
        );
      }
    } catch (err) {
      console.error("Error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.title.trim()) return;

    const durationMinutes = total_duration_minutes(
      form.duration_hours,
      form.duration_minutes_part
    );
    if (durationMinutes < 1) {
      setFormError(
        "Duration must be at least 1 minute (set hours and/or minutes)."
      );
      return;
    }

    if (submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setFormError("You are not signed in. Please refresh and try again.");
        return;
      }

      const payload = {
        title: form.title,
        duration_minutes: durationMinutes,
        buffer_before: form.buffer_before || null,
        buffer_after: form.buffer_after || null,
        location_type: form.location_type || null,
        is_public: form.is_public,
      };

      if (editingId) {
        const response = await fetch("/api/event-types", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ id: editingId, ...payload }),
        });

        if (!response.ok) {
          const error = await response.json();
          setFormError(
            typeof error?.error === "string"
              ? error.error
              : "Could not update event type."
          );
          return;
        }

        const result = await response.json();
        setItems((prev) =>
          prev.map((item) => (item.id === editingId ? result.data : item))
        );
        setEditingId(null);
      } else {
        const response = await fetch("/api/event-types", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json();
          setFormError(
            typeof error?.error === "string"
              ? error.error
              : "Could not create event type."
          );
          return;
        }

        const result = await response.json();
        setItems((prev) => [result.data, ...prev]);
      }

      setForm(empty_form());
      setShowForm(false);
      setFormError(null);
      await fetchEventTypes();
    } catch (err) {
      console.error("Error:", err);
      setFormError("Something went wrong. Please try again.");
    } finally {
      submitInFlightRef.current = false;
      setSubmitting(false);
    }
  };

  const handleEdit = (item: EventType) => {
    setFormError(null);
    setEditingId(item.id);
    const { duration_hours, duration_minutes_part } = split_duration_minutes(
      item.duration_minutes ?? undefined
    );
    setForm({
      title: item.title,
      duration_hours,
      duration_minutes_part,
      buffer_before: item.buffer_before?.toString() || "",
      buffer_after: item.buffer_after?.toString() || "",
      location_type: item.location_type || "",
      is_public: item.is_public || false,
    });
    setShowForm(true);
  };

  const handleDeleteClick = (id: number) => setDeleteConfirmId(id);

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setDeleteConfirmId(null);
        setAlertMessage("Not authenticated");
        return;
      }
      const response = await fetch(
        `/api/event-types?id=${deleteConfirmId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );
      if (!response.ok) {
        const error = await response.json();
        setDeleteConfirmId(null);
        setAlertMessage(error?.error || "Failed to delete event type");
        return;
      }
      setItems((prev) =>
        prev.filter((item) => item.id !== deleteConfirmId)
      );
      setDeleteConfirmId(null);
    } catch (err) {
      console.error("Error:", err);
      setDeleteConfirmId(null);
      setAlertMessage("An error occurred while deleting the event type");
    }
  };

  const handleCancel = () => {
    setForm(empty_form());
    setFormError(null);
    setShowForm(false);
    setEditingId(null);
  };

  const handleNewEvent = () => {
    setForm(empty_form());
    setFormError(null);
    setEditingId(null);
    setShowForm(true);
  };

  const handleDuplicate = async (item: EventType) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setAlertMessage("Not authenticated");
        return;
      }
      const payload = {
        title: `${item.title} Copy`,
        duration_minutes: item.duration_minutes,
        buffer_before: item.buffer_before,
        buffer_after: item.buffer_after,
        location_type: item.location_type,
        is_public: item.is_public ?? false,
      };
      const response = await fetch("/api/event-types", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const error = await response.json();
        setAlertMessage(error?.error || "Failed to duplicate event type");
        return;
      }
      const result = await response.json();
      setItems((prev) => [result.data, ...prev]);
    } catch (err) {
      console.error("Error duplicating:", err);
      setAlertMessage("Failed to duplicate event type");
    }
  };

  const handleCopyLink = async (item: EventType) => {
    if (!workspaceSlug) {
      setAlertMessage(
        "Unable to copy link. Workspace slug is not loaded yet. Please try again."
      );
      return;
    }
    if (!item.slug) {
      setAlertMessage(
        `Unable to copy link. Event type "${item.title}" does not have a slug. Please edit and save the event type to generate a slug.`
      );
      return;
    }
    const embedLink = `${window.location.origin}/${workspaceSlug}/${item.slug}`;
    try {
      await navigator.clipboard.writeText(embedLink);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy link:", err);
      setAlertMessage("Failed to copy link. Please try again.");
    }
  };

  const handle_save_settings = async () => {
    if (settings_saving) return;
    set_settings_saving(true);
    try {
      const current_metadata =
        (user?.user_metadata ?? {}) as Record<string, unknown>;
      const { error } = await supabase.auth.updateUser({
        data: {
          ...current_metadata,
          [USER_META_EVENT_TYPE_SETTINGS_KEY]: {
            default_visibility: event_settings.default_visibility,
            default_location: event_settings.default_location,
            admin_notice: event_settings.admin_notice,
          },
        },
      });
      if (error) {
        set_settings_saved_message(
          error.message || "Failed to save settings. Please try again."
        );
      } else {
        set_settings_saved_message("View settings saved successfully.");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save settings.";
      set_settings_saved_message(message);
    } finally {
      set_settings_saving(false);
      setTimeout(() => set_settings_saved_message(""), 2500);
    }
  };

  const handle_reset_settings = () => {
    set_event_settings(DEFAULT_EVENT_SETTINGS);
    set_settings_saved_message("Settings reset to default values.");
    setTimeout(() => set_settings_saved_message(""), 2500);
  };

  const total_event_types = items.length;
  const private_event_types = items.filter((e) => !e.is_public).length;
  const public_event_types = items.filter((e) => e.is_public).length;
  const total_bookings = totalBookings;

  const filtered_items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      const matches_search =
        q === "" ||
        item.title.toLowerCase().includes(q) ||
        (item.slug ?? "").toLowerCase().includes(q);
      const is_public = !!item.is_public;
      const matches_visibility =
        visibility_filter === "all" ||
        (visibility_filter === "public" && is_public) ||
        (visibility_filter === "private" && !is_public);
      return matches_search && matches_visibility;
    });
  }, [items, search, visibility_filter]);

  if (showForm) {
    return (
      <section className="space-y-6 mr-auto rounded-2xl">
        <EventTypeFormLayout
          value={form}
          onChange={(next) => {
            setForm(next);
            if (formError) setFormError(null);
          }}
          editingId={editingId}
          formError={formError}
          submitting={submitting}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </section>
    );
  }

  return (
    <section className="space-y-6">
      {/* Hero Header */}
      <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-sky-50 via-cyan-50 to-indigo-50" />
          <div className="relative flex flex-col gap-5 px-6 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-lg shadow-cyan-100">
                <CalendarDays className="h-7 w-7" />
              </div>
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white/80 px-3 py-1 text-xs font-semibold text-sky-700">
                  <span className="h-2 w-2 rounded-full bg-sky-500" />
                  Booking Setup
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Event Type Management
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-600 sm:text-base">
                  Create and manage booking event types for consultations, quick
                  calls, meetings, and custom appointment flows.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => set_settings_open(true)}
                className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Settings2 className="mr-2 h-4 w-4" />
                View Settings
              </button>
              <button
                type="button"
                onClick={handleNewEvent}
                className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-100 transition hover:scale-[1.01]"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Event Type
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">
                Total Event Types
              </p>
              <h3 className="mt-2 text-3xl font-bold text-slate-900">
                {total_event_types}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
              <CalendarDays className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Private Types</p>
              <h3 className="mt-2 text-3xl font-bold text-slate-900">
                {private_event_types}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600">
              <Shield className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Public Types</p>
              <h3 className="mt-2 text-3xl font-bold text-slate-900">
                {public_event_types}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Users className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500">Total Bookings</p>
              <h3 className="mt-2 text-3xl font-bold text-slate-900">
                {total_bookings}
              </h3>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Clock3 className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search event type by name or slug..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {(["all", "private", "public"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => set_visibility_filter(item)}
                className={cn(
                  "cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold transition",
                  visibility_filter === item
                    ? "bg-slate-900 text-white shadow-sm"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                {item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <EventTypeSkeleton />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filtered_items.map((item) => {
              const is_public = !!item.is_public;
              return (
                <div
                  key={item.id}
                  className="group overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60"
                >
                  <div
                    className={cn(
                      "h-1.5 w-full bg-gradient-to-r",
                      get_card_gradient(item.id)
                    )}
                  />

                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate text-xl font-bold text-slate-900">
                          {item.title}
                        </h3>
                        {item.slug && (
                          <p className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                            {item.slug}
                          </p>
                        )}
                      </div>

                      <span
                        className={cn(
                          "inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold",
                          is_public
                            ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                            : "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200"
                        )}
                      >
                        {is_public ? "Public" : "Private"}
                      </span>
                    </div>

                    <div className="mt-5 space-y-3">
                      <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sky-600 shadow-sm">
                          <Clock3 className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500">
                            Duration
                          </p>
                          <p className="text-sm font-semibold text-slate-800">
                            {format_duration(item.duration_minutes)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-cyan-600 shadow-sm">
                          {get_location_icon(item.location_type)}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500">
                            Location
                          </p>
                          <p className="text-sm font-semibold text-slate-800">
                            {get_location_label(item.location_type)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
                          <Users className="h-4 w-4" />
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500">
                            Bookings
                          </p>
                          <p className="text-sm font-semibold text-slate-800">
                            {item.bookings_count ?? 0} total
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleEdit(item)}
                        className="inline-flex cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        <Edit3 className="mr-2 h-4 w-4" />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleCopyLink(item)}
                        disabled={loadingSlug || !item.slug}
                        className={cn(
                          "inline-flex items-center rounded-xl border px-3.5 py-2 text-sm font-semibold transition",
                          loadingSlug || !item.slug
                            ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                            : copiedId === item.id
                            ? "cursor-pointer border-emerald-300 bg-emerald-600 text-white"
                            : "cursor-pointer border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        )}
                        title={
                          loadingSlug
                            ? "Loading workspace..."
                            : !item.slug
                            ? "No slug available"
                            : "Copy booking link"
                        }
                      >
                        <Link2 className="mr-2 h-4 w-4" />
                        {copiedId === item.id ? "Copied!" : "Copy Link"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDuplicate(item)}
                        className="inline-flex cursor-pointer items-center rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicate
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteClick(item.id)}
                        className="inline-flex cursor-pointer items-center rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add New Card */}
            <button
              type="button"
              onClick={handleNewEvent}
              className="group flex min-h-[320px] cursor-pointer flex-col items-center justify-center rounded-[26px] border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:border-sky-400 hover:bg-sky-50/40 hover:shadow-lg"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition group-hover:bg-sky-100 group-hover:text-sky-700">
                <Plus className="h-7 w-7" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900">
                Create New Event Type
              </h3>
              <p className="mt-2 max-w-xs text-sm text-slate-500">
                Add a new booking type for meetings, consultations, classes, or
                custom appointments.
              </p>
            </button>
          </div>

          {/* Empty State */}
          {filtered_items.length === 0 && items.length > 0 && (
            <div className="rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                <CalendarDays className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-900">
                No event types found
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Try changing your search or filter, or create a new event type.
              </p>
            </div>
          )}
        </>
      )}

      {deleteConfirmId && (
        <ConfirmModal
          title="Delete Event Type"
          message="Are you sure you want to delete this event type? This action cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteConfirmId(null)}
        />
      )}

      {alertMessage && (
        <AlertModal
          message={alertMessage}
          onClose={() => setAlertMessage(null)}
        />
      )}

      {settings_open && (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close settings"
            onClick={() => set_settings_open(false)}
            className="absolute inset-0 cursor-default bg-slate-900/40 backdrop-blur-[2px]"
          />
          <div className="relative ml-auto flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    View Settings
                  </h2>
                  <p className="text-sm text-slate-500">
                    Manage default event type display and booking preferences.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => set_settings_open(false)}
                className="cursor-pointer rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
              {settings_saved_message && (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{settings_saved_message}</span>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Default Setup
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  These values will be used when you create new event types.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Default Visibility
                    </label>
                    <select
                      value={event_settings.default_visibility}
                      onChange={(e) =>
                        set_event_settings((prev) => ({
                          ...prev,
                          default_visibility: e.target.value as
                            | "private"
                            | "public",
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400"
                    >
                      <option value="private">Private</option>
                      <option value="public">Public</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Default Location
                    </label>
                    <select
                      value={event_settings.default_location}
                      onChange={(e) =>
                        set_event_settings((prev) => ({
                          ...prev,
                          default_location: e.target.value as event_type_location,
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400"
                    >
                      <option value="video">Video Call</option>
                      <option value="phone">Phone Call</option>
                      <option value="in_person">In Person</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <label className="mb-2 block text-sm font-bold text-slate-900">
                  Admin Notice
                </label>
                <textarea
                  rows={5}
                  value={event_settings.admin_notice}
                  onChange={(e) =>
                    set_event_settings((prev) => ({
                      ...prev,
                      admin_notice: e.target.value,
                    }))
                  }
                  placeholder="Add an internal note for workspace admins..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white"
                />
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <h3 className="text-sm font-bold text-slate-900">
                  Current Summary
                </h3>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-800">
                      Default visibility:
                    </span>{" "}
                    {event_settings.default_visibility}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">
                      Default location:
                    </span>{" "}
                    {get_location_label(event_settings.default_location)}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <button
                  type="button"
                  onClick={handle_reset_settings}
                  className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </button>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => set_settings_open(false)}
                    className="inline-flex cursor-pointer items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handle_save_settings}
                    disabled={settings_saving}
                    className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-100 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {settings_saving ? "Saving…" : "Save Settings"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
