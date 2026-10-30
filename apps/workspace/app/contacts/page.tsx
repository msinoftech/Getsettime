"use client";

import { getWorkspaceSession } from '@/src/lib/auth_session';
import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

import {
  LuChevronDown,
  LuChevronUp,
  LuFilter,
  LuRefreshCw,
  LuSearch,
  LuSlidersHorizontal,
} from "react-icons/lu";

import { LuEllipsis } from "react-icons/lu";

import type { Contact, FormContact } from "@/src/types/contact";

import { toast } from "@/src/components/ui/toast";

import { ConfirmModal } from "@/src/components/ui/ConfirmModal";

import { ContactTableSkeleton } from "@/src/components/Contacts/ContactTableSkeleton";

import ScreenGate from "@/src/components/ScreenGate";

type contact_source = "Manual" | "Booking" | "Website";

type contact_status = "active" | "inactive";

function toFormContact(c: Contact): FormContact {
  return {
    ...c,

    id: String(c.id),

    name: c.name ?? "",

    email: c.email ?? "",

    phone: c.phone ?? "",

    city: c.city ?? "",

    state: c.state ?? "",

    country: c.country ?? "",
  };
}

function get_contact_source(contact: FormContact): contact_source {
  const meta = contact.metadata;

  if (meta && typeof meta === "object" && meta !== null && "source" in meta) {
    const raw = String((meta as { source?: unknown }).source);

    if (raw === "Booking" || raw === "Website" || raw === "Manual") {
      return raw;
    }
  }

  const tags = contact.tags ?? [];

  if (tags.some((t) => t.toLowerCase().includes("booking"))) {
    return "Booking";
  }

  if (tags.some((t) => t.toLowerCase().includes("website"))) {
    return "Website";
  }

  return "Manual";
}

function get_contact_status(contact: FormContact): contact_status {
  const meta = contact.metadata;

  if (meta && typeof meta === "object" && meta !== null && "status" in meta) {
    const st = String((meta as { status?: unknown }).status).toLowerCase();

    if (st === "inactive") {
      return "inactive";
    }
  }

  if ((contact.tags ?? []).some((t) => t.toLowerCase() === "inactive")) {
    return "inactive";
  }

  return "active";
}

function get_last_booking_label(contact: FormContact): string {
  const meta = contact.metadata;

  if (
    meta &&
    typeof meta === "object" &&
    meta !== null &&
    "last_booking" in meta
  ) {
    const v = (meta as { last_booking?: unknown }).last_booking;

    if (typeof v === "string" && v.trim()) {
      return v;
    }
  }

  return "No booking yet";
}

function get_contact_notes(contact: FormContact): string {
  const meta = contact.metadata;

  if (meta && typeof meta === "object" && meta !== null && "notes" in meta) {
    const v = (meta as { notes?: unknown }).notes;

    if (typeof v === "string" && v.trim()) {
      return v.trim();
    }
  }

  return "No notes added yet.";
}

/** Raw notes string for edit form (empty if none). */
function get_contact_notes_value(contact: FormContact): string {
  const meta = contact.metadata;

  if (meta && typeof meta === "object" && meta !== null && "notes" in meta) {
    const v = (meta as { notes?: unknown }).notes;

    if (typeof v === "string") {
      return v;
    }
  }

  return "";
}

function get_filtered_contacts(
  contacts: FormContact[],

  search: string,

  status_filter: "all" | contact_status,

  source_filter: "all" | contact_source,
) {
  const q = search.trim().toLowerCase();

  return contacts.filter((contact) => {
    const haystack =
      `${contact.name ?? ""} ${contact.email ?? ""} ${contact.phone ?? ""} ${contact.city ?? ""} ${contact.state ?? ""} ${contact.country ?? ""}`.toLowerCase();

    const matches_search = !q || haystack.includes(q);

    const matches_status =
      status_filter === "all" || get_contact_status(contact) === status_filter;

    const matches_source =
      source_filter === "all" || get_contact_source(contact) === source_filter;

    return matches_search && matches_status && matches_source;
  });
}

function get_contact_stats(contacts: FormContact[]) {
  return {
    total: contacts.length,

    active: contacts.filter((c) => get_contact_status(c) === "active").length,

    booking: contacts.filter((c) => get_contact_source(c) === "Booking").length,
  };
}

export default function ContactsCreative() {
  const [contacts, setContacts] = useState<FormContact[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const [search_query, set_search_query] = useState("");

  const [show_modal, set_show_modal] = useState(false);

  const [show_filters, set_show_filters] = useState(false);

  const [status_filter, set_status_filter] = useState<"all" | contact_status>(
    "all",
  );

  const [source_filter, set_source_filter] = useState<"all" | contact_source>(
    "all",
  );

  const [editing_contact, set_editing_contact] = useState<FormContact | null>(
    null,
  );

  const [view_contact, set_view_contact] = useState<FormContact | null>(null);

  const [delete_confirm, set_delete_confirm] = useState<string | null>(null);


  const [openActionsId, setOpenActionsId] = useState<string | null>(null);

  const [form_data, set_form_data] = useState({
    name: "",

    email: "",

    phone: "",

    city: "",

    state: "",

    country: "",

    source: "Manual" satisfies contact_source,

    notes: "",
  });

  const fetch_contacts = useCallback(async () => {
    try {
      setLoading(true);

      setError(null);

      const { session } = await getWorkspaceSession();

      if (!session?.access_token) {
        setError("Not authenticated");

        return;
      }

      const res = await fetch("/api/contacts", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));

        throw new Error(err.error || "Failed to fetch contacts");
      }

      const { contacts: data } = await res.json();

      setContacts((data ?? []).map(toFormContact));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load contacts");

      setContacts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch_contacts();
  }, [fetch_contacts]);

  const filtered_contacts = useMemo(
    () =>
      get_filtered_contacts(
        contacts,

        search_query,

        status_filter,

        source_filter,
      ),

    [contacts, search_query, status_filter, source_filter],
  );

  const stats = useMemo(
    () => get_contact_stats(contacts),

    [contacts],
  );

  const get_initials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);

    if (parts.length >= 2) {
      return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
    }

    return name.trim().charAt(0)?.toUpperCase() ?? "?";
  };

  const handle_add_contact = () => {
    set_editing_contact(null);

    set_form_data({
      name: "",

      email: "",

      phone: "",

      city: "",

      state: "",

      country: "",

      source: "Manual",

      notes: "",
    });

    set_show_modal(true);
  };

  const handle_edit_contact = (contact: FormContact) => {
    set_editing_contact(contact);

    set_form_data({
      name: contact.name ?? "",

      email: contact.email ?? "",

      phone: contact.phone ?? "",

      city: contact.city ?? "",

      state: contact.state ?? "",

      country: contact.country ?? "",

      source: get_contact_source(contact),

      notes: get_contact_notes_value(contact),
    });

    set_show_modal(true);
  };

  const handle_delete_click = (id: string) => set_delete_confirm(id);

  const handle_delete_confirm = async () => {
    if (!delete_confirm) {
      return;
    }

    try {
      const { session } = await getWorkspaceSession();

      if (!session?.access_token) {
        set_delete_confirm(null);

        toast.error("Not authenticated");

        return;
      }

      const deletedContact = contacts.find((c) => c.id === delete_confirm);
      const deletedName = deletedContact?.name?.trim() || "Contact";

      const res = await fetch(`/api/contacts?id=${delete_confirm}`, {
        method: "DELETE",

        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));

        throw new Error(err.error || "Failed to delete");
      }

      setContacts((prev) => prev.filter((c) => c.id !== delete_confirm));

      set_delete_confirm(null);

      toast.success(`"${deletedName}" deleted successfully.`);
    } catch (e) {
      set_delete_confirm(null);

      toast.error(
        e instanceof Error ? e.message : "Failed to delete contact"
      );
    }
  };

  const handle_submit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);

      const { session } = await getWorkspaceSession();

      if (!session?.access_token) {
        toast.error("Not authenticated");
        return;
      }

      const trimmedName = form_data.name.trim();
      if (!trimmedName) {
        toast.error("Contact name is required.");
        return;
      }

      const headers = {
        "Content-Type": "application/json",

        Authorization: `Bearer ${session.access_token}`,
      };

      if (editing_contact) {
        const res = await fetch("/api/contacts", {
          method: "PUT",

          headers,

          body: JSON.stringify({
            id: Number(editing_contact.id),

            name: form_data.name,

            email: form_data.email,

            phone: form_data.phone || null,

            city: form_data.city || null,

            state: form_data.state || null,

            country: form_data.country || null,

            source: form_data.source,

            notes: form_data.notes,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));

          throw new Error(err.error || "Failed to update");
        }

        const { contact } = await res.json();

        setContacts((prev) =>
          prev.map((c) =>
            c.id === editing_contact.id ? toFormContact(contact) : c,
          ),
        );

        toast.success(`"${trimmedName}" updated successfully.`);
      } else {
        const res = await fetch("/api/contacts", {
          method: "POST",

          headers,

          body: JSON.stringify({
            name: form_data.name,

            email: form_data.email,

            phone: form_data.phone || null,

            city: form_data.city || null,

            state: form_data.state || null,

            country: form_data.country || null,

            source: form_data.source,

            notes: form_data.notes,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));

          throw new Error(err.error || "Failed to create");
        }

        const { contact } = await res.json();

        setContacts((prev) => [toFormContact(contact), ...prev]);

        toast.success(`"${trimmedName}" added successfully.`);
      }

      set_show_modal(false);

      set_editing_contact(null);

      set_form_data({
        name: "",

        email: "",

        phone: "",

        city: "",

        state: "",

        country: "",

        source: "Manual",

        notes: "",
      });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Something went wrong"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handle_close_modal = () => {
    set_show_modal(false);

    set_editing_contact(null);

    set_form_data({
      name: "",

      email: "",

      phone: "",

      city: "",

      state: "",

      country: "",

      source: "Manual",

      notes: "",
    });
  };

  const location_label = (contact: FormContact) => {
    const city = (contact.city ?? "").trim();

    const country = (contact.country ?? "").trim();

    if (city && country) {
      return `${city}, ${country}`;
    }

    return city || country || "—";
  };

  const reset_filters = () => {
    set_search_query("");

    set_status_filter("all");

    set_source_filter("all");
  };

  return (
    <div className="relative text-slate-900">
      <div className="mx-auto space-y-6">
        <div className="relative space-y-6">
            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                {/* <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  <Icon name="sparkles" className="h-4 w-4" /> Contact
                  Management
                </div> */}

                <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                  Contacts
                </h1>

                <p className="max-w-2xl text-sm text-slate-500">
                  Manage customers, leads, and booking contacts from one clean
                  workspace.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    toast.info("Import CSV is coming soon.")
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-600 shadow-sm transition hover:bg-emerald-700 hover:text-white"
                >
                  <Icon name="upload" className="h-4 w-4" /> Import CSV
                </button>

                <button
                  type="button"
                  onClick={() => toast.info("Export is coming soon.")}
                  className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <Icon name="download" className="h-4 w-4" /> Export
                </button>

                <button
                  type="button"
                  onClick={handle_add_contact}
                  className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
                >
                  <Icon name="plus" className="h-4 w-4" /> Add Contact
                </button>
              </div>
            </div>
            
            <ScreenGate minWidth={1024}>
              <div className="relative grid gap-4 md:grid-cols-3">
                <StatCard
                  icon={<Icon name="users" className="h-5 w-5" />}
                  label="Total Contacts"
                  value={stats.total}
                />

                <StatCard
                  icon={<Icon name="user-check" className="h-5 w-5" />}
                  label="Active Contacts"
                  value={stats.active}
                />

                <StatCard
                  icon={<Icon name="calendar-check" className="h-5 w-5" />}
                  label="Booking Contacts"
                  value={stats.booking}
                />
              </div>
            </ScreenGate>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5 space-y-4">
          <div className="bg-white">
            {/* Filter */}
            <div className="mb-4">
              <div className="w-full">
                <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="basis-1/3">
                    <h2 className="text-lg font-bold text-slate-950">Contact Directory</h2>
                    <div className="flex items-center gap-2">  
                      <p className="text-sm text-slate-500">
                        {loading
                          ? "Loading contacts…"
                          : `${filtered_contacts.length} contact${filtered_contacts.length === 1 ? "" : "s"} found`}
                      </p>
                      <p className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 px-3 py-1 text-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden />Live List
                      </p>
                    </div>
                  </div>
                  
                  <div className="basis-2/3 flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:gap-3 lg:max-w-3xl lg:flex-1 lg:justify-end">
                    <div className="relative min-h-12 w-full min-w-0 sm:w-1/2 sm:flex-none">
                      <Icon
                        name="search"
                        className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
                      />

                      <input
                        type="search"
                        value={search_query}
                        onChange={(e) => set_search_query(e.target.value)}
                        placeholder="Search by name, email, phone or city"
                        className="box-border h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-4 pl-11 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-200"
                      />
                    </div>

                    <div className="flex w-full min-w-0 shrink-0 items-center justify-start gap-2 sm:w-auto sm:justify-end">
                      <button
                        type="button"
                        onClick={() => set_show_filters(!show_filters)}
                        className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50 sm:flex-initial sm:px-4"
                      >
                        <Icon name="filter" className="h-4 w-4" /> Smart Filters
                      </button>

                      <button
                        type="button"
                        onClick={reset_filters}
                        className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 sm:flex-initial sm:px-4"
                      >
                        <LuRefreshCw className="h-4 w-4 shrink-0" aria-hidden />
                        Reset
                      </button>
                    </div>
                  </div>
                </div>

                {show_filters && (
                  <div className="mt-4 grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 grid-cols-2">
                    <SelectBox
                      label="Status"
                      value={status_filter}
                      onChange={(value) =>
                        set_status_filter(value as "all" | contact_status)
                      }
                      options={["all", "active", "inactive"]}
                    />

                    <SelectBox
                      label="Source"
                      value={source_filter}
                      onChange={(value) =>
                        set_source_filter(value as "all" | contact_source)
                      }
                      options={["all", "Manual", "Booking", "Website"]}
                    />
                  </div>
                )}
              </div>
            </div>

            {loading ? (
              <div className="overflow-x-auto">
                <ContactTableSkeleton />
              </div>
            ) : error ? (
              <div className="px-6 py-12 text-center text-red-600">{error}</div>
            ) : filtered_contacts.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-50 text-indigo-600">
                  <Icon name="users" className="h-8 w-8" />
                </div>

                <h3 className="text-xl font-bold text-slate-950">
                  No contacts found
                </h3>

                <p className="mt-2 max-w-md text-sm text-slate-500">
                  {contacts.length === 0
                    ? "Your contacts will appear here as customers book appointments or when you add them manually."
                    : "Try adjusting search or Smart Filters."}
                </p>

                {contacts.length === 0 ? (
                  <button
                    type="button"
                    onClick={handle_add_contact}
                    className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
                  >
                    <Icon name="plus" className="h-4 w-4" /> Add First Contact
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={reset_filters}
                    className="mt-5 inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            ) : (
              <>
                <ScreenGate maxWidth={1023}>
                {/* Mobile view */}
                <div className="block space-y-3">
                  {filtered_contacts.map((contact) => {
                    const status = get_contact_status(contact);

                    return (
                      <div key={contact.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 items-start gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500 text-sm font-black text-white">
                              {get_initials(contact.name ?? "")}
                            </div>

                            <div className="flex flex-col gap-1 min-w-0">
                              <div className="truncate text-sm font-bold text-slate-950">
                                {contact.name || "—"}
                              </div>

                              <span className="min-w-0 truncate text-sm text-slate-400">
                                {contact.email || "—"}
                              </span>

                              <div className="w-fit inline-flex rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
                                Customer / Lead
                              </div>

                            </div>
                          </div>

                          <ScreenGate minWidth={500}>
                            <div className="flex flex-col items-center justify-between gap-2">
                              <span className="text-sm font-semibold text-slate-600">
                                Source
                              </span>

                              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">
                                {get_contact_source(contact)}
                              </span>
                            </div>
                          </ScreenGate>

                          <div className="flex flex-col justify-end items-end gap-1">
                            {/* Status */}
                            <span
                              className={`shrink-0 rounded-xl px-3 py-1 text-xs font-bold capitalize border ${
                                status === "active"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                              }`}
                            >
                              {status}
                            </span>

                            {/* Actions */}
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenActionsId(
                                    openActionsId === contact.id
                                      ? null
                                      : contact.id
                                  )
                                }
                                className="inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg sm:rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
                                aria-label="More actions"
                                aria-expanded={openActionsId === contact.id}
                              >
                                <LuEllipsis className="h-4 w-4" aria-hidden />
                              </button>
                              {openActionsId === contact.id && (
                                <div className="absolute right-0 top-full z-50 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-xl" role="menu">
                                  <IconButton
                                    label="View"
                                    onClick={() => {
                                      set_view_contact(contact);
                                    }}
                                    icon={<Icon name="eye" className="h-4 w-4" />}
                                    colorClass="w-full text-emerald-600 hover:bg-emerald-50"
                                    title="View"
                                  />

                                  <IconButton
                                    label="Edit"
                                    onClick={() => handle_edit_contact(contact)}
                                    icon={<Icon name="pencil" className="h-4 w-4" />}
                                    colorClass="w-full text-indigo-600 hover:bg-indigo-50"
                                    title="Edit"
                                  />
                                  
                                  <IconButton
                                    label="Delete"
                                    onClick={() => handle_delete_click(contact.id)}
                                    icon={<Icon name="trash" className="h-4 w-4" />}
                                    colorClass="w-full text-red-600 hover:bg-red-50"
                                    title="Delete"
                                  />

                                </div>
                              )}
                            </div>
                          </div>

                        </div>

                        {/* Contact Details */}
                        {/* <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">

                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-semibold text-slate-400">
                              Email
                            </span>

                            <span className="min-w-0 truncate text-right text-sm font-medium text-slate-700">
                              {contact.email || "—"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-semibold text-slate-400">
                              Phone
                            </span>

                            <span className="text-right text-sm font-medium text-slate-700">
                              {contact.phone || "—"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-semibold text-slate-400">
                              Location
                            </span>

                            <div className="flex min-w-0 items-center gap-1.5 text-right text-sm font-medium text-slate-700">
                              <Icon
                                name="map-pin"
                                className="h-4 w-4 shrink-0 text-slate-400"
                              />

                              <span className="truncate">
                                {location_label(contact)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-semibold text-slate-400">
                              Source
                            </span>

                            <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">
                              {get_contact_source(contact)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-4">
                            <span className="text-xs font-semibold text-slate-400">
                              Last Booking
                            </span>

                            <span className="text-right text-sm font-medium text-slate-700">
                              {get_last_booking_label(contact)}
                            </span>
                          </div>
                        </div> */}

                        {/* <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
                          <IconButton
                            label="View"
                            onClick={() => {
                              set_view_contact(contact);
                            }}
                            icon={<Icon name="eye" className="h-4 w-4" />}
                          />

                          <IconButton
                            label="Edit"
                            onClick={() => handle_edit_contact(contact)}
                            icon={<Icon name="pencil" className="h-4 w-4" />}
                          />

                          <button
                            type="button"
                            onClick={() => handle_delete_click(contact.id)}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600 transition hover:bg-rose-100"
                            title="Delete"
                            aria-label="Delete contact"
                          >
                            <Icon name="trash" className="h-4 w-4" />
                          </button>
                        </div> */}
                      </div>
                    );
                  })}
                </div>
                </ScreenGate>
                
                <ScreenGate minWidth={1024}>
                {/* desktop view */}
                <div className="overflow-hidden overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead className="bg-slate-100">
                      <tr className="text-left text-sm text-slate-900">
                        <th className="px-6 py-4 font-semibold">Contact</th>

                        <th className="px-6 py-4 font-semibold">Email</th>

                        <th className="px-6 py-4 font-semibold">Phone</th>

                        <th className="px-6 py-4 font-semibold">Location</th>

                        <th className="px-6 py-4 font-semibold">Source</th>

                        <th className="px-6 py-4 font-semibold">Last Booking</th>

                        <th className="px-6 py-4 font-semibold">Status</th>

                        <th className="px-6 py-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {filtered_contacts.map((contact) => (
                        <tr
                          key={contact.id}
                          className="cursor-pointer transition hover:bg-slate-50 border border-slate-100 last:border-b-0  border-b border-slate-100"
                        >
                          <td className="text-sm px-6 py-5 align-middle border-b border-slate-100" data-label="Contact">
                            <div className="flex items-start max-[1301px]:justify-end gap-2.5">
                              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-indigo-500 font-black text-white">
                                {get_initials(contact.name ?? "")}
                              </div>

                              <div>
                                <div className="font-bold text-slate-950">
                                  {contact.name || "—"}
                                </div>

                                <div className="mt-1 inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                                  Customer / Lead
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="text-sm px-6 py-5 align-middle border-b border-slate-100" data-label="Email">
                            {contact.email || "—"}
                          </td>

                          <td className="text-sm px-6 py-5 align-middle border-b border-slate-100" data-label="Phone">
                            {contact.phone || "—"}
                          </td>

                          <td className="text-sm px-6 py-5 align-middle border-b border-slate-100" data-label="Location">
                            <div className="flex items-center max-[1301px]:justify-end gap-2.5">
                              <Icon
                                name="map-pin"
                                className="h-4 w-4 shrink-0 text-slate-600"
                              />

                              {location_label(contact)}
                            </div>
                          </td>

                          <td className="text-sm px-6 py-5 align-middle border-b border-slate-100" data-label="Source">
                            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-600">
                              {get_contact_source(contact)}
                            </span>
                          </td>

                          <td className="text-sm px-6 py-5 align-middle border-b border-slate-100" data-label="Last Booking">
                            {get_last_booking_label(contact)}
                          </td>

                          <td className="text-sm px-6 py-5 align-middle border-b border-slate-100" data-label="Status">
                            <span
                              className={`rounded-full px-3 py-1 text-xs border font-bold capitalize ${
                                get_contact_status(contact) === "active"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                              }`}
                            >
                              {get_contact_status(contact)}
                            </span>
                          </td>

                          <td className="text-sm px-6 py-5 align-middle border-b border-slate-100" data-label="Actions">
                            <div className="flex items-center justify-end gap-2">
                              <IconButton
                                label="View"
                                onClick={() => {
                                  set_view_contact(contact);
                                }}
                                icon={<Icon name="eye" className="h-4 w-4" />}
                                title=""
                                colorClass="border border-emerald-200 bg-emerald-50 text-emerald-600 transition hover:bg-emerald-100 hover:text-emerald-700 py-3"
                              />

                              <IconButton
                                label="Edit"
                                onClick={() => handle_edit_contact(contact)}
                                icon={<Icon name="pencil" className="h-4 w-4" />}
                                title=""
                                colorClass="border border-indigo-200 bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100 hover:text-indigo-700 py-3"
                              />

                              <button
                                type="button"
                                onClick={() => handle_delete_click(contact.id)}
                                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-100 bg-red-50 text-red-600 transition hover:bg-red-100"
                                title="Delete"
                              >
                                <Icon name="trash" className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                </ScreenGate>
              </>           
            )}
          </div>
        </div>

      </div>     

      {show_modal && (
        <div
          className="fixed inset-0 z-[100001] flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              handle_close_modal();
            }
          }}
        >
          <div
            className="flex max-h-[min(90vh,880px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-form-title"
          >
            <div className="shrink-0 border-b border-slate-100 px-4 pb-5 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3
                    id="contact-form-title"
                    className="text-2xl font-bold tracking-tight text-slate-950"
                  >
                    {editing_contact ? "Edit Contact" : "Create Contact"}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Keep your customer information clean and updated.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handle_close_modal}
                  className="shrink-0 rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Close contact form"
                >
                  <Icon name="x" className="h-5 w-5" />
                </button>
              </div>
            </div>

            <form
              onSubmit={handle_submit}
              className="flex min-h-0 flex-1 flex-col"
            >
              <div className="flex-1 overflow-y-auto px-4 py-6">
                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <label
                      htmlFor="name"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
                    >
                      Name <span className="text-red-500 normal-case">*</span>
                    </label>

                    <input
                      id="name"
                      type="text"
                      required
                      value={form_data.name}
                      onChange={(e) =>
                        set_form_data({ ...form_data, name: e.target.value })
                      }
                      placeholder="Full name"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="email"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
                    >
                      Email <span className="text-red-500 normal-case">*</span>
                    </label>

                    <input
                      id="email"
                      type="email"
                      required
                      disabled={!!editing_contact}
                      value={form_data.email}
                      onChange={(e) =>
                        set_form_data({
                          ...form_data,
                          email: e.target.value,
                        })
                      }
                      placeholder="email@example.com"
                      className={`w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium outline-none transition ${editing_contact ? "cursor-not-allowed bg-slate-50 text-slate-500" : "text-slate-900 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"}`}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="phone"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
                    >
                      Phone
                    </label>

                    <input
                      id="phone"
                      type="tel"
                      value={form_data.phone}
                      onChange={(e) =>
                        set_form_data({ ...form_data, phone: e.target.value })
                      }
                      placeholder="Phone number"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="city"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
                    >
                      City
                    </label>

                    <input
                      id="city"
                      type="text"
                      value={form_data.city}
                      onChange={(e) =>
                        set_form_data({ ...form_data, city: e.target.value })
                      }
                      placeholder="City"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="state"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
                    >
                      State
                    </label>

                    <input
                      id="state"
                      type="text"
                      value={form_data.state}
                      onChange={(e) =>
                        set_form_data({
                          ...form_data,
                          state: e.target.value,
                        })
                      }
                      placeholder="State / Province"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="country"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
                    >
                      Country
                    </label>

                    <input
                      id="country"
                      type="text"
                      value={form_data.country}
                      onChange={(e) =>
                        set_form_data({
                          ...form_data,
                          country: e.target.value,
                        })
                      }
                      placeholder="Country"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label
                      htmlFor="source"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
                    >
                      Source
                    </label>

                    <select
                      id="source"
                      value={form_data.source}
                      onChange={(e) =>
                        set_form_data({
                          ...form_data,
                          source: e.target.value as contact_source,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold capitalize text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    >
                      {(
                        ["Manual", "Booking", "Website"] as const satisfies readonly contact_source[]
                      ).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label
                      htmlFor="notes"
                      className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500"
                    >
                      Notes
                    </label>

                    <textarea
                      id="notes"
                      rows={4}
                      value={form_data.notes}
                      onChange={(e) =>
                        set_form_data({ ...form_data, notes: e.target.value })
                      }
                      placeholder="Add context for your team..."
                      className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                    />
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-4 py-4">
                <button
                  type="button"
                  onClick={handle_close_modal}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition disabled:opacity-60"
                >
                  {submitting
                    ? "Saving..."
                    : editing_contact
                      ? "Update Contact"
                      : "Add Contact"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {view_contact && (
        <div
          className="fixed inset-0 z-1000001 flex items-center justify-center bg-slate-900/40 backdrop-blur-[2px]"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              set_view_contact(null);
            }
          }}
        >
          <div
            className="max-h-[min(90vh,880px)] w-full max-w-2xl flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-view-title"
          >
            <div className="border-b border-slate-100 pb-5 pt-6 px-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3
                    id="contact-view-title"
                    className="text-2xl font-bold tracking-tight text-slate-950"
                  >
                    Contact Details
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Keep your customer information clean and updated.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => set_view_contact(null)}
                  className="shrink-0 rounded-full border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                  aria-label="Close"
                >
                  <Icon name="x" className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="max-h-[min(70vh,640px)] space-y-6 overflow-y-auto px-4 py-6">
              <div className="flex items-center gap-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-2xl font-black text-indigo-800">
                  {get_initials(view_contact.name ?? "")}
                </div>

                <div className="min-w-0">
                  <h4 className="truncate text-xl font-bold text-slate-950">
                    {view_contact.name || "—"}
                  </h4>

                  <p className="mt-0.5 text-sm font-medium text-slate-500">
                    {get_contact_source(view_contact)} Contact
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-slate-400">
                    <Icon name="mail" className="h-4 w-4 shrink-0" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Email
                    </span>
                  </div>
                  <p className="break-all text-sm font-bold text-slate-900">
                    {view_contact.email || "—"}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-slate-400">
                    <Icon name="phone" className="h-4 w-4 shrink-0" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Phone
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {view_contact.phone || "—"}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-slate-400">
                    <Icon name="map-pin" className="h-4 w-4 shrink-0" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      City
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {(view_contact.city ?? "").trim() || "—"}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <div className="mb-3 flex items-center gap-2 text-slate-400">
                    <Icon name="clock" className="h-4 w-4 shrink-0" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Last Booking
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {get_last_booking_label(view_contact)}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Notes
                </p>
                <p className="mt-2 text-sm leading-relaxed text-slate-800">
                  {get_contact_notes(view_contact)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 px-4 py-4">
              <button
                type="button"
                onClick={() => set_view_contact(null)}
                className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                Close
              </button>

              <button
                type="button"
                onClick={() => {
                  const c = view_contact;

                  set_view_contact(null);

                  handle_edit_contact(c);
                }}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition"
              >
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {delete_confirm && (
        <ConfirmModal
          title="Delete Contact"
          message="Are you sure you want to delete this contact? This action cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          onConfirm={handle_delete_confirm}
          onCancel={() => set_delete_confirm(null)}
        />
      )}

    </div>
  );
}

function StatCard({
  icon,

  label,

  value,
}: {
  icon: ReactNode;

  label: string;

  value: number;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex h-10 w-10 xl:h-14 xl:w-14 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-snug text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function IconButton({
  icon,

  label,

  title,

  colorClass = "text-slate-700 hover:bg-slate-50",

  onClick,
}: {
  icon: ReactNode;

  label: string;

  title: string;

  colorClass?: string;

  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm disabled:opacity-60 ${colorClass}`}
      title={label}
    >
      {icon}
      {title}
    </button>
  );
}

function SelectBox({
  label,

  value,

  options,

  onChange,
}: {
  label: string;

  value: string;

  options: string[];

  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-slate-700">
        {label}
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold capitalize text-slate-700 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option === "all" ? `All ${label}` : option}
          </option>
        ))}
      </select>
    </div>
  );
}

type IconName =
  | "search"
  | "plus"
  | "download"
  | "upload"
  | "eye"
  | "pencil"
  | "trash"
  | "users"
  | "user-check"
  | "calendar-check"
  | "map-pin"
  | "mail"
  | "phone"
  | "clock"
  | "x"
  | "filter"
  | "more"
  | "sparkles";

function Icon({
  name,

  className = "h-5 w-5",
}: {
  name: IconName;

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

    "aria-hidden": true as boolean,
  };

  switch (name) {
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="8" />

          <path d="m21 21-4.3-4.3" />
        </svg>
      );

    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14" />

          <path d="M5 12h14" />
        </svg>
      );

    case "download":
      return (
        <svg {...common}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />

          <path d="M7 10l5 5 5-5" />

          <path d="M12 15V3" />
        </svg>
      );

    case "upload":
      return (
        <svg {...common}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />

          <path d="M17 8l-5-5-5 5" />

          <path d="M12 3v12" />
        </svg>
      );

    case "eye":
      return (
        <svg {...common}>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />

          <circle cx="12" cy="12" r="3" />
        </svg>
      );

    case "pencil":
      return (
        <svg {...common}>
          <path d="M12 20h9" />

          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
        </svg>
      );

    case "trash":
      return (
        <svg {...common}>
          <path d="M3 6h18" />

          <path d="M8 6V4h8v2" />

          <path d="M19 6l-1 14H6L5 6" />

          <path d="M10 11v6" />

          <path d="M14 11v6" />
        </svg>
      );

    case "users":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />

          <circle cx="9" cy="7" r="4" />

          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />

          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );

    case "user-check":
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />

          <circle cx="9" cy="7" r="4" />

          <path d="m16 11 2 2 4-4" />
        </svg>
      );

    case "calendar-check":
      return (
        <svg {...common}>
          <path d="M8 2v4" />

          <path d="M16 2v4" />

          <rect x="3" y="4" width="18" height="18" rx="2" />

          <path d="M3 10h18" />

          <path d="m9 16 2 2 4-4" />
        </svg>
      );

    case "map-pin":
      return (
        <svg {...common}>
          <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />

          <circle cx="12" cy="10" r="3" />
        </svg>
      );

    case "mail":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="14" rx="2" />

          <path d="m3 7 9 6 9-6" />
        </svg>
      );

    case "phone":
      return (
        <svg {...common}>
          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" />
        </svg>
      );

    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />

          <path d="M12 6v6l4 2" />
        </svg>
      );

    case "x":
      return (
        <svg {...common}>
          <path d="M18 6 6 18" />

          <path d="m6 6 12 12" />
        </svg>
      );

    case "filter":
      return (
        <svg {...common}>
          <path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3Z" />
        </svg>
      );

    case "more":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="1" />

          <circle cx="19" cy="12" r="1" />

          <circle cx="5" cy="12" r="1" />
        </svg>
      );

    case "sparkles":
      return (
        <svg {...common}>
          <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8Z" />

          <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8Z" />
        </svg>
      );

    default:
      return null;
  }
}
