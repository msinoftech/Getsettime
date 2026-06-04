"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/src/providers/AuthProvider";
import { useCreateBookingModal } from "@/src/providers/CreateBookingModalProvider";
import { useDashboardCounts } from "@/src/hooks/useDashboardCounts";
import { useDashboardBookings } from "@/src/hooks/useDashboardBookings";
import DashboardCalendar from "@/src/components/Dashboard/DashboardCalendar";
import DashboardFab from "@/src/components/Dashboard/DashboardFab";
import DashboardHeader from "@/src/components/Dashboard/DashboardHeader";
import DashboardHero from "@/src/components/Dashboard/DashboardHero";
import DashboardSideCards from "@/src/components/Dashboard/DashboardSideCards";
import DashboardStatCards from "@/src/components/Dashboard/DashboardStatCards";
import RecentActivityFeed from "@/src/components/Dashboard/RecentActivityFeed";
import SmartInsightsPanel from "@/src/components/Dashboard/SmartInsightsPanel";
import TodayTimeline from "@/src/components/Dashboard/TodayTimeline";
import WeeklyPerformanceChart from "@/src/components/Dashboard/WeeklyPerformanceChart";
import DashboardIcon from "@/src/components/Dashboard/DashboardIcon";
import { DashboardUpgradeModal } from "@/src/components/Subscription/DashboardUpgradeModal";
import { useSubscription } from "@/src/hooks/useSubscription";
import type { Booking } from "@/src/types/booking";

function reminder_fraction_today(bookings: Booking[]): { display: string; secondary: string } {
  const eligible = bookings.filter((b) => {
    const s = String(b.status ?? "").toLowerCase();
    return s !== "cancelled" && s !== "deleted" && s !== "no-show";
  });
  if (eligible.length === 0) {
    return { display: "—", secondary: "No active bookings today" };
  }
  const sent = eligible.filter(
    (b) =>
      b.sms_reminder_sent_at != null ||
      b.email_reminder_sent_at != null ||
      b.whatsapp_reminder_sent_at != null,
  ).length;
  const pct = Math.round((sent / eligible.length) * 100);
  return {
    display: `${pct}%`,
    secondary: `${sent}/${eligible.length} with a reminder logged`,
  };
}

const Dashboard: React.FC = () => {
  const { open: open_create_booking } = useCreateBookingModal();
  const { user } = useAuth();
  const {
    counts,
    loading,
    weekDayLabels,
    bookingsByDay,
    bookingsByStatus,
  } = useDashboardCounts(user);

  const [view_date, set_view_date] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });

  const [selected_date, set_selected_date] = useState<Date>(() => new Date());
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
    next_appointment,
    next_loading,
    month_bookings,
    month_loading,
  } = useDashboardBookings(user, view_date, dashboard_refresh_key);
  const { data: subscription_data, loading: subscription_loading } = useSubscription(
    Boolean(user),
  );

  const user_name =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "User";

  const team_display =
    counts.teamMembers == null ? "—" : String(counts.teamMembers);

  const { display: reminders_display, secondary: reminders_secondary } = useMemo(
    () => reminder_fraction_today(today_bookings),
    [today_bookings],
  );

  const cancelled_no_show_total = useMemo(() => {
    const c = bookingsByStatus["cancelled"] ?? 0;
    const n = bookingsByStatus["no-show"] ?? 0;
    return c + n;
  }, [bookingsByStatus]);

  return (
    <div className="space-y-6 pb-28 text-slate-900">
      <DashboardHeader
        user_name={user_name}
        actions={
          <>
            <button
              type="button"
              aria-label="Notifications"
              className="inline-flex h-[58px] w-[58px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-amber-400 shadow-[0_6px_20px_rgba(15,23,42,0.06)] transition hover:bg-slate-50"
            >
              {/* <DashboardIcon name="ring" size={18} /> */}
              🔔
            </button>
            <Link
              href="/billings"
              aria-label="Billing settings"
              className="inline-flex h-[58px] w-[58px] items-center justify-center rounded-2xl border border-slate-200 bg-white text-violet-300 shadow-[0_6px_20px_rgba(15,23,42,0.06)] transition hover:bg-slate-50"
            >
              <DashboardIcon name="settings" size={18} />
            </Link>
            <button
              type="button"
              onClick={() => set_show_upgrade_modal(true)}
              className="inline-flex h-[58px] items-center gap-2.5 rounded-[22px] bg-gradient-to-b from-amber-400 to-amber-500 px-8 text-lg font-black text-amber-950 shadow-[0_10px_24px_rgba(245,158,11,0.35)] transition hover:from-amber-300 hover:to-amber-400"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center" aria-hidden>
                <svg
                  viewBox="0 0 24 24"
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M3 17.8 10 10.8l2.7 2.7 5.3-5.3" />
                  <path d="M15.6 8.2H20v4.4" />
                </svg>
              </span>
              Upgrade Plan
            </button>
          </>
        }
      />

      <DashboardHero
        next_booking={next_appointment}
        next_loading={next_loading}
        onCreateBooking={open_create_booking}
        free_plan_usage_loading={subscription_loading}
        free_plan_usage={
          !subscription_loading && subscription_data?.plan?.slug === "free"
            ? {
                used: subscription_data.usage.bookings_this_month,
                limit: subscription_data.usage.booking_limit,
              }
            : null
        }
      />

      <DashboardStatCards
        loading={loading}
        total_bookings={counts.bookings}
        team_members_display={team_display}
        reminders_display={reminders_display}
        reminders_secondary={reminders_secondary}
      />

      <section className="grid gap-6 xl:grid-cols-[1.12fr_0.88fr]">
        <div className="space-y-6">
          <TodayTimeline bookings={today_bookings} loading={today_loading} />
          <WeeklyPerformanceChart
            loading={loading}
            week_day_labels={weekDayLabels}
            bookings_by_day={bookingsByDay}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            <RecentActivityFeed />
            <SmartInsightsPanel
              bookings_by_status={bookingsByStatus}
              week_day_labels={weekDayLabels}
              bookings_by_day={bookingsByDay}
            />
          </div>
        </div>

        <div className="space-y-6">
          <DashboardCalendar
            view_date={view_date}
            selected_date={selected_date}
            on_view_date_month_first={set_view_date}
            on_select_date={set_selected_date}
            month_bookings={month_bookings}
            month_loading={month_loading}
          />
          <DashboardSideCards missed_or_cancelled_count={cancelled_no_show_total} />
        </div>
      </section>

      <DashboardUpgradeModal
        open={show_upgrade_modal}
        onClose={() => set_show_upgrade_modal(false)}
        usedBookings={subscription_data?.usage.bookings_this_month ?? 0}
        bookingLimit={subscription_data?.usage.booking_limit ?? 250}
      />

      <DashboardFab />
    </div>
  );
};

export default Dashboard;
