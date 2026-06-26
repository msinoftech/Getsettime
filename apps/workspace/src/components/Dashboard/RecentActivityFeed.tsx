"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardIcon, { type DashboardIconName } from "./DashboardIcon";
import type { dashboard_activity_feed_item } from "@/src/types/dashboard_activity_feed_item";

function get_relative_time(date_iso: string): string {
  const diff_ms = Date.now() - new Date(date_iso).getTime();
  const minutes = Math.floor(diff_ms / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type TypeStyle = {
  icon: DashboardIconName;
  icon_bg: string;
  icon_color: string;
};

const TYPE_STYLES: Record<string, TypeStyle> = {
  booking: { icon: "calendar", icon_bg: "bg-emerald-50", icon_color: "text-emerald-600" },
  contact: { icon: "user", icon_bg: "bg-blue-50", icon_color: "text-blue-600" },
  event_type: { icon: "calendarDays", icon_bg: "bg-violet-50", icon_color: "text-violet-600" },
  department: { icon: "stethoscope", icon_bg: "bg-amber-50", icon_color: "text-amber-600" },
  service: { icon: "spark", icon_bg: "bg-cyan-50", icon_color: "text-cyan-600" },
  availability: { icon: "clock", icon_bg: "bg-pink-50", icon_color: "text-pink-600" },
  settings: { icon: "settings", icon_bg: "bg-slate-100", icon_color: "text-slate-600" },
};

const DEFAULT_STYLE: TypeStyle = {
  icon: "activity",
  icon_bg: "bg-indigo-50",
  icon_color: "text-indigo-600",
};

function style_for_type(type: string): TypeStyle {
  return TYPE_STYLES[type] ?? DEFAULT_STYLE;
}

export default function RecentActivityFeed() {
  const [items, set_items] = useState<dashboard_activity_feed_item[]>([]);
  const [loading, set_loading] = useState(true);
  const [error, set_error] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const load = async () => {
      set_loading(true);
      set_error(null);
      try {
        const { supabase } = await import("@/lib/supabaseClient");
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          if (alive) set_items([]);
          return;
        }
        const res = await fetch("/api/activity", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) {
          throw new Error("Failed to load activity");
        }
        const body = (await res.json()) as { activities?: dashboard_activity_feed_item[] };
        if (alive) {
          set_items((body.activities ?? []).slice(0, 4));
        }
      } catch {
        if (alive) set_error("Could not load activity");
      } finally {
        if (alive) set_loading(false);
      }
    };

    load();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h3 className="text-lg font-bold text-slate-900">Recent Activity</h3>
        <Link
          href="/notifications/all"
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
        >
          View All
        </Link>
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm font-semibold text-slate-400">
          Loading…
        </div>
      ) : error ? (
        <div className="py-10 text-center text-sm font-semibold text-rose-600">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="py-10 text-center text-sm font-semibold text-slate-400">
          No recent activity.
        </div>
      ) : (
        <>
          <div className="divide-y divide-slate-100">
            {items.map((activity) => {
              const style = style_for_type(activity.type);
              return (
                <Link
                  key={activity.id}
                  href={activity.targetPath || "/notifications/all"}
                  className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition hover:bg-slate-50"
                >
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.icon_bg} ${style.icon_color}`}
                  >
                    <DashboardIcon name={style.icon} size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {activity.title}
                    </p>
                    {activity.description ? (
                      <p className="truncate text-xs font-medium text-slate-500">
                        {activity.description}
                      </p>
                    ) : null}
                  </div>
                  <span className="shrink-0 text-xs font-medium text-slate-400">
                    {get_relative_time(activity.createdAt)}
                  </span>
                </Link>
              );
            })}
          </div>

          <div className="pt-3 text-center">
            <Link
              href="/notifications/all"
              className="inline-flex items-center justify-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700"
            >
              View all activity
              <DashboardIcon name="arrow" size={16} />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
