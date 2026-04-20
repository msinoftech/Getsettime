"use client";

import { useMemo, useState } from "react";
import {
  CalendarDays,
  Clock3,
  Copy,
  Edit3,
  Filter,
  Link2,
  MapPin,
  Plus,
  Search,
  Shield,
  Trash2,
  Users,
  Video,
  PhoneCall,
  Briefcase,
  X,
  Settings2,
  CheckCircle2,
  RotateCcw,
} from "lucide-react";

type EventType = {
  id: number;
  title: string;
  slug: string;
  duration: number;
  location: "google_meet" | "zoom" | "phone" | "in_person" | "custom";
  visibility: "private" | "public";
  bookings: number;
  color: string;
};

type EventSettings = {
  defaultVisibility: "private" | "public";
  defaultLocation: "google_meet" | "zoom" | "phone" | "in_person" | "custom";
  requireConfirmation: boolean;
  bufferTime: number;
  adminNotice: string;
};

const initialEventTypes: EventType[] = [
  {
    id: 1,
    title: "30mins-chat",
    slug: "30mins-chat",
    duration: 30,
    location: "google_meet",
    visibility: "private",
    bookings: 12,
    color: "from-cyan-500 to-sky-600",
  },
  {
    id: 2,
    title: "Quick call",
    slug: "quick-call",
    duration: 70,
    location: "in_person",
    visibility: "private",
    bookings: 8,
    color: "from-violet-500 to-indigo-600",
  },
  {
    id: 3,
    title: "Consultation Session",
    slug: "consultation-session",
    duration: 45,
    location: "phone",
    visibility: "public",
    bookings: 21,
    color: "from-emerald-500 to-teal-600",
  },
];

const defaultSettings: EventSettings = {
  defaultVisibility: "private",
  defaultLocation: "google_meet",
  requireConfirmation: true,
  bufferTime: 15,
  adminNotice:
    "These settings will be used as default values while creating new event types.",
};

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

function getLocationLabel(location: EventType["location"]) {
  switch (location) {
    case "google_meet":
      return "Google Meet";
    case "zoom":
      return "Zoom";
    case "phone":
      return "Phone Call";
    case "in_person":
      return "In Person";
    default:
      return "Custom";
  }
}

function getLocationIcon(location: EventType["location"]) {
  switch (location) {
    case "google_meet":
    case "zoom":
      return <Video className="h-4 w-4" />;
    case "phone":
      return <PhoneCall className="h-4 w-4" />;
    case "in_person":
      return <MapPin className="h-4 w-4" />;
    default:
      return <Briefcase className="h-4 w-4" />;
  }
}

export default function EventTypesPage() {
  const [eventTypes, setEventTypes] = useState<EventType[]>(initialEventTypes);
  const [search, setSearch] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "private" | "public">("all");

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [settings, setSettings] = useState<EventSettings>(defaultSettings);

  const filteredEventTypes = useMemo(() => {
    return eventTypes.filter((item) => {
      const matchesSearch =
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.slug.toLowerCase().includes(search.toLowerCase());

      const matchesVisibility =
        visibilityFilter === "all" ? true : item.visibility === visibilityFilter;

      return matchesSearch && matchesVisibility;
    });
  }, [eventTypes, search, visibilityFilter]);

  const totalEventTypes = eventTypes.length;
  const privateEventTypes = eventTypes.filter((e) => e.visibility === "private").length;
  const publicEventTypes = eventTypes.filter((e) => e.visibility === "public").length;
  const totalBookings = eventTypes.reduce((sum, item) => sum + item.bookings, 0);

  const handleDelete = (id: number) => {
    setEventTypes((prev) => prev.filter((item) => item.id !== id));
  };

  const handleCopyLink = (slug: string) => {
    const link = `https://getsettime.com/book/${slug}`;
    navigator.clipboard.writeText(link);
    alert("Booking link copied successfully");
  };

  const handleDuplicate = (item: EventType) => {
    const newItem: EventType = {
      ...item,
      id: Date.now(),
      title: `${item.title} Copy`,
      slug: `${item.slug}-copy-${Date.now()}`,
    };
    setEventTypes((prev) => [newItem, ...prev]);
  };

  const handleSaveSettings = () => {
    setSavedMessage("View settings saved successfully.");
    setTimeout(() => setSavedMessage(""), 2500);
  };

  const handleResetSettings = () => {
    setSettings(defaultSettings);
    setSavedMessage("Settings reset to default values.");
    setTimeout(() => setSavedMessage(""), 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-sky-50 via-cyan-50 to-indigo-50" />
            <div className="relative flex flex-col gap-5 px-6 py-6 sm:px-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 text-white shadow-lg shadow-cyan-100">
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
                    Create and manage booking event types for consultations, quick calls,
                    meetings, and custom appointment flows.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => setSettingsOpen(true)}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <Settings2 className="mr-2 h-4 w-4" />
                  View Settings
                </button>
                <button className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-100 transition hover:scale-[1.01]">
                  <Plus className="mr-2 h-4 w-4" />
                  New Event Type
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Event Types</p>
                <h3 className="mt-2 text-3xl font-bold text-slate-900">{totalEventTypes}</h3>
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
                <h3 className="mt-2 text-3xl font-bold text-slate-900">{privateEventTypes}</h3>
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
                <h3 className="mt-2 text-3xl font-bold text-slate-900">{publicEventTypes}</h3>
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
                <h3 className="mt-2 text-3xl font-bold text-slate-900">{totalBookings}</h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Clock3 className="h-6 w-6" />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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
              {["all", "private", "public"].map((item) => (
                <button
                  key={item}
                  onClick={() => setVisibilityFilter(item as "all" | "private" | "public")}
                  className={cn(
                    "rounded-xl px-4 py-2 text-sm font-semibold transition",
                    visibilityFilter === item
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

        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filteredEventTypes.map((item) => (
            <div
              key={item.id}
              className="group overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-200/60"
            >
              <div className={cn("h-1.5 w-full bg-gradient-to-r", item.color)} />

              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h3 className="truncate text-xl font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-1 inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {item.slug}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold",
                      item.visibility === "private"
                        ? "bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200"
                        : "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
                    )}
                  >
                    {item.visibility === "private" ? "Private" : "Public"}
                  </span>
                </div>

                <div className="mt-5 space-y-3">
                  <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-sky-600 shadow-sm">
                      <Clock3 className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">Duration</p>
                      <p className="text-sm font-semibold text-slate-800">{item.duration} minutes</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-cyan-600 shadow-sm">
                      {getLocationIcon(item.location)}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">Location</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {getLocationLabel(item.location)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-emerald-600 shadow-sm">
                      <Users className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-slate-500">Bookings</p>
                      <p className="text-sm font-semibold text-slate-800">{item.bookings} total</p>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                    <Edit3 className="mr-2 h-4 w-4" />
                    Edit
                  </button>

                  <button
                    onClick={() => handleCopyLink(item.slug)}
                    className="inline-flex items-center rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    Copy Link
                  </button>

                  <button
                    onClick={() => handleDuplicate(item)}
                    className="inline-flex items-center rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Duplicate
                  </button>

                  <button
                    onClick={() => handleDelete(item.id)}
                    className="inline-flex items-center rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}

          <button className="group flex min-h-[320px] flex-col items-center justify-center rounded-[26px] border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm transition hover:-translate-y-1 hover:border-sky-400 hover:bg-sky-50/40 hover:shadow-lg">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition group-hover:bg-sky-100 group-hover:text-sky-700">
              <Plus className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">Create New Event Type</h3>
            <p className="mt-2 max-w-xs text-sm text-slate-500">
              Add a new booking type for meetings, consultations, classes, or custom appointments.
            </p>
          </button>
        </div>

        {filteredEventTypes.length === 0 && (
          <div className="mt-6 rounded-[24px] border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <CalendarDays className="h-8 w-8" />
            </div>
            <h3 className="mt-4 text-xl font-bold text-slate-900">No event types found</h3>
            <p className="mt-2 text-sm text-slate-500">
              Try changing your search or filter, or create a new event type.
            </p>
          </div>
        )}
      </div>

      {settingsOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="relative ml-auto flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-700">
                  <Settings2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">View Settings</h2>
                  <p className="text-sm text-slate-500">
                    Manage default event type display and booking preferences.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSettingsOpen(false)}
                className="rounded-xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
              {savedMessage && (
                <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{savedMessage}</span>
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-bold text-slate-900">Default Setup</h3>
                <p className="mt-1 text-sm text-slate-500">
                  These values will be used when you create new event types.
                </p>

                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Default Visibility
                    </label>
                    <select
                      value={settings.defaultVisibility}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          defaultVisibility: e.target.value as "private" | "public",
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
                      value={settings.defaultLocation}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          defaultLocation: e.target.value as EventSettings["defaultLocation"],
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400"
                    >
                      <option value="google_meet">Google Meet</option>
                      <option value="zoom">Zoom</option>
                      <option value="phone">Phone Call</option>
                      <option value="in_person">In Person</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-bold text-slate-900">Booking Preferences</h3>
                <div className="mt-4 space-y-4">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        Require confirmation before booking
                      </p>
                      <p className="text-xs text-slate-500">
                        Admin approval will be required for new bookings.
                      </p>
                    </div>

                    <button
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          requireConfirmation: !prev.requireConfirmation,
                        }))
                      }
                      className={cn(
                        "relative h-7 w-12 rounded-full transition",
                        settings.requireConfirmation ? "bg-sky-600" : "bg-slate-300"
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition",
                          settings.requireConfirmation ? "left-6" : "left-1"
                        )}
                      />
                    </button>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Buffer time between bookings
                    </label>
                    <select
                      value={settings.bufferTime}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          bufferTime: Number(e.target.value),
                        }))
                      }
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-sky-400"
                    >
                      <option value={0}>No buffer</option>
                      <option value={5}>5 minutes</option>
                      <option value={10}>10 minutes</option>
                      <option value={15}>15 minutes</option>
                      <option value={30}>30 minutes</option>
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
                  value={settings.adminNotice}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      adminNotice: e.target.value,
                    }))
                  }
                  placeholder="Add an internal note for workspace admins..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-sky-400 focus:bg-white"
                />
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4">
                <h3 className="text-sm font-bold text-slate-900">Current Summary</h3>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-800">Default visibility:</span>{" "}
                    {settings.defaultVisibility}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Default location:</span>{" "}
                    {getLocationLabel(settings.defaultLocation)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Confirmation required:</span>{" "}
                    {settings.requireConfirmation ? "Yes" : "No"}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Buffer time:</span>{" "}
                    {settings.bufferTime === 0 ? "No buffer" : `${settings.bufferTime} minutes`}
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                <button
                  onClick={handleResetSettings}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Reset
                </button>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    onClick={() => setSettingsOpen(false)}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSettings}
                    className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-cyan-100 transition hover:scale-[1.01]"
                  >
                    Save Settings
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}