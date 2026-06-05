"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { NotificationsActivityFeedSkeleton } from "@/src/components/ui/NotificationsSkeleton";
import { build_activity_diff_display } from "@/src/utils/activity_diff_display";

type ActivityType =
  | "booking"
  | "contact"
  | "event_type"
  | "department"
  | "service"
  | "availability"
  | "settings";

interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  createdAt: string;
  entityId?: string | null;
  targetPath?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  changedFields?: string[];
}

function resolve_activity_href(item: ActivityItem): string | null {
  if (item.type === "event_type" && item.entityId?.trim()) {
    return `/event-type/${item.entityId.trim()}/edit`;
  }
  if (item.targetPath?.trim()) {
    return item.targetPath.trim();
  }
  return null;
}

function toRelativeTime(dateIso: string, nowMs: number) {
  const dateMs = new Date(dateIso).getTime();
  const diffMs = Math.max(0, nowMs - dateMs);
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDateTime(dateIso: string) {
  const date = new Date(dateIso);
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function AllNotifications() {
  const router = useRouter();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());

  const loadActivities = async () => {
    setError(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setItems([]);
        setLoading(false);
        return;
      }

      const headers = { Authorization: `Bearer ${session.access_token}` };

      const activityRes = await fetch("/api/activity", { headers });
      if (!activityRes.ok) {
        const errBody = await activityRes.json().catch(() => ({}));
        throw new Error(errBody?.error || "Failed to fetch activity feed");
      }

      const activityBody = await activityRes.json();
      const activities: ActivityItem[] = activityBody?.activities || [];
      setItems(activities.slice(0, 100));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load activities";
      setError(message);
    } finally {
      setLoading(false);
      setNowMs(Date.now());
    }
  };

  useEffect(() => {
    loadActivities();
    const refreshInterval = window.setInterval(loadActivities, 30000);
    const clockInterval = window.setInterval(() => setNowMs(Date.now()), 60000);
    return () => {
      window.clearInterval(refreshInterval);
      window.clearInterval(clockInterval);
    };
  }, []);

  return (
    <section className="space-y-6 rounded-xl mr-auto">
      <header className="flex flex-wrap justify-between relative gap-3">
        <div className="text-sm text-slate-500">
          <h3 className="text-xl font-semibold text-slate-800">All Notifications</h3>
          <p className="text-xs text-slate-500">Live activity feed from your workspace</p>
        </div>
      </header>

      {loading ? (
        <NotificationsActivityFeedSkeleton />
      ) : error ? (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-sm text-red-600">
          {error}
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-500">
          No activities found yet.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {items.map((item) => {
            const activity_href = resolve_activity_href(item);
            const diff_display = build_activity_diff_display(item);
            return (
            <div
              key={item.id}
              role={activity_href ? "button" : undefined}
              tabIndex={activity_href ? 0 : undefined}
              onClick={
                activity_href
                  ? () => router.push(activity_href)
                  : undefined
              }
              onKeyDown={
                activity_href
                  ? (e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(activity_href);
                      }
                    }
                  : undefined
              }
              className={`p-4 flex items-start gap-3 ${
                activity_href
                  ? "cursor-pointer transition hover:bg-slate-50/80"
                  : ""
              }`}
            >
              <div
                className={`mt-0.5 h-8 w-8 rounded-full grid place-items-center text-sm ${
                  item.type === "booking"
                    ? "bg-blue-100 text-blue-700"
                    : item.type === "contact"
                    ? "bg-emerald-100 text-emerald-700"
                    : item.type === "event_type"
                    ? "bg-violet-100 text-violet-700"
                    : item.type === "department"
                    ? "bg-amber-100 text-amber-700"
                    : item.type === "service"
                    ? "bg-cyan-100 text-cyan-700"
                    : item.type === "availability"
                    ? "bg-pink-100 text-pink-700"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {item.type === "booking"
                  ? "B"
                  : item.type === "contact"
                  ? "C"
                  : item.type === "event_type"
                  ? "E"
                  : item.type === "department"
                  ? "D"
                  : item.type === "service"
                  ? "S"
                  : item.type === "availability"
                  ? "A"
                  : "G"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-800">{item.title}</p>
                  {activity_href ? (
                    <Link
                      href={activity_href}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      View
                    </Link>
                  ) : null}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                {diff_display.changed_summary ? (
                  <p className="text-xs text-slate-500 mt-1">
                    Changed: {diff_display.changed_summary}
                  </p>
                ) : null}
                {diff_display.detail_lines.length > 0 ? (
                  <div className="mt-2 rounded-md bg-slate-50 p-2 text-xs text-slate-600">
                    <span className="font-semibold text-slate-700">Updates:</span>{" "}
                    {diff_display.detail_lines.join(" | ")}
                  </div>
                ) : null}
                <p className="text-xs text-slate-400 mt-1">
                  {formatDateTime(item.createdAt)} - {toRelativeTime(item.createdAt, nowMs)}
                </p>
              </div>
            </div>
          );
          })}
        </div>
      )}
    </section>
  );
}