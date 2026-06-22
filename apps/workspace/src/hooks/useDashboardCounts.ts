'use client';

import { useEffect, useMemo, useState } from 'react';
import { get_dashboard_week_days } from '@/src/utils/dashboard_week';
import type { dashboard_summary } from '@/src/types/dashboard_summary';

export interface DashboardServiceRow {
  id: string;
  name: string;
  department_name: string | null;
}

export interface DashboardCounts {
  bookings: number;
  upcomingBookings: number;
  teamMembers: number;
  services: number;
  servicesRows: DashboardServiceRow[];
}

const INITIAL_COUNTS: DashboardCounts = {
  bookings: 0,
  upcomingBookings: 0,
  teamMembers: 0,
  services: 0,
  servicesRows: [],
};

export type DashboardTrends = {
  bookings_this_month: number;
  bookings_prev_month: number;
  completion_this_week: { completed: number; total: number };
  completion_prev_week: { completed: number; total: number };
};

const EMPTY_TRENDS: DashboardTrends = {
  bookings_this_month: 0,
  bookings_prev_month: 0,
  completion_this_week: { completed: 0, total: 0 },
  completion_prev_week: { completed: 0, total: 0 },
};

export function useDashboardCounts(user: { id?: string } | null) {
  const [state, setState] = useState<{
    counts: DashboardCounts;
    loading: boolean;
    weekDayLabels: string[];
    bookingsByDay: number[];
    bookingsByStatus: Record<string, number>;
    bookingsTotal: number;
    trends: DashboardTrends;
  }>({
    counts: INITIAL_COUNTS,
    loading: true,
    weekDayLabels: [],
    bookingsByDay: [0, 0, 0, 0, 0, 0, 0],
    bookingsByStatus: {},
    bookingsTotal: 0,
    trends: EMPTY_TRENDS,
  });

  const userId = user?.id ?? null;

  const weekSlice = useMemo(() => {
    const days = get_dashboard_week_days();
    return {
      week_days_param: days.map((d) => d.dateString).join(','),
      week_day_labels: days.map((d) => d.label),
    };
  }, []);

  useEffect(() => {
    const { week_days_param, week_day_labels } = weekSlice;

    if (!userId) {
      setState({
        counts: INITIAL_COUNTS,
        loading: false,
        weekDayLabels: week_day_labels,
        bookingsByDay: [0, 0, 0, 0, 0, 0, 0],
        bookingsByStatus: {},
        bookingsTotal: 0,
        trends: EMPTY_TRENDS,
      });
      return;
    }

    const ac = new AbortController();

    const run = async () => {
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session?.access_token || ac.signal.aborted) {
          if (!ac.signal.aborted) {
            setState({
              counts: INITIAL_COUNTS,
              loading: false,
              weekDayLabels: week_day_labels,
              bookingsByDay: [0, 0, 0, 0, 0, 0, 0],
              bookingsByStatus: {},
              bookingsTotal: 0,
              trends: EMPTY_TRENDS,
            });
          }
          return;
        }

        const qs = new URLSearchParams({ week_days: week_days_param });
        const res = await fetch(`/api/dashboard/summary?${qs.toString()}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: ac.signal,
        });

        if (ac.signal.aborted) return;

        if (!res.ok) {
          console.error('Dashboard summary error:', res.status);
          setState({
            counts: INITIAL_COUNTS,
            loading: false,
            weekDayLabels: week_day_labels,
            bookingsByDay: [0, 0, 0, 0, 0, 0, 0],
            bookingsByStatus: {},
            bookingsTotal: 0,
            trends: EMPTY_TRENDS,
          });
          return;
        }

        const data = (await res.json()) as dashboard_summary;

        if (ac.signal.aborted) return;

        const servicesRows: DashboardServiceRow[] = data.services.map((s) => ({
          id: s.id,
          name: s.name,
          department_name: s.department_name,
        }));

        setState({
          counts: {
            bookings: data.bookings_total,
            upcomingBookings: data.upcoming_bookings_count ?? 0,
            teamMembers: data.team_members_count ?? 0,
            services: data.services.length,
            servicesRows,
          },
          loading: false,
          weekDayLabels: week_day_labels,
          bookingsByDay: data.bookings_by_day ?? [0, 0, 0, 0, 0, 0, 0],
          bookingsByStatus: data.bookings_by_status ?? {},
          bookingsTotal: data.bookings_total,
          trends: {
            bookings_this_month: data.bookings_this_month ?? 0,
            bookings_prev_month: data.bookings_prev_month ?? 0,
            completion_this_week: data.completion_this_week ?? {
              completed: 0,
              total: 0,
            },
            completion_prev_week: data.completion_prev_week ?? {
              completed: 0,
              total: 0,
            },
          },
        });
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        console.error('Error fetching dashboard summary:', error);
        if (!ac.signal.aborted) {
          setState({
            counts: INITIAL_COUNTS,
            loading: false,
            weekDayLabels: week_day_labels,
            bookingsByDay: [0, 0, 0, 0, 0, 0, 0],
            bookingsByStatus: {},
            bookingsTotal: 0,
            trends: EMPTY_TRENDS,
          });
        }
      }
    };

    run();
    return () => ac.abort();
  }, [userId, weekSlice]);

  return {
    counts: state.counts,
    loading: state.loading,
    weekDayLabels: state.weekDayLabels,
    bookingsByDay: state.bookingsByDay,
    bookingsByStatus: state.bookingsByStatus,
    bookingsTotal: state.bookingsTotal,
    trends: state.trends,
  };
}
