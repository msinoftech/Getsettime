"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type SearchGroup = "Bookings" | "Contacts" | "Services";

type SearchResult = {
  id: string;
  group: SearchGroup;
  title: string;
  subtitle: string;
  href: string;
};

type BookingRow = {
  id: string;
  invitee_name: string | null;
  contacts?: { name: string | null } | null;
  event_types?: { title: string } | null;
  start_at: string | null;
};

type ContactRow = {
  id: number | string;
  name: string | null;
  email: string | null;
  phone: string | null;
};

type ServiceRow = {
  id: string;
  name: string;
  department_name?: string | null;
};

async function get_auth_header(): Promise<Record<string, string> | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return null;
  return { Authorization: `Bearer ${session.access_token}` };
}

export default function GlobalSearch() {
  const router = useRouter();
  const [open, set_open] = useState(false);
  const [query, set_query] = useState("");
  const [results, set_results] = useState<SearchResult[]>([]);
  const [loading, set_loading] = useState(false);
  const [active_index, set_active_index] = useState(0);

  const input_ref = useRef<HTMLInputElement>(null);
  const contacts_cache = useRef<ContactRow[] | null>(null);
  const services_cache = useRef<ServiceRow[] | null>(null);

  const close = useCallback(() => {
    set_open(false);
    set_query("");
    set_results([]);
    set_active_index(0);
  }, []);

  useEffect(() => {
    const on_key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        set_open((value) => !value);
      } else if (event.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", on_key);
    return () => window.removeEventListener("keydown", on_key);
  }, [close]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => input_ref.current?.focus(), 20);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (!trimmed) {
      set_results([]);
      set_loading(false);
      return;
    }

    let alive = true;
    set_loading(true);

    const timer = window.setTimeout(async () => {
      try {
        const headers = await get_auth_header();
        if (!headers || !alive) {
          set_results([]);
          return;
        }

        const lower = trimmed.toLowerCase();

        if (contacts_cache.current === null) {
          const res = await fetch("/api/contacts", { headers });
          const body = res.ok ? ((await res.json()) as { contacts?: ContactRow[] }) : {};
          contacts_cache.current = body.contacts ?? [];
        }
        if (services_cache.current === null) {
          const res = await fetch("/api/services", { headers });
          const body = res.ok ? ((await res.json()) as { services?: ServiceRow[] }) : {};
          services_cache.current = body.services ?? [];
        }

        const bookings_res = await fetch(
          `/api/bookings?search=${encodeURIComponent(trimmed)}&limit=5`,
          { headers },
        );
        const bookings_body = bookings_res.ok
          ? ((await bookings_res.json()) as { data?: BookingRow[] })
          : { data: [] };

        if (!alive) return;

        const booking_results: SearchResult[] = (bookings_body.data ?? [])
          .slice(0, 5)
          .map((b) => ({
            id: `booking-${b.id}`,
            group: "Bookings" as const,
            title: b.invitee_name?.trim() || b.contacts?.name?.trim() || "Guest",
            subtitle: b.event_types?.title?.trim() || "Appointment",
            href: `/bookings/${b.id}`,
          }));

        const contact_results: SearchResult[] = (contacts_cache.current ?? [])
          .filter((c) => {
            const haystack = [c.name, c.email, c.phone]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();
            return haystack.includes(lower);
          })
          .slice(0, 5)
          .map((c) => ({
            id: `contact-${c.id}`,
            group: "Contacts" as const,
            title: c.name?.trim() || c.email?.trim() || "Contact",
            subtitle: c.email?.trim() || c.phone?.trim() || "",
            href: "/contacts",
          }));

        const service_results: SearchResult[] = (services_cache.current ?? [])
          .filter((s) => s.name?.toLowerCase().includes(lower))
          .slice(0, 5)
          .map((s) => ({
            id: `service-${s.id}`,
            group: "Services" as const,
            title: s.name,
            subtitle: s.department_name?.trim() || "Service",
            href: "/services",
          }));

        set_results([...booking_results, ...contact_results, ...service_results]);
        set_active_index(0);
      } catch {
        if (alive) set_results([]);
      } finally {
        if (alive) set_loading(false);
      }
    }, 250);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [query, open]);

  const navigate = useCallback(
    (result: SearchResult) => {
      close();
      router.push(result.href);
    },
    [close, router],
  );

  const on_input_key = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (results.length === 0) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        set_active_index((i) => (i + 1) % results.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        set_active_index((i) => (i - 1 + results.length) % results.length);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const selected = results[active_index];
        if (selected) navigate(selected);
      }
    },
    [results, active_index, navigate],
  );

  const grouped = useMemo(() => {
    const groups: { group: SearchGroup; items: SearchResult[] }[] = [];
    for (const result of results) {
      const existing = groups.find((g) => g.group === result.group);
      if (existing) existing.items.push(result);
      else groups.push({ group: result.group, items: [result] });
    }
    return groups;
  }, [results]);

  return (
    <>
      <button
        type="button"
        onClick={() => set_open(true)}
        className="hidden w-full max-w-md items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400 transition hover:bg-gray-100 md:flex"
        aria-label="Search"
      >
        <svg
          className="h-4 w-4 shrink-0"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <span className="flex-1 text-left">Search bookings, customers, services...</span>
        <kbd className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-[11px] font-semibold text-gray-500">
          ⌘K
        </kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[70] flex items-start justify-center bg-slate-900/40 p-4 pt-[12vh] backdrop-blur-sm"
          onMouseDown={close}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-slate-200"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-4">
              <svg
                className="h-5 w-5 shrink-0 text-slate-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                ref={input_ref}
                value={query}
                onChange={(e) => set_query(e.target.value)}
                onKeyDown={on_input_key}
                placeholder="Search bookings, customers, services..."
                className="w-full bg-transparent py-4 text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={close}
                className="rounded-md px-2 py-1 text-xs font-semibold text-slate-400 hover:bg-slate-100"
              >
                Esc
              </button>
            </div>

            <div className="max-h-[50vh] overflow-y-auto p-2">
              {loading ? (
                <p className="px-3 py-6 text-center text-sm font-medium text-slate-400">
                  Searching…
                </p>
              ) : query.trim() === "" ? (
                <p className="px-3 py-6 text-center text-sm font-medium text-slate-400">
                  Type to search across bookings, contacts, and services.
                </p>
              ) : results.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm font-medium text-slate-400">
                  No results for &ldquo;{query.trim()}&rdquo;.
                </p>
              ) : (
                grouped.map((group) => (
                  <div key={group.group} className="mb-2">
                    <p className="px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-400">
                      {group.group}
                    </p>
                    {group.items.map((result) => {
                      const flat_index = results.indexOf(result);
                      const is_active = flat_index === active_index;
                      return (
                        <button
                          key={result.id}
                          type="button"
                          onMouseEnter={() => set_active_index(flat_index)}
                          onClick={() => navigate(result)}
                          className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                            is_active ? "bg-indigo-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">
                              {result.title}
                            </p>
                            {result.subtitle ? (
                              <p className="truncate text-xs font-medium text-slate-400">
                                {result.subtitle}
                              </p>
                            ) : null}
                          </div>
                          <svg
                            className="h-4 w-4 shrink-0 text-slate-300"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={2}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
