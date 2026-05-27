"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import DashboardIcon, { type DashboardIconName } from "./DashboardIcon";
import type { dashboard_activity_feed_item } from "@/src/types/dashboard_activity_feed_item";

function get_relative_time(date_iso: string): string {
  const diff_ms = Date.now() - new Date(date_iso).getTime();
  const minutes = Math.floor(diff_ms / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function icon_for_type(type: string): DashboardIconName {
  switch (type) {
    case "booking":
      return "check";
    case "contact":
      return "users";
    case "event_type":
      return "calendar";
    case "department":
      return "stethoscope";
    case "service":
      return "spark";
    case "availability":
      return "clock";
    case "settings":
      return "settings";
    default:
      return "activity";
  }
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
          set_items((body.activities ?? []).slice(0, 5));
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
    <div className="rounded-[32px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-200/60">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-xl font-black text-slate-900">Recent Activity</h3>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-500">
          Live
        </span>
      </div>
      {loading ? (
        <div className="py-8 text-center text-sm font-bold text-slate-400">Loading…</div>
      ) : error ? (
        <div className="py-8 text-center text-sm font-bold text-rose-600">{error}</div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center text-sm font-bold text-slate-400">No recent activity.</div>
      ) : (
        <div className="space-y-4">
          {items.map((activity) => (
            <div
              key={activity.id}
              className="flex w-full items-start gap-3 rounded-2xl bg-slate-50 p-3 text-left"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <DashboardIcon name={icon_for_type(activity.type)} size={18} />
              </div>
              <div>
                <p className="text-sm font-black text-slate-800">{activity.title}</p>
                <p className="text-xs font-bold text-slate-400">{get_relative_time(activity.createdAt)}</p>
              </div>
            </div>
          ))}

          <div className="pt-1">
            <Link
              href="/notifications/all"
              className="flex w-full items-center justify-center gap-2 rounded-[32px] bg-slate-50 px-5 py-4 text-sm font-black text-indigo-600 shadow-sm ring-1 ring-slate-200/70 hover:bg-slate-100"
            >
              View all activity
              <DashboardIcon name="chevronRight" size={16} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
