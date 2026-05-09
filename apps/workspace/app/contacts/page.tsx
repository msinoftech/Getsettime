"use client";

import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

import type { Contact, FormContact } from "@/src/types/contact";

import { AlertModal } from "@/src/components/ui/AlertModal";

import { ConfirmModal } from "@/src/components/ui/ConfirmModal";

import { ContactTableSkeleton } from "@/src/components/Contacts/ContactTableSkeleton";

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

  const [alert_message, set_alert_message] = useState<string | null>(null);

  const [form_data, set_form_data] = useState({
    name: "",

    email: "",

    phone: "",

    city: "",

    state: "",

    country: "",
  });

  const fetch_contacts = useCallback(async () => {
    try {
      setLoading(true);

      setError(null);

      const { supabase } = await import("@/lib/supabaseClient");

      const {
        data: { session },
      } = await supabase.auth.getSession();

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
    });

    set_show_modal(true);
  };

  const handle_delete_click = (id: string) => set_delete_confirm(id);

  const handle_delete_confirm = async () => {
    if (!delete_confirm) {
      return;
    }

    try {
      const { supabase } = await import("@/lib/supabaseClient");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        set_delete_confirm(null);

        set_alert_message("Not authenticated");

        return;
      }

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
    } catch (e) {
      set_delete_confirm(null);

      set_alert_message(
        e instanceof Error ? e.message : "Failed to delete contact",
      );
    }
  };

  const handle_submit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setSubmitting(true);

      const { supabase } = await import("@/lib/supabaseClient");

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
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
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));

          throw new Error(err.error || "Failed to create");
        }

        const { contact } = await res.json();

        setContacts((prev) => [toFormContact(contact), ...prev]);
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
      });
    } catch (e) {
      set_alert_message(
        e instanceof Error ? e.message : "Something went wrong",
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
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm">
          <div className="relative p-6 sm:p-8">
            <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-indigo-100/70 blur-3xl" />

            <div className="absolute bottom-0 right-36 h-40 w-40 rounded-full bg-cyan-100/70 blur-3xl" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-sm font-semibold text-indigo-700">
                  <Icon name="sparkles" className="h-4 w-4" /> Contact
                  Management
                </div>

                <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  Contacts
                </h1>

                <p className="mt-2 max-w-2xl text-base text-slate-500">
                  Manage customers, leads, and booking contacts from one clean
                  workspace.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    set_alert_message("Import CSV is coming soon.")
                  }
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
                >
                  <Icon name="upload" className="h-4 w-4" /> Import CSV
                </button>

                <button
                  type="button"
                  onClick={() => set_alert_message("Export is coming soon.")}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700"
                >
                  <Icon name="download" className="h-4 w-4" /> Export
                </button>

                <button
                  type="button"
                  onClick={handle_add_contact}
                  className="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
                >
                  <Icon name="plus" className="h-4 w-4" /> Add Contact
                </button>
              </div>
            </div>

            <div className="relative mt-8 grid gap-4 md:grid-cols-3">
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
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xl">
              <Icon
                name="search"
                className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
              />

              <input
                type="search"
                value={search_query}
                onChange={(e) => set_search_query(e.target.value)}
                placeholder="Search by name, email, phone or city"
                className="h-14 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-sm font-medium text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => set_show_filters(!show_filters)}
                className="inline-flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-indigo-200 hover:text-indigo-700"
              >
                <Icon name="filter" className="h-4 w-4" /> Smart Filters
              </button>

              <button
                type="button"
                onClick={reset_filters}
                className="inline-flex h-12 items-center rounded-2xl bg-slate-100 px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
              >
                Reset
              </button>
            </div>
          </div>

          {show_filters && (
            <div className="mt-4 grid gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-4 md:grid-cols-2">
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

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Contact Directory
              </h2>

              <p className="text-sm text-slate-500">
                {loading
                  ? "Loading contacts…"
                  : `${filtered_contacts.length} contact${filtered_contacts.length === 1 ? "" : "s"} found`}
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-indigo-700">
              <span
                className="h-1.5 w-1.5 rounded-full bg-indigo-600"
                aria-hidden
              />
              Live List
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1050px] text-left">
                <thead className="bg-slate-50 text-sm font-bold text-slate-500">
                  <tr>
                    <th className="px-5 py-4">Contact</th>

                    <th className="px-5 py-4">Email</th>

                    <th className="px-5 py-4">Phone</th>

                    <th className="px-5 py-4">Location</th>

                    <th className="px-5 py-4">Source</th>

                    <th className="px-5 py-4">Last Booking</th>

                    <th className="px-5 py-4">Status</th>

                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {filtered_contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="group transition hover:bg-slate-50/80"
                    >
                      <td className="px-5 py-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-100 to-cyan-100 text-sm font-black text-indigo-700">
                            {get_initials(contact.name ?? "")}
                          </div>

                          <div>
                            <div className="font-bold text-slate-950">
                              {contact.name || "—"}
                            </div>

                            <div className="mt-1 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-500">
                              Customer / Lead
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-5 text-sm font-medium text-slate-600">
                        {contact.email || "—"}
                      </td>

                      <td className="px-5 py-5 text-sm font-medium text-slate-600">
                        {contact.phone || "—"}
                      </td>

                      <td className="px-5 py-5 text-sm font-medium text-slate-600">
                        <div className="flex items-center gap-2">
                          <Icon
                            name="map-pin"
                            className="h-4 w-4 shrink-0 text-slate-400"
                          />

                          {location_label(contact)}
                        </div>
                      </td>

                      <td className="px-5 py-5">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                          {get_contact_source(contact)}
                        </span>
                      </td>

                      <td className="px-5 py-5 text-sm font-medium text-slate-600">
                        {get_last_booking_label(contact)}
                      </td>

                      <td className="px-5 py-5">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
                            get_contact_status(contact) === "active"
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-rose-50 text-rose-700"
                          }`}
                        >
                          {get_contact_status(contact)}
                        </span>
                      </td>

                      <td className="px-5 py-5">
                        <div className="flex items-center justify-end gap-2">
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
          )}
        </div>
      </div>

      {show_modal && (
        <div
          className={`fixed inset-0 z-99999 m-0 flex justify-end transition-opacity duration-200 ${show_modal ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        >
          <div
            className={`absolute inset-0 bg-black/40 transition-opacity duration-300 ${show_modal ? "opacity-100" : "opacity-0"}`}
            aria-hidden="true"
            onClick={handle_close_modal}
          />

          <div
            className={`relative h-full w-full max-w-xl transform bg-white shadow-2xl transition-transform duration-300 ${show_modal ? "translate-x-0" : "translate-x-full"}`}
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  {editing_contact ? "Update Contact" : "Create New Contact"}
                </h3>

                <p className="text-xs uppercase tracking-wide text-gray-500">
                  {editing_contact
                    ? "Modify your contact details below."
                    : "Quickly add a new contact to your list."}
                </p>
              </div>

              <button
                className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                onClick={handle_close_modal}
                aria-label="Close contact form"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5">
              <form
                onSubmit={handle_submit}
                className="grid md:grid-cols-2 gap-4 p-5 rounded-xl border border-slate-200 bg-gray-50/70"
              >
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Name <span className="text-red-500">*</span>
                  </label>

                  <input
                    id="name"
                    type="text"
                    required
                    value={form_data.name}
                    onChange={(e) =>
                      set_form_data({ ...form_data, name: e.target.value })
                    }
                    placeholder="e.g. John Doe"
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Email <span className="text-red-500">*</span>
                  </label>

                  <input
                    id="email"
                    type="email"
                    required
                    disabled={!!editing_contact}
                    value={form_data.email}
                    onChange={(e) =>
                      set_form_data({ ...form_data, email: e.target.value })
                    }
                    placeholder="e.g. john@example.com"
                    className={`w-full px-4 py-2 rounded-lg border border-slate-300 outline-none ${editing_contact ? "bg-slate-100 text-slate-500 cursor-not-allowed" : "focus:ring-2 focus:ring-indigo-500"}`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Phone number
                  </label>

                  <input
                    id="phone"
                    type="tel"
                    value={form_data.phone}
                    onChange={(e) =>
                      set_form_data({ ...form_data, phone: e.target.value })
                    }
                    placeholder="e.g. +1 234 567 8900"
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="city"
                    className="block text-sm font-medium text-slate-700 mb-1"
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
                    placeholder="e.g. New York"
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="state"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    State
                  </label>

                  <input
                    id="state"
                    type="text"
                    value={form_data.state}
                    onChange={(e) =>
                      set_form_data({ ...form_data, state: e.target.value })
                    }
                    placeholder="e.g. California"
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="country"
                    className="block text-sm font-medium text-slate-700 mb-1"
                  >
                    Country
                  </label>

                  <input
                    id="country"
                    type="text"
                    value={form_data.country}
                    onChange={(e) =>
                      set_form_data({ ...form_data, country: e.target.value })
                    }
                    placeholder="e.g. USA"
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition font-medium disabled:opacity-70"
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
        </div>
      )}

      {view_contact && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              set_view_contact(null);
            }
          }}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-view-title"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h3
                  id="contact-view-title"
                  className="text-xl font-bold text-slate-950"
                >
                  Contact Details
                </h3>

                <p className="text-sm text-slate-500">
                  View-only summary for this record.
                </p>
              </div>

              <button
                type="button"
                onClick={() => set_view_contact(null)}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div className="flex items-center gap-4 rounded-2xl bg-slate-50 p-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-indigo-100 text-2xl font-black text-indigo-700">
                  {get_initials(view_contact.name ?? "")}
                </div>

                <div>
                  <h4 className="text-xl font-bold text-slate-950">
                    {view_contact.name || "—"}
                  </h4>

                  <p className="text-sm font-medium text-slate-500">
                    {get_contact_source(view_contact)} contact
                  </p>
                </div>
              </div>

              <div className="grid gap-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="font-bold text-slate-500">Email</span>

                  <span className="text-right font-medium text-slate-800">
                    {view_contact.email || "—"}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="font-bold text-slate-500">Phone</span>

                  <span className="text-right font-medium text-slate-800">
                    {view_contact.phone || "—"}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="font-bold text-slate-500">Location</span>

                  <span className="text-right font-medium text-slate-800">
                    {location_label(view_contact)}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="font-bold text-slate-500">Last Booking</span>

                  <span className="text-right font-medium text-slate-800">
                    {get_last_booking_label(view_contact)}
                  </span>
                </div>

                <div className="flex justify-between gap-4">
                  <span className="font-bold text-slate-500">Status</span>

                  <span className="text-right font-medium capitalize text-slate-800">
                    {get_contact_status(view_contact)}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => set_view_contact(null)}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
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
                  className="rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700"
                >
                  Edit
                </button>
              </div>
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

      {alert_message && (
        <AlertModal
          message={alert_message}
          onClose={() => set_alert_message(null)}
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
    <div className="rounded-3xl border border-slate-100 bg-white/80 p-5 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          {icon}
        </div>

        <Icon name="more" className="h-5 w-5 text-slate-300" />
      </div>

      <div className="mt-5 text-3xl font-black text-slate-950">{value}</div>

      <div className="mt-1 text-sm font-semibold text-slate-500">{label}</div>
    </div>
  );
}

function IconButton({
  icon,

  label,

  onClick,
}: {
  icon: ReactNode;

  label: string;

  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
      title={label}
    >
      {icon}
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
