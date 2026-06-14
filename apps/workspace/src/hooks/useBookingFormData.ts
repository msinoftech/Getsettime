import { useState, useEffect, useMemo } from 'react';
import type {
  AvailabilitySettings,
  Booking,
  Department,
  EventType,
  Service,
  ServiceProvider,
} from '@/src/types/bookingForm';
import type { IntakeFormSettings, meeting_options_settings } from '@/src/types/workspace';
import type { workspace_notifications_settings } from '@/lib/workspace-notification-flags';
import { getAllowedServiceIds, isServicesEnabled } from '@/src/utils/intakeForm';
import { CALENDAR_BUFFER_DAYS, CALENDAR_BUFFER_DAYS_BEFORE } from '@/src/constants/booking';
import { userActsAsServiceProviderFromMetadata } from '@/lib/service_provider_role';
import { serviceIdsFromUserServiceAssignments } from '@/src/utils/bookingServiceAssignments';
import {
  filterBookableDepartments,
  filterEventTypesForServiceProvider,
  memberActsInDepartment,
} from '@/src/utils/bookingFormUtils';
import { resolveAvailabilityForServiceProvider } from '@/src/utils/availabilityResolution';

interface TeamMemberRow {
  id: string;
  email?: string | null;
  name: string;
  education?: string | null;
  experience?: string | null;
  specialty?: string | null;
  role?: string | null;
  additional_roles?: string[];
  departments?: number[];
  deactivated?: boolean;
  is_workspace_owner?: boolean;
}

interface UseBookingFormDataParams {
  selectedDepartment: Department | null;
  selectedProvider: ServiceProvider | null;
  days: Date[];
  intakeForm: IntakeFormSettings | undefined;
  onAvailabilityChange?: () => void;
}

export function useBookingFormData({
  selectedDepartment,
  selectedProvider,
  days,
  intakeForm,
  onAvailabilityChange,
}: UseBookingFormDataParams) {
  const [allDepartments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [workspaceMembers, setWorkspaceMembers] = useState<TeamMemberRow[]>([]);

  const departments = useMemo(
    () => filterBookableDepartments(allDepartments, workspaceMembers),
    [allDepartments, workspaceMembers]
  );
  const [workspaceOwnerUserId, setWorkspaceOwnerUserId] = useState<string | null>(null);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loadingEventTypes, setLoadingEventTypes] = useState(true);
  const [availabilitySettings, setAvailabilitySettings] = useState<AvailabilitySettings | null>(null);
  const [existingBookings, setExistingBookings] = useState<Booking[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [providerScopedCatalogServices, setProviderScopedCatalogServices] = useState<Service[]>([]);
  const [loadingProviderScopedCatalog, setLoadingProviderScopedCatalog] = useState(false);
  const [providerScopedCatalogSettled, setProviderScopedCatalogSettled] = useState(false);
  const [workspaceName, setWorkspaceName] = useState<string>('Get Set Time');
  const [workspaceLogoUrl, setWorkspaceLogoUrl] = useState<string | null>(null);
  const [providerMeetingOptions, setProviderMeetingOptions] = useState<
    meeting_options_settings | undefined
  >(undefined);
  const [providerNotifications, setProviderNotifications] = useState<
    workspace_notifications_settings | undefined
  >(undefined);

  const providersActingInDepartment = useMemo((): ServiceProvider[] => {
    if (!selectedDepartment) return [];
    return workspaceMembers
      .filter(
        (m) =>
          !m.deactivated &&
          userActsAsServiceProviderFromMetadata({
            role: m.role ?? null,
            is_workspace_owner: m.is_workspace_owner === true,
            additional_roles: m.additional_roles,
          }) &&
          memberActsInDepartment(m.departments, selectedDepartment.id)
      )
      .map((m) => ({
        id: m.id,
        name: m.name,
        email: m.email ?? '',
        education: m.education ?? null,
        experience: m.experience ?? null,
        specialty: m.specialty ?? null,
        departments: Array.isArray(m.departments) ? m.departments : [],
        is_workspace_owner: m.is_workspace_owner,
        additional_roles: m.additional_roles,
        role: m.role ?? null,
      }));
  }, [selectedDepartment, workspaceMembers]);

  const showProviderPicker = useMemo(
    () => providersActingInDepartment.length > 0,
    [providersActingInDepartment]
  );

  const effectiveProviderId = useMemo(() => {
    if (!selectedDepartment) return null;
    if (!showProviderPicker) return workspaceOwnerUserId;
    if (selectedProvider?.id) return selectedProvider.id;
    if (providersActingInDepartment.length === 1) {
      return providersActingInDepartment[0].id;
    }
    return null;
  }, [
    selectedDepartment,
    showProviderPicker,
    workspaceOwnerUserId,
    selectedProvider?.id,
    providersActingInDepartment,
  ]);

  const needsExplicitProvider =
    departments.length > 0 && selectedDepartment !== null && showProviderPicker;

  const bookableEventTypes = useMemo(() => {
    if (needsExplicitProvider && !effectiveProviderId) return [];
    return filterEventTypesForServiceProvider(eventTypes, effectiveProviderId);
  }, [eventTypes, effectiveProviderId, needsExplicitProvider]);

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const [departmentsResponse, teamMembersResponse] = await Promise.all([
          fetch('/api/departments', { headers: { Authorization: `Bearer ${session.access_token}` } }),
          fetch('/api/team-members', { headers: { Authorization: `Bearer ${session.access_token}` } }),
        ]);

        if (departmentsResponse.ok) {
          const departmentsResult = await departmentsResponse.json();
          setDepartments(departmentsResult.departments || []);
        }

        if (teamMembersResponse.ok) {
          const teamMembersResult = await teamMembersResponse.json();
          const members = (teamMembersResult.teamMembers || []) as TeamMemberRow[];
          setWorkspaceMembers(members);
          const owner = members.find((m) => m.is_workspace_owner && !m.deactivated);
          setWorkspaceOwnerUserId(owner?.id ?? null);
        } else {
          setWorkspaceMembers([]);
          setWorkspaceOwnerUserId(null);
        }
      } catch (e) {
        console.error('Error fetching departments:', e);
      } finally {
        setLoadingDepartments(false);
      }
    };
    fetchInitial();
  }, []);

  useEffect(() => {
    if (!selectedDepartment) {
      setAvailabilitySettings(null);
      setExistingBookings([]);
      onAvailabilityChange?.();
    }
  }, [selectedDepartment, onAvailabilityChange]);

  useEffect(() => {
    if (needsExplicitProvider && !effectiveProviderId) {
      setEventTypes([]);
      setLoadingEventTypes(false);
      return;
    }

    const fetchEventTypes = async () => {
      setLoadingEventTypes(true);
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const params = new URLSearchParams();
        if (effectiveProviderId) {
          params.set('service_provider_id', effectiveProviderId);
        }
        const query = params.toString();
        const res = await fetch(
          query ? `/api/event-types?${query}` : '/api/event-types',
          {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }
        );
        if (res.ok) {
          const result = await res.json();
          setEventTypes(result.data || []);
        }
      } catch (e) {
        console.error('Error fetching event types:', e);
      } finally {
        setLoadingEventTypes(false);
      }
    };
    fetchEventTypes();
  }, [effectiveProviderId, needsExplicitProvider]);

  useEffect(() => {
    if (!effectiveProviderId && needsExplicitProvider) {
      setAvailabilitySettings(null);
      setExistingBookings([]);
      onAvailabilityChange?.();
      setLoadingAvailability(false);
      return;
    }
    if (loadingDepartments && departments.length === 0) return;

    const fetchAvailability = async () => {
      setLoadingAvailability(true);
      setAvailabilitySettings(null);
      setExistingBookings([]);
      onAvailabilityChange?.();
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setLoadingAvailability(false);
          return;
        }
        const res = await fetch('/api/settings', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const result = await res.json();
          const availability = result.settings?.availability || {};
          setAvailabilitySettings(
            resolveAvailabilityForServiceProvider(
              availability,
              effectiveProviderId
            ) as AvailabilitySettings
          );
        }
      } catch (e) {
        console.error('Error fetching availability settings:', e);
      } finally {
        setLoadingAvailability(false);
      }
    };
    fetchAvailability();
  }, [
    effectiveProviderId,
    departments.length,
    loadingDepartments,
    needsExplicitProvider,
    onAvailabilityChange,
  ]);

  useEffect(() => {
    const fetchWorkspaceName = async () => {
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch('/api/workspace', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const result = await res.json();
          if (result.workspace) {
            if (result.workspace.name) setWorkspaceName(result.workspace.name);
            if (result.workspace.logo_url) setWorkspaceLogoUrl(result.workspace.logo_url);
          }
        }
      } catch (e) {
        console.error('Error fetching workspace name:', e);
      }
    };
    fetchWorkspaceName();
  }, []);

  useEffect(() => {
    const fetchProviderSettings = async () => {
      if (!effectiveProviderId) {
        setProviderMeetingOptions(undefined);
        setProviderNotifications(undefined);
        return;
      }
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch(
          `/api/settings?service_provider_id=${encodeURIComponent(effectiveProviderId)}`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (!res.ok) return;
        const result = await res.json();
        setProviderMeetingOptions(result.settings?.meeting_options);
        setProviderNotifications(result.settings?.notifications);
      } catch (e) {
        console.error('Error fetching provider settings:', e);
      }
    };
    fetchProviderSettings();
  }, [effectiveProviderId]);

  useEffect(() => {
    const hasReqs = departments.length === 0 || !needsExplicitProvider || effectiveProviderId;
    if (!hasReqs) {
      setExistingBookings([]);
      return;
    }
    const startDate = days[0] ?? new Date();
    const endDate = days[days.length - 1] ?? new Date();
    const rangeStart = new Date(startDate);
    rangeStart.setDate(rangeStart.getDate() - CALENDAR_BUFFER_DAYS_BEFORE);
    const rangeEnd = new Date(endDate);
    rangeEnd.setDate(rangeEnd.getDate() + CALENDAR_BUFFER_DAYS);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const fetchBookings = async () => {
      setLoadingBookings(true);
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const url = effectiveProviderId
          ? `/api/bookings?start_date=${fmt(rangeStart)}&end_date=${fmt(rangeEnd)}&service_provider_id=${effectiveProviderId}`
          : `/api/bookings?start_date=${fmt(rangeStart)}&end_date=${fmt(rangeEnd)}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const result = await res.json();
          const active = (result.data || []).filter(
            (b: Booking & { service_provider_id?: string }) => {
              if (b.status === 'cancelled' || b.status === 'emergency' || b.status === 'deleted') return false;
              if (effectiveProviderId && b.service_provider_id !== effectiveProviderId) return false;
              return true;
            }
          );
          const calendarBusy = (result.calendar_busy || []).map(
            (b: { start_at: string; end_at: string }) => ({ ...b, status: 'confirmed' as const })
          );
          setExistingBookings([...active, ...calendarBusy]);
        }
      } catch (e) {
        console.error('Error fetching bookings:', e);
      } finally {
        setLoadingBookings(false);
      }
    };
    fetchBookings();
  }, [effectiveProviderId, days, departments.length, needsExplicitProvider]);

  useEffect(() => {
    if (!isServicesEnabled(intakeForm)) {
      setServices([]);
      return;
    }
    const fetchServices = async () => {
      setLoadingServices(true);
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch('/api/services', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data: { services?: Service[] } = await res.json();
          const all = data.services || [];
          const allowed = getAllowedServiceIds(intakeForm);
          const filtered = allowed.length > 0 ? all.filter((s) => allowed.includes(s.id)) : all;
          setServices(filtered);
        }
      } finally {
        setLoadingServices(false);
      }
    };
    fetchServices();
  }, [intakeForm]);

  useEffect(() => {
    if (!selectedDepartment || !effectiveProviderId) {
      setProviderScopedCatalogServices([]);
      setProviderScopedCatalogSettled(false);
      setLoadingProviderScopedCatalog(false);
      return;
    }

    setProviderScopedCatalogServices([]);
    setProviderScopedCatalogSettled(false);
    setLoadingProviderScopedCatalog(true);

    const fetchScoped = async () => {
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const [svcRes, linkRes] = await Promise.all([
          fetch('/api/services', {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch(
            `/api/user-services?user_id=${encodeURIComponent(effectiveProviderId)}`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }
          ),
        ]);
        if (!svcRes.ok) return;
        const data: { services?: Service[] } = await svcRes.json();
        const all = data.services || [];
        const linksJson = linkRes.ok
          ? ((await linkRes.json()) as { assignments?: { user_id: string; service_id: string }[] })
          : { assignments: [] };
        const assignedIds = serviceIdsFromUserServiceAssignments(
          linksJson.assignments ?? [],
          effectiveProviderId
        );
        const scoped = all.filter(
          (s) =>
            s.department_id === selectedDepartment.id &&
            s.status === 'active' &&
            assignedIds.has(s.id)
        );
        setProviderScopedCatalogServices(scoped);
      } finally {
        setLoadingProviderScopedCatalog(false);
        setProviderScopedCatalogSettled(true);
      }
    };
    fetchScoped();
  }, [selectedDepartment, effectiveProviderId]);

  return {
    departments,
    setDepartments,
    loadingDepartments,
    /** True when the selected department requires choosing a concrete host before availability loads */
    needsExplicitProvider,
    serviceProviders: providersActingInDepartment,
    loadingProviders: false,
    eventTypes: bookableEventTypes,
    loadingEventTypes,
    availabilitySettings,
    setAvailabilitySettings,
    existingBookings,
    loadingAvailability,
    loadingBookings,
    services,
    setServices,
    loadingServices,
    providerScopedCatalogServices,
    loadingProviderScopedCatalog,
    providerScopedCatalogSettled,
    workspaceOwnerUserId,
    showProviderPicker,
    workspaceName,
    workspaceLogoUrl,
    effectiveProviderId,
    providerMeetingOptions,
    providerNotifications,
  };
}
