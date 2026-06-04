"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/src/providers/AuthProvider";
import { useSubscription } from "@/src/hooks/useSubscription";
import { formatBookingLimitLabel } from "@app/db/subscription";

function dismissKey(workspaceId: number) {
  return `free_plan_welcome_dismissed_${workspaceId}`;
}

export function FreePlanWelcomeBanner() {
  const { user } = useAuth();
  const { data, loading } = useSubscription(Boolean(user));
  const [dismissed, setDismissed] = useState(true);

  const workspaceIdRaw = user?.user_metadata?.workspace_id;
  const workspaceId =
    typeof workspaceIdRaw === "number"
      ? workspaceIdRaw
      : parseInt(String(workspaceIdRaw ?? ""), 10);

  const role = user?.user_metadata?.role as string | undefined;
  const isOwner = user?.user_metadata?.is_workspace_owner === true;
  const showForRole =
    isOwner || role === "workspace_admin" || role === "manager";

  useEffect(() => {
    if (!Number.isFinite(workspaceId) || workspaceId <= 0) return;
    const stored = window.localStorage.getItem(dismissKey(workspaceId));
    setDismissed(stored === "1");
  }, [workspaceId]);

  if (loading || !data || !showForRole || dismissed) return null;
  if (data.plan.slug !== "free") return null;

  const handleDismiss = () => {
    if (Number.isFinite(workspaceId)) {
      window.localStorage.setItem(dismissKey(workspaceId), "1");
    }
    setDismissed(true);
  };

  return (
    <div className="mb-6 rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-slate-900">
            🎉 Welcome to GetSetTime
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            You are currently on the <strong>Free Plan</strong>.
          </p>
          <ul className="mt-3 grid gap-1 text-sm text-slate-700 sm:grid-cols-2">
            <li>✔ {formatBookingLimitLabel(data.plan.booking_limit)} bookings/month</li>
            <li>✔ {data.plan.admin_limit} Admin</li>
            <li>✔ Up to {data.plan.service_provider_limit} Service Providers</li>
            <li>✔ Google Calendar Sync</li>
            <li>✔ Email Notifications</li>
            <li>✔ Public Booking Page</li>
          </ul>
          <p className="mt-3 text-sm text-slate-600">
            Upgrade anytime to unlock:
          </p>
          <ul className="mt-1 list-inside list-disc text-sm text-slate-600">
            <li>More providers</li>
            <li>WhatsApp automation</li>
            <li>Online payments</li>
            <li>Multiple locations</li>
            <li>Advanced features</li>
          </ul>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <Link
            href="/billings"
            className="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Upgrade Plan
          </Link>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
