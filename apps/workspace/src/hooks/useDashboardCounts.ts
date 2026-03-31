'use client';

import { useEffect, useState } from 'react';

export interface DashboardServiceRow {
  id: string;
  name: string;
  department_name: string | null;
}

export interface DashboardCounts {
  bookings: number;
  teamMembers: number;
  services: number;
  servicesRows: DashboardServiceRow[];
}

const INITIAL_COUNTS: DashboardCounts = {
  bookings: 0,
  teamMembers: 0,
  services: 0,
  servicesRows: [],
};

export function useDashboardCounts(user: { id?: string } | null) {
  const [state, setState] = useState<{ counts: DashboardCounts; loading: boolean }>({
    counts: INITIAL_COUNTS,
    loading: true,
  });

  const userId = user?.id ?? null;

  useEffect(() => {
    if (!userId) {
      setState({ counts: INITIAL_COUNTS, loading: false });
      return;
    }

    const ac = new AbortController();

    const fetchCounts = async () => {
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const { data: { session } } = await supabase.auth.getSession();

        if (!session?.access_token || ac.signal.aborted) {
          if (!ac.signal.aborted) setState({ counts: INITIAL_COUNTS, loading: false });
          return;
        }

        const headers = { Authorization: `Bearer ${session.access_token}` };

        const [bookingsRes, teamMembersRes, servicesRes] = await Promise.all([
          fetch('/api/bookings', { headers, signal: ac.signal }),
          fetch('/api/team-members', { headers, signal: ac.signal }),
          fetch('/api/services', { headers, signal: ac.signal }),
        ]);

        if (ac.signal.aborted) return;

        const bookingsResult = bookingsRes.ok ? await bookingsRes.json() : null;
        const teamMembersResult = teamMembersRes.ok ? await teamMembersRes.json() : null;
        const servicesResult = servicesRes.ok ? await servicesRes.json() : null;

        if (ac.signal.aborted) return;

        const bookings = bookingsResult
          ? (bookingsResult.pagination?.total ?? bookingsResult.data?.length ?? 0)
          : 0;
        const teamMembers = teamMembersResult?.teamMembers?.length ?? 0;
        const services = servicesResult?.services?.length ?? 0;
        const rawServices = (servicesResult?.services ?? []) as Array<{
          id: string;
          name: string;
          departments?: { name: string } | { name: string }[] | null;
        }>;
        const servicesRows: DashboardServiceRow[] = rawServices.map((s) => {
          const d = s.departments;
          const department_name =
            d == null
              ? null
              : Array.isArray(d)
                ? (d[0]?.name ?? null)
                : (d.name ?? null);
          return { id: String(s.id), name: s.name, department_name };
        });

        setState({
          counts: { bookings, teamMembers, services, servicesRows },
          loading: false,
        });
      } catch (error) {
        if ((error as Error).name === 'AbortError') return;
        console.error('Error fetching dashboard counts:', error);
        if (!ac.signal.aborted) setState({ counts: INITIAL_COUNTS, loading: false });
      }
    };

    fetchCounts();
    return () => ac.abort();
  }, [userId]);

  return { counts: state.counts, loading: state.loading };
}
