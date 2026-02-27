'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import type {
  EventType,
  Department,
  ServiceProvider,
  Service,
} from '@/src/types/booking-entities';

interface TeamMember {
  id: string;
  email: string;
  name?: string;
  role?: string;
  raw_user_meta_data?: { full_name?: string; name?: string };
}

export function useEventTypes() {
  const [data, setData] = useState<EventType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/event-types', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (cancelled) return;
        const json = res.ok ? await res.json() : null;
        setData((json?.data ?? []) as EventType[]);
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  return { data, loading };
}

export function useDepartments() {
  const [data, setData] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const { data: result, error } = await supabase
          .from('departments')
          .select('id, name')
          .order('name');
        if (cancelled) return;
        if (!error && result) {
          setData(result.map((d) => ({ id: String(d.id), name: d.name })));
        }
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, []);

  return { data, loading };
}

export function useServices() {
  const [data, setData] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/services', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (cancelled) return;
        const json = res.ok ? await res.json() : null;
        setData((json?.services ?? []) as Service[]);
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  return { data, loading };
}

export function useServiceProviders() {
  const [data, setData] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/team-members', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (cancelled) return;
        const json = res.ok ? await res.json() : null;
        const members = (json?.teamMembers ?? []) as TeamMember[];
        const providers: ServiceProvider[] = members
          .filter((m) => m.role === 'service_provider')
          .map((m) => ({
            id: m.id,
            email: m.email ?? '',
            raw_user_meta_data: {
              full_name: m.raw_user_meta_data?.full_name,
              name: m.name,
            },
          }));
        setData(providers);
      } catch {
        if (!cancelled) setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  return { data, loading };
}
