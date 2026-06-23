"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/src/providers/AuthProvider";
import { useCreateBookingModal } from "@/src/providers/CreateBookingModalProvider";
import { useWorkspaceSettings } from "@/src/hooks/useWorkspaceSettings";
import { useDashboardCounts } from "@/src/hooks/useDashboardCounts";
import { useDashboardBookings } from "@/src/hooks/useDashboardBookings";
import { useAvailableSlots } from "@/src/hooks/useAvailableSlots";
import type { AvailabilitySettings as BookingAvailabilitySettings } from "@/src/types/bookingForm";
import DashboardFab from "@/src/components/Dashboard/DashboardFab";
import DashboardHeader from "@/src/components/Dashboard/DashboardHeader";
import DashboardFilterBar, {
  type DashboardRange,
} from "@/src/components/Dashboard/DashboardFilterBar";
import DashboardStatCards from "@/src/components/Dashboard/DashboardStatCards";
import WorkspaceOverviewCard from "@/src/components/Dashboard/WorkspaceOverviewCard";
import UpcomingAppointmentsList from "@/src/components/Dashboard/UpcomingAppointmentsList";
import PlanUsageCard from "@/src/components/Dashboard/PlanUsageCard";
import RecentActivityFeed from "@/src/components/Dashboard/RecentActivityFeed";
import { PublicBookingPreviewCard } from "@/src/components/Dashboard/PublicBookingPreviewCard";
import CopyPublicLinkButton from "@/src/components/Dashboard/CopyPublicLinkButton";
import QrCodePublicLinkButton from "@/src/components/Dashboard/QrCodePublicLinkButton";
import DashboardIcon from "@/src/components/Dashboard/DashboardIcon";
import { DashboardUpgradeModal } from "@/src/components/Subscription/DashboardUpgradeModal";
import { useSubscription } from "@/src/hooks/useSubscription";
import {
  is_whatsapp_admin_enabled,
  is_whatsapp_user_enabled,
} from "@/lib/workspace-notification-flags";

const BOOKINGS_LABEL: Record<DashboardRange, string> = {
  today: "Today's Bookings",
  week: "This Week's Bookings",
  month: "This Month's Bookings",
};

const AVAILABLE_SLOTS_HINT: Record<DashboardRange, string> = {
  today: "Open slots today",
  week: "Open slots next 7 days",
  month: "Open slots rest of month",
};

const UPCOMING_HINT: Record<DashboardRange, string> = {
  today: "Active later today",
  week: "Active this week",
  month: "Active this month",
};

const NO_SHOWS_HINT: Record<DashboardRange, string> = {
  today: "Missed today",
  week: "Missed this week",
  month: "Missed this month",
};

const Dashboard: React.FC = () => {
  const { open: open_create_booking } = useCreateBookingModal();
  const { user } = useAuth();
  const { settings, availability, general } = useWorkspaceSettings();
  const { loading, bookingsByStatus, bookingsTotal, bookingsByDay, trends } =
    useDashboardCounts(user);

  const [range, set_range] = useState<DashboardRange>("today");
  const [view_date] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [dashboard_refresh_key, set_dashboard_refresh_key] = useState(0);
  const [show_upgrade_modal, set_show_upgrade_modal] = useState(false);

  useEffect(() => {
    const on_bookings_refresh = () => {
      set_dashboard_refresh_key((k) => k + 1);
    };
    window.addEventListener("bookings-viewed-update", on_bookings_refresh);
    return () =>
      window.removeEventListener("bookings-viewed-update", on_bookings_refresh);
  }, []);

  const {
    today_bookings,
    today_loading,
    week_bookings,
    week_loading,
    month_bookings,
    month_loading,
  } = useDashboardBookings(user, view_date, dashboard_refresh_key);
  const { data: subscription_data, loading: subscription_loading } = useSubscription(
    Boolean(user),
  );

  const user_name =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "User";

  // Show the upgrade CTA only once bookings usage reaches the plan warning
  // threshold (80% of the free-plan limit). Unlimited/paid plans report false.
  const show_upgrade_cta = subscription_data?.thresholds.booking_warning === true;

  const week_total = useMemo(
    () => bookingsByDay.reduce((sum, value) => sum + value, 0),
    [bookingsByDay],
  );

  const bookings_count =
    range === "today"
      ? today_bookings.length
      : range === "week"
        ? week_total
        : month_bookings.length;

  // `bookingsByDay` is a rolling 7-day window ending today, so index 6 = today, 5 = yesterday.
  const bookings_trend = useMemo(() => {
    if (range !== "today" || bookingsByDay.length < 7) return undefined;
    const today_count = bookingsByDay[6] ?? 0;
    const yesterday_count = bookingsByDay[5] ?? 0;
    if (today_count === yesterday_count) return undefined;
    if (yesterday_count === 0) {
      return { direction: "up" as const, percent: 100 };
    }
    const pct = Math.round(
      ((today_count - yesterday_count) / yesterday_count) * 100,
    );
    if (pct === 0) return undefined;
    return {
      direction: pct > 0 ? ("up" as const) : ("down" as const),
      percent: Math.abs(pct),
    };
  }, [range, bookingsByDay]);

  const range_bookings =
    range === "today"
      ? today_bookings
      : range === "week"
        ? week_bookings
        : month_bookings;

  const no_shows_count = useMemo(
    () =>
      range_bookings.filter(
        (b) => String(b.status ?? "").toLowerCase() === "no-show",
      ).length,
    [range_bookings],
  );

  // Upcoming = active (pending/confirmed) bookings still in the future, within range.
  const upcoming_count = useMemo(() => {
    const now = Date.now();
    return range_bookings.filter((b) => {
      const status = String(b.status ?? "").toLowerCase();
      const active = status === "" || status === "pending" || status === "confirmed";
      const future = b.start_at ? new Date(b.start_at).getTime() > now : false;
      return active && future;
    }).length;
  }, [range_bookings]);

  const { count: available_slots_count, loading: available_slots_loading } =
    useAvailableSlots(
      user,
      range,
      availability as unknown as BookingAvailabilitySettings | null,
      general.timezone ?? null,
    );

  const available_slots_display = available_slots_loading
    ? "…"
    : available_slots_count == null
      ? "—"
      : available_slots_count.toLocaleString();

  const confirmed_today = useMemo(
    () =>
      today_bookings.filter(
        (b) => String(b.status ?? "").toLowerCase() === "confirmed",
      ).length,
    [today_bookings],
  );

  const confirmed_today_secondary = today_bookings.length
    ? `${Math.round((confirmed_today / today_bookings.length) * 100)}% of today's bookings`
    : "No bookings today";

  const completion_rate_display = useMemo(() => {
    const completed = bookingsByStatus["completed"] ?? 0;
    if (bookingsTotal <= 0) return "—";
    return `${Math.round((completed / bookingsTotal) * 100)}%`;
  }, [bookingsByStatus, bookingsTotal]);

  // Week-over-week change in completion rate (percentage points).
  const completion_trend = useMemo(() => {
    const { completion_this_week: cur, completion_prev_week: prev } = trends;
    if (cur.total === 0 || prev.total === 0) return undefined;
    const this_rate = (cur.completed / cur.total) * 100;
    const prev_rate = (prev.completed / prev.total) * 100;
    const diff = Math.round(this_rate - prev_rate);
    if (diff === 0) return undefined;
    return {
      direction: diff > 0 ? ("up" as const) : ("down" as const),
      percent: Math.abs(diff),
      label: "vs last week",
    };
  }, [trends]);

  // Month-over-month change in total bookings.
  const total_bookings_trend = useMemo(() => {
    const { bookings_this_month: cur, bookings_prev_month: prev } = trends;
    if (prev === 0) {
      if (cur > 0) {
        return { direction: "up" as const, percent: 100, label: "vs last month" };
      }
      return undefined;
    }
    const pct = Math.round(((cur - prev) / prev) * 100);
    if (pct === 0) return undefined;
    return {
      direction: pct > 0 ? ("up" as const) : ("down" as const),
      percent: Math.abs(pct),
      label: "vs last month",
    };
  }, [trends]);

  const whatsapp_active =
    is_whatsapp_admin_enabled(settings.notifications) ||
    is_whatsapp_user_enabled(settings.notifications);
  const email_active = settings.notifications?.["email-reminder"] === true;

  const range_loading =
    range === "today"
      ? today_loading
      : range === "week"
        ? week_loading
        : month_loading;

  const stat_loading = loading || range_loading;

  return (
    <div className="space-y-6 pb-28 text-slate-900">
      <DashboardHeader
        user_name={user_name}
        subtitle="Here's what's happening with your workspace today."
        actions={
          <>
            <button
              type="button"
              onClick={open_create_booking}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <DashboardIcon name="plus" size={17} className="text-indigo-600" />
              Create Booking
            </button>
            <CopyPublicLinkButton />
            <QrCodePublicLinkButton />
            {show_upgrade_cta && (
              <button
                type="button"
                onClick={() => set_show_upgrade_modal(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700"
              >
                <DashboardIcon name="trend" size={17} />
                Upgrade Plan
              </button>
            )}
          </>
        }
      />

      <DashboardFilterBar range={range} on_range_change={set_range} />

      <DashboardStatCards
        loading={stat_loading}
        bookings_label={BOOKINGS_LABEL[range]}
        bookings_count={bookings_count}
        bookings_trend={bookings_trend}
        upcoming_count={upcoming_count}
        upcoming_hint={UPCOMING_HINT[range]}
        available_slots_display={available_slots_display}
        available_slots_hint={AVAILABLE_SLOTS_HINT[range]}
        no_shows_count={no_shows_count}
        no_shows_hint={NO_SHOWS_HINT[range]}
      />

      <section className="grid gap-6 xl:grid-cols-[1.4fr_0.85fr]">
        <div className="space-y-6">
          <WorkspaceOverviewCard
            loading={loading}
            confirmed_today={confirmed_today}
            confirmed_today_secondary={confirmed_today_secondary}
            completion_rate_display={completion_rate_display}
            completion_trend={completion_trend}
            total_bookings={bookingsTotal}
            total_bookings_trend={total_bookings_trend}
            whatsapp_active={whatsapp_active}
            email_active={email_active}
          />
          <UpcomingAppointmentsList
            bookings={range_bookings}
            loading={range_loading}
          />
        </div>

        <div className="space-y-6">
          <PublicBookingPreviewCard />
          <PlanUsageCard
            loading={subscription_loading}
            used={subscription_data?.usage.bookings_this_month ?? 0}
            limit={subscription_data?.usage.booking_limit ?? 250}
            onUpgrade={() => set_show_upgrade_modal(true)}
          />
          <RecentActivityFeed />
        </div>
      </section>

      <DashboardUpgradeModal
        open={show_upgrade_modal}
        onClose={() => set_show_upgrade_modal(false)}
        usedBookings={subscription_data?.usage.bookings_this_month ?? 0}
        bookingLimit={subscription_data?.usage.booking_limit ?? 250}
      />

      {/* <DashboardFab /> */}
    </div>
  );
};

export default Dashboard;
