"use client";

import React, { useMemo, useState } from "react";
import { useAuth } from "@/src/providers/AuthProvider";
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

  const {
    today_bookings,
    today_loading,
    next_appointment,
    next_loading,
    month_bookings,
    month_loading,
  } = useDashboardBookings(user, view_date);

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
      <DashboardHeader user_name={user_name} />

      <DashboardHero next_booking={next_appointment} next_loading={next_loading} />

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

      <DashboardFab />
    </div>
  );
};

export default Dashboard;
