'use client';

import { authFetch } from '@/src/lib/auth_session';
import { useEffect, useState } from 'react';
import { useAuth } from '@/src/providers/AuthProvider';
import { toDateKey } from '@/src/components/Calendar/calendar_utils';
import { get_dashboard_week_days } from '@/src/utils/dashboard_week';
import type { Booking } from '@/src/types/booking';
import type { dashboard_bookings_state } from '@/src/types/dashboard_bookings_state';

type BookingsApiResponse = {
  data?: Booking[];
};

function sort_bookings_by_start(bookings: Booking[]): Booking[] {
  return [...bookings].sort((a, b) => {
    const aTime = a.start_at ? new Date(a.start_at).getTime() : 0;
    const bTime = b.start_at ? new Date(b.start_at).getTime() : 0;
    return aTime - bTime;
  });
}

async function parse_bookings_response(
  res: Response,
): Promise<Booking[]> {
  if (!res.ok) return [];
  const json = (await res.json()) as BookingsApiResponse;
  return json.data ?? [];
}

export function useDashboardBookings(
  user: { id?: string } | null,
  view_date: Date,
  refresh_key = 0,
) {
  const { accessToken } = useAuth();
  const [state, setState] = useState<dashboard_bookings_state>({
    today_bookings: [],
    today_loading: true,
    next_appointment: null,
    next_loading: true,
    upcoming_appointments: [],
    upcoming_loading: true,
    week_bookings: [],
    week_loading: true,
    month_bookings: [],
    month_loading: true,
  });

  const user_id = user?.id ?? null;

  useEffect(() => {
    if (!user_id || !accessToken) {
      setState({
        today_bookings: [],
        today_loading: false,
        next_appointment: null,
        next_loading: false,
        upcoming_appointments: [],
        upcoming_loading: false,
        week_bookings: [],
        week_loading: false,
        month_bookings: [],
        month_loading: false,
      });
      return;
    }

    const ac = new AbortController();

    const run = async () => {
      setState((prev) => ({
        ...prev,
        today_loading: true,
        next_loading: true,
        upcoming_loading: true,
        week_loading: true,
        month_loading: true,
      }));

      if (!accessToken || ac.signal.aborted) {
        if (!ac.signal.aborted) {
          setState({
            today_bookings: [],
            today_loading: false,
            next_appointment: null,
            next_loading: false,
            upcoming_appointments: [],
            upcoming_loading: false,
            week_bookings: [],
            week_loading: false,
            month_bookings: [],
            month_loading: false,
          });
        }
        return;
      }

      // Priority: small upcoming query for the main dashboard list (not blocked by week/month).
      const load_upcoming = async () => {
        try {
          const res = await authFetch('/api/bookings?sort=upcoming&limit=10', {
            signal: ac.signal,
          });
          if (ac.signal.aborted) return;
          const rows = sort_bookings_by_start(await parse_bookings_response(res));
          if (ac.signal.aborted) return;
          setState((prev) => ({
            ...prev,
            upcoming_appointments: rows,
            upcoming_loading: false,
            next_appointment: rows[0] ?? null,
            next_loading: false,
          }));
        } catch (error) {
          if ((error as Error).name === 'AbortError') return;
          console.error('useDashboardBookings upcoming:', error);
          if (!ac.signal.aborted) {
            setState((prev) => ({
              ...prev,
              upcoming_appointments: [],
              upcoming_loading: false,
              next_appointment: null,
              next_loading: false,
            }));
          }
        }
      };

      void load_upcoming();

      try {
        const today_key = toDateKey(new Date());

        const week_days = get_dashboard_week_days();
        const week_params = new URLSearchParams({
          start_date: week_days[0].dateString,
          end_date: week_days[week_days.length - 1].dateString,
        });

        const start_of_month = new Date(view_date.getFullYear(), view_date.getMonth(), 1);
        const end_of_month = new Date(view_date.getFullYear(), view_date.getMonth() + 1, 0);
        const range_params = new URLSearchParams({
          start_date: toDateKey(start_of_month),
          end_date: toDateKey(end_of_month),
        });

        const [today_res, week_res, month_res] = await Promise.all([
          authFetch(`/api/bookings?date=${today_key}&limit=150`, { signal: ac.signal }),
          authFetch(`/api/bookings?${week_params.toString()}&limit=500`, { signal: ac.signal }),
          authFetch(`/api/bookings?${range_params.toString()}`, { signal: ac.signal }),
        ]);

        if (ac.signal.aborted) return;

        const [today_rows, week_rows, month_rows] = await Promise.all([
          parse_bookings_response(today_res),
          parse_bookings_response(week_res),
          parse_bookings_response(month_res),
        ]);

        if (ac.signal.aborted) return;

        setState((prev) => ({
          ...prev,
          today_bookings: sort_bookings_by_start(today_rows),
          today_loading: false,
          week_bookings: week_rows,
          week_loading: false,
          month_bookings: month_rows,
          month_loading: false,
        }));
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        console.error('useDashboardBookings:', error);
        if (!ac.signal.aborted) {
          setState((prev) => ({
            ...prev,
            today_bookings: [],
            today_loading: false,
            week_bookings: [],
            week_loading: false,
            month_bookings: [],
            month_loading: false,
          }));
        }
      }
    };

    run();
    return () => ac.abort();
  }, [user_id, accessToken, view_date, refresh_key]);

  return state;
}
