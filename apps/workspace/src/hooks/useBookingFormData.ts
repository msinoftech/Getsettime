'use client';

import { authFetch } from '@/src/lib/auth_session';
import { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '@/src/providers/AuthProvider';
import { useWorkspaceUsers } from '@/src/providers/WorkspaceUsersProvider';
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
import {
  event_type_session_duration_minutes,
  resolve_booking_data_fetch_range,
} from '@/src/features/booking-flow';
import { userActsAsServiceProviderFromMetadata } from '@/lib/service_provider_role';
import { serviceIdsFromUserServiceAssignments } from '@/src/utils/bookingServiceAssignments';
import {
  filterBookableDepartments,
  filterBookableEventTypes,
  filterDepartmentsForEventType,
  filterEventTypesForServiceProvider,
  filterProvidersForEventType,
  memberActsInDepartment,
} from '@/src/utils/bookingFormUtils';
import { resolveAvailabilityForServiceProvider } from '@/src/utils/availabilityResolution';
import {
  calendar_busy_without_booking_overlap,
  flatten_embed_booking_row,
} from '@/lib/booking_capacity';
import { parse_event_type_recurrence } from '@/src/features/event-types/event_type_recurrence';
import { useWorkspaceSettings } from '@/src/hooks/useWorkspaceSettings';
import {
  resolve_member_profile_highlights,
  resolve_workspace_owner_profile_highlights,
} from '@/src/utils/booking_host_profile';

interface TeamMemberRow {
  id: string;
  email?: string | null;
  name: string;
  education?: string | null;
  experience?: string | null;
  specialty?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  role?: string | null;
  additional_roles?: string[];
  departments?: number[];
  deactivated?: boolean;
  is_workspace_owner?: boolean;
}

interface UseBookingFormDataParams {
  selectedDepartment: Department | null;
  selectedProvider: ServiceProvider | null;
  /** Scopes departments and providers to the ones assigned to this event type. */
  selectedType: EventType | null;
  /**
   * When set (e.g. reschedule modal), drives booking/exception fetch range without
   * scoping department/provider lists to the event type's current assignments.
   */
  schedulingEventType?: EventType | null;
  /** Keeps the event-type list stable after the user picks a type (event-type-first flows). */
  lockEventTypeCatalog?: boolean;
  days: Date[];
  intakeForm: IntakeFormSettings | undefined;
  onAvailabilityChange?: () => void;
  /** Locks fetch scope to this provider (e.g. reschedule / admin edit modal). */
  fixedServiceProviderId?: string | null;
  /** When true, event types are shown before department/provider selection. */
  eventTypeBeforeDepartment?: boolean;
}

export function useBookingFormData({
  selectedDepartment,
  selectedProvider,
  selectedType,
  schedulingEventType = null,
  lockEventTypeCatalog = false,
  days,
  intakeForm,
  onAvailabilityChange,
  fixedServiceProviderId = null,
  eventTypeBeforeDepartment = false,
}: UseBookingFormDataParams) {
  const { accessToken } = useAuth();
  const eventTypeForFetch = schedulingEventType ?? selectedType;
  const {
    settings: workspaceSettings,
    general,
    availability: workspaceAvailability,
    workspaceName: cachedWorkspaceName,
    workspaceLogo: cachedWorkspaceLogo,
    loading: workspaceSettingsLoading,
  } = useWorkspaceSettings();
  const { members: workspaceUsers } = useWorkspaceUsers();
  const workspaceMembers = useMemo<TeamMemberRow[]>(
    () =>
      workspaceUsers.map((m) => ({
        id: m.id,
        email: m.email,
        name: m.name,
        education: m.education,
        experience: m.experience,
        specialty: m.specialty,
        bio: m.bio ?? null,
        avatar_url: m.avatar_url ?? null,
        role: m.role,
        additional_roles: m.additional_roles,
        departments: m.departments,
        deactivated: m.deactivated,
        is_workspace_owner: m.is_workspace_owner,
      })),
    [workspaceUsers]
  );
  const workspaceOwnerUserId = useMemo(
    () =>
      workspaceUsers.find((m) => m.is_workspace_owner && !m.deactivated)?.id ??
      null,
    [workspaceUsers]
  );
  const [allDepartments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);

  const departments = useMemo(
    () =>
      filterDepartmentsForEventType(
        filterBookableDepartments(allDepartments, workspaceMembers),
        selectedType
      ),
    [allDepartments, workspaceMembers, selectedType]
  );
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loadingEventTypes, setLoadingEventTypes] = useState(true);
  const [availabilitySettings, setAvailabilitySettings] = useState<AvailabilitySettings | null>(null);
  const [existingBookings, setExistingBookings] = useState<Booking[]>([]);
  const [dateExceptions, setDateExceptions] = useState<import('@/src/types/date_exceptions').date_exception[]>([]);
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
    const acting = workspaceMembers
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
        avatar_url: m.avatar_url ?? null,
        departments: Array.isArray(m.departments) ? m.departments : [],
        is_workspace_owner: m.is_workspace_owner,
        additional_roles: m.additional_roles,
        role: m.role ?? null,
      }));
    return filterProvidersForEventType(acting, selectedType);
  }, [selectedDepartment, workspaceMembers, selectedType]);

  const showProviderPicker = useMemo(
    () => providersActingInDepartment.length > 1,
    [providersActingInDepartment]
  );

  const effectiveProviderId = useMemo(() => {
    const fixed = fixedServiceProviderId?.trim();
    if (fixed) return fixed;
    if (!selectedDepartment) return null;
    if (selectedProvider?.id) return selectedProvider.id;
    if (providersActingInDepartment.length === 1) {
      return providersActingInDepartment[0].id;
    }
    if (!showProviderPicker) return workspaceOwnerUserId;
    return null;
  }, [
    fixedServiceProviderId,
    selectedDepartment,
    showProviderPicker,
    workspaceOwnerUserId,
    selectedProvider?.id,
    providersActingInDepartment,
  ]);

  const needsExplicitProvider =
    !fixedServiceProviderId?.trim() &&
    departments.length > 0 &&
    selectedDepartment !== null &&
    showProviderPicker;

  const resolvedAvailabilityProviderRef = useRef<string | null | undefined>(
    undefined
  );

  const bookableEventTypes = useMemo(() => {
    if (
      needsExplicitProvider &&
      !effectiveProviderId &&
      !lockEventTypeCatalog &&
      !eventTypeBeforeDepartment
    ) {
      return [];
    }
    const provider_scope_id = lockEventTypeCatalog ? null : effectiveProviderId;
    const filtered = filterBookableEventTypes(
      filterEventTypesForServiceProvider(eventTypes, provider_scope_id)
    );
    if (
      selectedType &&
      !filtered.some((et) => String(et.id) === String(selectedType.id))
    ) {
      return [selectedType, ...filtered];
    }
    return filtered;
  }, [
    eventTypes,
    effectiveProviderId,
    needsExplicitProvider,
    lockEventTypeCatalog,
    selectedType,
    eventTypeBeforeDepartment,
  ]);

  useEffect(() => {
    if (!accessToken) return;

    const fetchInitial = async () => {
      try {
        const departmentsResponse = await authFetch('/api/departments');

        if (departmentsResponse.ok) {
          const departmentsResult = await departmentsResponse.json();
          setDepartments(departmentsResult.departments || []);
        }
      } catch (e) {
        console.error('Error fetching departments:', e);
      } finally {
        setLoadingDepartments(false);
      }
    };
    fetchInitial();
  }, [accessToken]);

  useEffect(() => {
    if (!selectedDepartment) {
      setAvailabilitySettings(null);
      setExistingBookings([]);
      onAvailabilityChange?.();
    }
  }, [selectedDepartment, onAvailabilityChange]);

  const eventTypesCatalogLoadedRef = useRef(false);

  useEffect(() => {
    eventTypesCatalogLoadedRef.current = false;
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;

    if (
      needsExplicitProvider &&
      !effectiveProviderId &&
      !lockEventTypeCatalog &&
      !eventTypeBeforeDepartment
    ) {
      // Keep any catalog already fetched; bookableEventTypes hides the list until
      // a provider is chosen. Do not wipe state here — that caused empty UI after
      // a successful /api/event-types response (see booking form HAR traces).
      setLoadingEventTypes(false);
      return;
    }
    if (lockEventTypeCatalog && eventTypesCatalogLoadedRef.current) return;

    let cancelled = false;
    const fetchEventTypes = async () => {
      if (!cancelled) setLoadingEventTypes(true);
      try {
        const params = new URLSearchParams();
        if (effectiveProviderId && !lockEventTypeCatalog) {
          params.set('service_provider_id', effectiveProviderId);
        }
        const query = params.toString();
        const res = await authFetch(
          query ? `/api/event-types?${query}` : '/api/event-types'
        );
        if (res.ok) {
          const result = await res.json();
          if (!cancelled) setEventTypes(result.data || []);
        }
      } catch (e) {
        console.error('Error fetching event types:', e);
      } finally {
        if (!cancelled) {
          setLoadingEventTypes(false);
          eventTypesCatalogLoadedRef.current = true;
        }
      }
    };
    void fetchEventTypes();
    return () => {
      cancelled = true;
    };
  }, [
    accessToken,
    needsExplicitProvider,
    lockEventTypeCatalog,
    eventTypeBeforeDepartment,
    lockEventTypeCatalog ? undefined : effectiveProviderId,
  ]);

  useEffect(() => {
    if (!effectiveProviderId && needsExplicitProvider) {
      if (resolvedAvailabilityProviderRef.current !== effectiveProviderId) {
        resolvedAvailabilityProviderRef.current = effectiveProviderId;
        setAvailabilitySettings(null);
        setExistingBookings([]);
        setDateExceptions([]);
        onAvailabilityChange?.();
      }
      setLoadingAvailability(false);
      return;
    }
    if (loadingDepartments && departments.length === 0 && !fixedServiceProviderId?.trim()) {
      return;
    }
    if (workspaceSettingsLoading) return;

    const provider_changed =
      resolvedAvailabilityProviderRef.current !== effectiveProviderId;
    resolvedAvailabilityProviderRef.current = effectiveProviderId;

    if (provider_changed) {
      onAvailabilityChange?.();
      setDateExceptions([]);
    }

    setLoadingAvailability(true);
    try {
      const availability = workspaceSettings?.availability ?? workspaceAvailability ?? {};
      setAvailabilitySettings(
        resolveAvailabilityForServiceProvider(
          availability,
          effectiveProviderId
        ) as AvailabilitySettings
      );
    } catch (e) {
      console.error('Error resolving availability settings:', e);
    } finally {
      setLoadingAvailability(false);
    }
  }, [
    effectiveProviderId,
    departments.length,
    loadingDepartments,
    needsExplicitProvider,
    fixedServiceProviderId,
    onAvailabilityChange,
    workspaceSettings,
    workspaceAvailability,
    workspaceSettingsLoading,
  ]);

  useEffect(() => {
    if (workspaceSettingsLoading) return;
    if (cachedWorkspaceName) setWorkspaceName(cachedWorkspaceName);
    if (cachedWorkspaceLogo) setWorkspaceLogoUrl(cachedWorkspaceLogo);
  }, [cachedWorkspaceName, cachedWorkspaceLogo, workspaceSettingsLoading]);

  useEffect(() => {
    if (!accessToken) return;

    const fetchProviderSettings = async () => {
      if (!effectiveProviderId) {
        setProviderMeetingOptions(undefined);
        setProviderNotifications(undefined);
        return;
      }
      try {
        const res = await authFetch(
          `/api/settings?service_provider_id=${encodeURIComponent(effectiveProviderId)}`
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
  }, [accessToken, effectiveProviderId]);

  const bookingFetchRangeKey = useMemo(() => {
    const providerTimezone = general?.timezone?.trim() || 'UTC';
    const duration = eventTypeForFetch
      ? event_type_session_duration_minutes(
          eventTypeForFetch,
          eventTypeForFetch.duration_minutes ?? 30
        )
      : 30;
    const { rangeStart, rangeEnd } = resolve_booking_data_fetch_range({
      days,
      event_type: eventTypeForFetch,
      provider_timezone: providerTimezone,
      duration_minutes: duration,
    });
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `${fmt(rangeStart)}|${fmt(rangeEnd)}|${providerTimezone}|${duration}`;
  }, [days, eventTypeForFetch, general?.timezone]);

  useEffect(() => {
    if (!accessToken) return;

    const hasReqs = departments.length === 0 || !needsExplicitProvider || effectiveProviderId;
    if (!hasReqs) {
      setExistingBookings([]);
      return;
    }
    const providerTimezone = general?.timezone?.trim() || 'UTC';
    const duration = eventTypeForFetch
      ? event_type_session_duration_minutes(
          eventTypeForFetch,
          eventTypeForFetch.duration_minutes ?? 30
        )
      : 30;
    const { rangeStart, rangeEnd } = resolve_booking_data_fetch_range({
      days,
      event_type: eventTypeForFetch,
      provider_timezone: providerTimezone,
      duration_minutes: duration,
    });
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let cancelled = false;
    const fetchBookings = async () => {
      setLoadingBookings(true);
      try {
        const url = effectiveProviderId
          ? `/api/bookings?start_date=${fmt(rangeStart)}&end_date=${fmt(rangeEnd)}&service_provider_id=${effectiveProviderId}`
          : `/api/bookings?start_date=${fmt(rangeStart)}&end_date=${fmt(rangeEnd)}`;
        const res = await authFetch(url);
        if (cancelled) return;
        if (res.ok) {
          const result = await res.json();
          const active = (result.data || [])
            .filter((b: Booking & { service_provider_id?: string }) => {
              if (b.status === 'cancelled' || b.status === 'emergency' || b.status === 'deleted') {
                return false;
              }
              if (
                effectiveProviderId &&
                b.service_provider_id &&
                b.service_provider_id !== effectiveProviderId
              ) {
                return false;
              }
              return true;
            })
            .map((b: Record<string, unknown>) => {
              const row = flatten_embed_booking_row(b);
              const nested = b.event_types as Record<string, unknown> | null | undefined;
              if (!row.recurrence_audience && nested?.recurrence) {
                row.recurrence_audience = parse_event_type_recurrence(nested.recurrence).audience;
              }
              return {
                ...row,
                invitee_email:
                  typeof b.invitee_email === 'string' ? b.invitee_email : null,
                invitee_phone:
                  typeof b.invitee_phone === 'string' ? b.invitee_phone : null,
                contact_id:
                  typeof b.contact_id === 'number' || typeof b.contact_id === 'string'
                    ? b.contact_id
                    : null,
                public_code:
                  typeof b.public_code === 'string' ? b.public_code : null,
              } as Booking;
            });
          const deduped_calendar_busy = calendar_busy_without_booking_overlap(
            active,
            result.calendar_busy || []
          );
          const calendarBusy = deduped_calendar_busy.map(
            (b: { start_at: string; end_at: string }) => ({
              ...b,
              status: 'confirmed' as const,
              occupancy_source: 'calendar' as const,
            })
          );
          setExistingBookings([...active, ...calendarBusy]);
        }
      } catch (e) {
        console.error('Error fetching bookings:', e);
      } finally {
        if (!cancelled) setLoadingBookings(false);
      }
    };
    const timer = window.setTimeout(() => {
      void fetchBookings();
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    accessToken,
    bookingFetchRangeKey,
    effectiveProviderId,
    departments.length,
    needsExplicitProvider,
    days,
    eventTypeForFetch,
    general?.timezone,
  ]);

  useEffect(() => {
    if (!accessToken) return;

    const hasReqs = departments.length === 0 || !needsExplicitProvider || effectiveProviderId;
    if (!hasReqs) {
      setDateExceptions([]);
      return;
    }
    const providerTimezone = general?.timezone?.trim() || 'UTC';
    const duration = eventTypeForFetch
      ? event_type_session_duration_minutes(
          eventTypeForFetch,
          eventTypeForFetch.duration_minutes ?? 30
        )
      : 30;
    const { rangeStart, rangeEnd } = resolve_booking_data_fetch_range({
      days,
      event_type: eventTypeForFetch,
      provider_timezone: providerTimezone,
      duration_minutes: duration,
    });
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    let cancelled = false;
    const fetchExceptions = async () => {
      try {
        const params = new URLSearchParams({
          from: fmt(rangeStart),
          to: fmt(rangeEnd),
          status: 'active',
          limit: '200',
        });
        if (effectiveProviderId) {
          params.set('provider_id', effectiveProviderId);
        }
        const res = await authFetch(`/api/date-exceptions?${params.toString()}`);
        if (cancelled) return;
        if (res.ok) {
          const result = await res.json();
          setDateExceptions(
            Array.isArray(result.exceptions) ? result.exceptions : []
          );
        }
      } catch (e) {
        console.error('Error fetching date exceptions:', e);
      }
    };
    const timer = window.setTimeout(() => {
      void fetchExceptions();
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [
    accessToken,
    bookingFetchRangeKey,
    effectiveProviderId,
    departments.length,
    needsExplicitProvider,
    days,
    eventTypeForFetch,
    general?.timezone,
  ]);

  useEffect(() => {
    if (!accessToken) return;

    if (!isServicesEnabled(intakeForm)) {
      setServices([]);
      return;
    }
    const fetchServices = async () => {
      setLoadingServices(true);
      try {
        const res = await authFetch('/api/services');
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
  }, [accessToken, intakeForm]);

  useEffect(() => {
    if (!accessToken) return;

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
        const [svcRes, linkRes] = await Promise.all([
          authFetch('/api/services'),
          authFetch(
            `/api/user-services?user_id=${encodeURIComponent(effectiveProviderId)}`
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
  }, [accessToken, selectedDepartment, effectiveProviderId]);

  const workspaceHostProfileHighlights = useMemo(
    () => resolve_workspace_owner_profile_highlights(workspaceMembers, workspaceOwnerUserId),
    [workspaceMembers, workspaceOwnerUserId]
  );

  const providerHostProfileHighlights = useMemo(() => {
    const providerId = fixedServiceProviderId?.trim();
    if (!providerId) return null;
    if (providerId === workspaceOwnerUserId) return null;
    return resolve_member_profile_highlights(workspaceMembers, providerId);
  }, [workspaceMembers, fixedServiceProviderId, workspaceOwnerUserId]);

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
    dateExceptions,
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
    workspaceHostProfileHighlights,
    providerHostProfileHighlights,
  };
}
