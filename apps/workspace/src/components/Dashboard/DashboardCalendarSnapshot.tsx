"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import DashboardIcon from "./DashboardIcon";
import type { Booking } from "@/src/types/booking";
import { toDateKey } from "@/src/components/Calendar/calendar_utils";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** Monday-anchored start of the week containing `date`. */
function start_of_week_monday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const weekday = d.getDay();
  const shift = weekday === 0 ? -6 : 1 - weekday;
  d.setDate(d.getDate() + shift);
  return d;
}

function is_same_day(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function normalized_status(status: string | null | undefined): string {
  return String(status ?? "").toLowerCase();
}

/** Active = not cancelled/deleted/no-show (those don't count toward the snapshot). */
function is_active_status(status: string | null | undefined): boolean {
  const s = normalized_status(status);
  return s !== "cancelled" && s !== "deleted" && s !== "no-show";
}

function is_pending_status(status: string | null | undefined): boolean {
  const s = normalized_status(status);
  return s === "" || s === "pending";
}

/** Single dot color per day, prioritising pending so attention items stand out. */
function day_dot_class(items: Booking[]): string {
  if (items.length === 0) return "bg-transparent";
  if (items.some((b) => is_pending_status(b.status))) return "bg-amber-500";
  if (items.some((b) => normalized_status(b.status) === "confirmed")) {
    return "bg-indigo-500";
  }
  return "bg-emerald-500";
}

export default function DashboardCalendarSnapshot() {
  const [week_offset, set_week_offset] = useState(0);
  const [bookings, set_bookings] = useState<Booking[]>([]);
  const [loading, set_loading] = useState(true);

  const today = useMemo(() => new Date(), []);

  const week_days = useMemo(() => {
    const base = start_of_week_monday(today);
    base.setDate(base.getDate() + week_offset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return d;
    });
  }, [today, week_offset]);

  const week_start_key = toDateKey(week_days[0]);
  const week_end_key = toDateKey(week_days[6]);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      set_loading(true);
      try {
        const { supabase } = await import("@/lib/supabaseClient");
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          if (alive) set_bookings([]);
          return;
        }
        const params = new URLSearchParams({
          start_date: week_start_key,
          end_date: week_end_key,
        });
        const res = await fetch(`/api/bookings?${params.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error("Failed to load calendar snapshot");
        const body = (await res.json()) as { data?: Booking[] };
        if (alive) set_bookings(body.data ?? []);
      } catch {
        if (alive) set_bookings([]);
      } finally {
        if (alive) set_loading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, [week_start_key, week_end_key]);

  const bookings_by_day = useMemo(() => {
    const map = new Map<string, Booking[]>();
    for (const b of bookings) {
      if (!b.start_at || !is_active_status(b.status)) continue;
      const key = toDateKey(new Date(b.start_at));
      const bucket = map.get(key);
      if (bucket) bucket.push(b);
      else map.set(key, [b]);
    }
    return map;
  }, [bookings]);

  const active_bookings = useMemo(
    () => bookings.filter((b) => is_active_status(b.status)),
    [bookings],
  );
  const total_count = active_bookings.length;
  const confirmed_count = active_bookings.filter(
    (b) => normalized_status(b.status) === "confirmed",
  ).length;
  const pending_count = active_bookings.filter((b) =>
    is_pending_status(b.status),
  ).length;

  const range_label = `${week_days[0].toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} – ${week_days[6].toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })}, ${week_days[6].getFullYear()}`;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
            <DashboardIcon name="calendarDays" size={20} />
          </div>
          <h3 className="text-lg font-bold text-slate-900">Calendar Snapshot</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => set_week_offset((o) => o - 1)}
            aria-label="Previous week"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
          >
            <DashboardIcon name="chevronLeft" size={18} />
          </button>
          <button
            type="button"
            onClick={() => set_week_offset((o) => o + 1)}
            aria-label="Next week"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50"
          >
            <DashboardIcon name="chevronRight" size={18} />
          </button>
        </div>
      </div>

      <p className="mb-4 text-sm font-bold text-slate-700">{range_label}</p>

      <div className="grid grid-cols-7 gap-1 text-center">
        {week_days.map((d, i) => {
          const items = bookings_by_day.get(toDateKey(d)) ?? [];
          const is_today = is_same_day(d, today);
          return (
            <div
              key={toDateKey(d)}
              className="flex flex-col items-center gap-1.5 py-1"
            >
              <span className="text-xs font-bold text-slate-400">
                {WEEKDAY_LABELS[i]}
              </span>
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${
                  is_today
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-700"
                }`}
              >
                {d.getDate()}
              </span>
              <span
                className={`h-1.5 w-1.5 rounded-full ${day_dot_class(items)}`}
              />
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4">
        {loading ? (
          <span className="text-xs font-semibold text-slate-400">Loading…</span>
        ) : (
          <>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <span className="h-2 w-2 rounded-full bg-indigo-500" />
              {total_count} Bookings
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {confirmed_count} Appointments
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              {pending_count} Pending
            </span>
          </>
        )}
      </div>

      <div className="pt-4 text-center">
        <Link
          href="/calendar"
          className="inline-flex items-center justify-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700"
        >
          View full calendar
          <DashboardIcon name="arrow" size={16} />
        </Link>
      </div>
    </div>
  );
}
