'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { filterBookableEventTypes } from '@/src/utils/bookingFormUtils';
import type {
  EventType,
  Department,
  ServiceProvider,
  Service,
  TeamMemberDisplay,
} from '@/src/types/booking-entities';
import type { service_provider_display_source } from '@/src/utils/service_provider_display';
import { userActsAsServiceProviderFromMetadata } from '@/lib/service_provider_role';
import { normalizeDepartmentIdsFromUserMetadata } from '@/lib/sync_department_service_providers_from_team';

interface TeamMember {
  id: string;
  email: string;
  name?: string;
  role?: string;
  additional_roles?: string[];
  phone?: string | null;
  avatar_url?: string | null;
  raw_user_meta_data?: { full_name?: string; name?: string; phone?: string };
  is_workspace_owner?: boolean;
  deactivated?: boolean;
  departments?: unknown;
}

function memberActsAsServiceProvider(m: TeamMember): boolean {
  return userActsAsServiceProviderFromMetadata({
    role: m.role ?? null,
    is_workspace_owner: m.is_workspace_owner,
    additional_roles: m.additional_roles ?? null,
  });
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
        setData(filterBookableEventTypes((json?.data ?? []) as EventType[]));
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

export type UserServiceAssignmentRow = {
  id: number;
  user_id: string;
  service_id: string;
  workspace_id: number;
  created_at: string;
};

export function useUserServices() {
  const [rows, setRows] = useState<UserServiceAssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/user-services', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = res.ok ? await res.json() : null;
      setRows((json?.assignments ?? []) as UserServiceAssignmentRow[]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const byService = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!m.has(r.service_id)) m.set(r.service_id, new Set());
      m.get(r.service_id)!.add(r.user_id);
    }
    return m;
  }, [rows]);

  const byUser = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const r of rows) {
      if (!m.has(r.user_id)) m.set(r.user_id, new Set());
      m.get(r.user_id)!.add(r.service_id);
    }
    return m;
  }, [rows]);

  return { rows, byService, byUser, loading, refetch: fetchRows };
}

export type UserDepartmentAssignmentRow = {
  id: number;
  user_id: string;
  department_id: number;
  workspace_id: number;
  created_at: string;
};

export function useUserDepartments() {
  const [rows, setRows] = useState<UserDepartmentAssignmentRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setRows([]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/user-departments', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = res.ok ? await res.json() : null;
      setRows((json?.assignments ?? []) as UserDepartmentAssignmentRow[]);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  const byDepartment = useMemo(() => {
    const m = new Map<number, Set<string>>();
    for (const r of rows) {
      if (!m.has(r.department_id)) m.set(r.department_id, new Set());
      m.get(r.department_id)!.add(r.user_id);
    }
    return m;
  }, [rows]);

  const byUser = useMemo(() => {
    const m = new Map<string, Set<number>>();
    for (const r of rows) {
      if (!m.has(r.user_id)) m.set(r.user_id, new Set());
      m.get(r.user_id)!.add(r.department_id);
    }
    return m;
  }, [rows]);

  return { rows, byDepartment, byUser, loading, refetch: fetchRows };
}

function team_member_to_owner_source(
  m: TeamMember
): service_provider_display_source {
  const phoneFromMeta = m.raw_user_meta_data?.phone;
  const phone =
    typeof m.phone === 'string' && m.phone.trim() !== ''
      ? m.phone.trim()
      : typeof phoneFromMeta === 'string' && phoneFromMeta.trim() !== ''
        ? phoneFromMeta.trim()
        : undefined;
  return {
    email: m.email ?? '',
    raw_user_meta_data: {
      full_name: m.raw_user_meta_data?.full_name,
      name: m.name ?? m.raw_user_meta_data?.name,
      phone,
    },
  };
}

function team_member_to_display(m: TeamMember): TeamMemberDisplay {
  return {
    id: m.id,
    email: m.email ?? '',
    name:
      m.raw_user_meta_data?.full_name ||
      m.name ||
      m.raw_user_meta_data?.name ||
      undefined,
  };
}

export function useServiceProviders() {
  const [data, setData] = useState<ServiceProvider[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberDisplay[]>([]);
  const [workspaceOwner, setWorkspaceOwner] =
    useState<service_provider_display_source | null>(null);
  const [workspaceOwnerUserId, setWorkspaceOwnerUserId] = useState<string | null>(
    null
  );
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
        const ownerMember = members.find((m) => m.is_workspace_owner === true);
        if (!cancelled) {
          setWorkspaceOwner(
            ownerMember ? team_member_to_owner_source(ownerMember) : null
          );
          setWorkspaceOwnerUserId(ownerMember?.id ?? null);
        }
        if (!cancelled) {
          setTeamMembers(members.map(team_member_to_display));
        }
        const providers: ServiceProvider[] = members
          .filter(memberActsAsServiceProvider)
          .map((m) => {
            const phoneFromMeta = m.raw_user_meta_data?.phone;
            const phone =
              typeof m.phone === 'string' && m.phone.trim() !== ''
                ? m.phone.trim()
                : typeof phoneFromMeta === 'string' &&
                    phoneFromMeta.trim() !== ''
                  ? phoneFromMeta.trim()
                  : undefined;
            const departments =
              normalizeDepartmentIdsFromUserMetadata(m.departments);
            return {
              id: m.id,
              email: m.email ?? '',
              departments,
              deactivated: Boolean(m.deactivated),
              is_workspace_owner: m.is_workspace_owner === true,
              avatar_url:
                typeof m.avatar_url === 'string' && m.avatar_url.trim() !== ''
                  ? m.avatar_url.trim()
                  : null,
              raw_user_meta_data: {
                full_name: m.raw_user_meta_data?.full_name,
                name: m.name,
                phone,
              },
            };
          });
        setData(providers);
      } catch {
        if (!cancelled) {
          setData([]);
          setTeamMembers([]);
          setWorkspaceOwner(null);
          setWorkspaceOwnerUserId(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => { cancelled = true; };
  }, []);

  return { data, teamMembers, workspaceOwner, workspaceOwnerUserId, loading };
}
