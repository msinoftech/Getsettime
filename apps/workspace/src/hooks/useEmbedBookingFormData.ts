import { useState, useEffect, useMemo, useRef } from 'react';
import type { Workspace } from '@app/db';
import type {
  AvailabilitySettings,
  Booking,
  Department,
  EventType,
  Service,
  ServiceProvider,
} from '@/src/types/bookingForm';
import type { IntakeFormSettings, meeting_options_settings } from '@/src/types/workspace';
import { getAllowedServiceIds, isServicesEnabled } from '@/src/utils/intakeForm';
import {
  event_type_session_duration_minutes,
  is_event_type_before_department,
  parse_booking_step_order,
  resolve_booking_data_fetch_range,
} from '@/src/features/booking-flow';
import { userActsAsServiceProviderFromMetadata } from '@/lib/service_provider_role';
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
  admin_notice?: string | null;
}

interface UseEmbedBookingFormDataParams {
  workspace: Workspace;
  /** When set (direct embed URL), includes public or private type for this slug without listing private types publicly. */
  eventTypeSlug?: string;
  /** When set (provider public link), scopes departments, services, event types, and availability to this provider. */
  fixedServiceProviderId?: string;
  selectedDepartment: Department | null;
  selectedProvider: ServiceProvider | null;
  selectedType: EventType | null;
  /** Keeps the event-type list stable after the user picks a type (event-type-first flows). */
  lockEventTypeCatalog?: boolean;
  days: Date[];
  intakeForm: IntakeFormSettings | undefined;
  onAvailabilityChange?: () => void;
}

export function useEmbedBookingFormData({
  workspace,
  eventTypeSlug,
  fixedServiceProviderId,
  selectedDepartment,
  selectedProvider,
  selectedType,
  lockEventTypeCatalog = false,
  days,
  intakeForm,
  onAvailabilityChange,
}: UseEmbedBookingFormDataParams) {
  const [allDepartments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [workspaceMembers, setWorkspaceMembers] = useState<TeamMemberRow[]>([]);

  const scopedMembers = useMemo(() => {
    if (!fixedServiceProviderId) return workspaceMembers;
    return workspaceMembers.filter((m) => m.id === fixedServiceProviderId);
  }, [workspaceMembers, fixedServiceProviderId]);

  const departments = useMemo(
    () =>
      filterDepartmentsForEventType(
        filterBookableDepartments(allDepartments, scopedMembers),
        selectedType
      ),
    [allDepartments, scopedMembers, selectedType]
  );
  const [workspaceOwnerUserId, setWorkspaceOwnerUserId] = useState<string | null>(null);
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
  const [settingsIntakeForm, setSettingsIntakeForm] = useState<IntakeFormSettings | undefined>(undefined);
  const [meetingOptionsSettings, setMeetingOptionsSettings] = useState<
    meeting_options_settings | undefined
  >(undefined);
  const [bookingStepOrder, setBookingStepOrder] = useState<string[] | null>(null);
  const [generalSettings, setGeneralSettings] = useState<{
    primaryColor?: string;
    accentColor?: string;
    timezone?: string;
    tagline?: string;
    clinic_image_url?: string | null;
  } | null>(null);
  const [workspaceOwnerAdminNotice, setWorkspaceOwnerAdminNotice] = useState<string | null>(null);

  const providersActingInDepartment = useMemo((): ServiceProvider[] => {
    if (!selectedDepartment) return [];
    const acting = scopedMembers
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
        bio: m.bio ?? null,
        avatar_url: m.avatar_url ?? null,
        departments: Array.isArray(m.departments) ? m.departments : [],
        is_workspace_owner: m.is_workspace_owner,
        additional_roles: m.additional_roles,
        role: m.role ?? null,
        admin_notice: m.admin_notice,
      }));
    return filterProvidersForEventType(acting, selectedType);
  }, [selectedDepartment, scopedMembers, selectedType]);

  const showProviderPicker = useMemo(() => {
    if (fixedServiceProviderId) return false;
    return providersActingInDepartment.length > 1;
  }, [fixedServiceProviderId, providersActingInDepartment]);

  const effectiveProviderId = useMemo(() => {
    if (fixedServiceProviderId) return fixedServiceProviderId;
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
    !fixedServiceProviderId &&
    departments.length > 0 &&
    selectedDepartment !== null &&
    showProviderPicker;

  const eventTypeBeforeDepartment = useMemo(() => {
    if (!bookingStepOrder) return true;
    const order = parse_booking_step_order(bookingStepOrder);
    if (!order) return true;
    return is_event_type_before_department(order);
  }, [bookingStepOrder]);

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
    const fetchSettings = async () => {
      try {
        const providerQuery =
          effectiveProviderId != null
            ? `&service_provider_id=${encodeURIComponent(effectiveProviderId)}`
            : '';
        const res = await fetch(
          `/api/embed/settings?workspace_id=${workspace.id}${providerQuery}`
        );
        if (!res.ok) return;
        const data: {
          settings?: {
            intake_form?: IntakeFormSettings;
            general?: {
              primaryColor?: string;
              accentColor?: string;
              timezone?: string;
              tagline?: string;
            };
            meeting_options?: meeting_options_settings;
          };
          booking_step_order?: string[];
        } = await res.json();
        setSettingsIntakeForm(data.settings?.intake_form);
        setGeneralSettings(data.settings?.general || null);
        setMeetingOptionsSettings(data.settings?.meeting_options);
        setBookingStepOrder(
          Array.isArray(data.booking_step_order) ? data.booking_step_order : null
        );
      } catch (e) {
        console.error('Error fetching embed settings:', e);
      }
    };
    fetchSettings();
  }, [workspace.id, effectiveProviderId]);

  const scopedAdminNotice = useMemo(() => {
    if (!fixedServiceProviderId) return workspaceOwnerAdminNotice;
    const member = scopedMembers.find((m) => m.id === fixedServiceProviderId);
    const notice = member?.admin_notice;
    return typeof notice === 'string' && notice.trim() !== '' ? notice.trim() : null;
  }, [fixedServiceProviderId, scopedMembers, workspaceOwnerAdminNotice]);

  useEffect(() => {
    const fetchDepartmentsAndTeam = async () => {
      try {
        const providerQuery = fixedServiceProviderId
          ? `&service_provider_id=${encodeURIComponent(fixedServiceProviderId)}`
          : '';
        const [depRes, tmRes] = await Promise.all([
          fetch(
            `/api/embed/departments?workspace_id=${workspace.id}${providerQuery}`
          ),
          fetch(`/api/embed/team-members?workspace_id=${workspace.id}`),
        ]);
        if (depRes.ok) {
          const depData = await depRes.json();
          setDepartments(depData.departments || []);
        }
        if (tmRes.ok) {
          const tmData = await tmRes.json();
          const allTeamMembers = (tmData.teamMembers || []) as TeamMemberRow[];
          setWorkspaceMembers(allTeamMembers);
          const owner = allTeamMembers.find((m) => m.is_workspace_owner && !m.deactivated);
          setWorkspaceOwnerUserId(owner?.id ?? null);
          const ownerNoticeRaw = owner?.admin_notice;
          setWorkspaceOwnerAdminNotice(
            typeof ownerNoticeRaw === 'string' && ownerNoticeRaw.trim() !== ''
              ? ownerNoticeRaw
              : null
          );
        } else {
          setWorkspaceMembers([]);
          setWorkspaceOwnerUserId(null);
        }
      } catch (e) {
        console.error('Error fetching embed departments:', e);
      } finally {
        setLoadingDepartments(false);
      }
    };
    fetchDepartmentsAndTeam();
  }, [workspace.id, fixedServiceProviderId]);

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
  }, [workspace.slug, eventTypeSlug]);

  useEffect(() => {
    if (lockEventTypeCatalog && eventTypesCatalogLoadedRef.current) return;

    let cancelled = false;
    const fetchEventTypes = async () => {
      if (!cancelled) setLoadingEventTypes(true);
      try {
        const params = new URLSearchParams({
          workspace_slug: workspace.slug,
          workspace_id: String(workspace.id),
        });
        if (effectiveProviderId && !lockEventTypeCatalog) {
          params.set('service_provider_id', effectiveProviderId);
        }
        if (eventTypeSlug) {
          params.set('slug', eventTypeSlug);
        }
        const res = await fetch(`/api/embed/event-types?${params.toString()}`);
        if (res.ok) {
          const result = await res.json();
          if (!cancelled) setEventTypes(result.data || []);
        } else {
          console.error('Error fetching embed event types:', res.status, await res.text());
        }
      } catch (e) {
        console.error('Error fetching embed event types:', e);
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
    workspace.slug,
    workspace.id,
    eventTypeSlug,
    lockEventTypeCatalog,
    lockEventTypeCatalog ? undefined : effectiveProviderId,
  ]);

  useEffect(() => {
    if (!effectiveProviderId && needsExplicitProvider) {
      setAvailabilitySettings(null);
      setExistingBookings([]);
      setDateExceptions([]);
      onAvailabilityChange?.();
      setLoadingAvailability(false);
      return;
    }
    if (loadingDepartments && departments.length === 0 && !fixedServiceProviderId) {
      return;
    }

    const fetchAvailability = async () => {
      setLoadingAvailability(true);
      setAvailabilitySettings(null);
      setExistingBookings([]);
      setDateExceptions([]);
      onAvailabilityChange?.();
      try {
        const providerQuery =
          effectiveProviderId != null
            ? `&service_provider_id=${encodeURIComponent(effectiveProviderId)}`
            : '';
        const res = await fetch(
          `/api/embed/settings?workspace_id=${workspace.id}${providerQuery}`
        );
        if (!res.ok) {
          setLoadingAvailability(false);
          return;
        }
        const result = await res.json();
        const availability = result.settings?.availability || {};
        setAvailabilitySettings(
          resolveAvailabilityForServiceProvider(
            availability,
            effectiveProviderId
          ) as AvailabilitySettings
        );
      } catch (e) {
        console.error('Error fetching embed availability:', e);
      } finally {
        setLoadingAvailability(false);
      }
    };
    fetchAvailability();
  }, [
    effectiveProviderId,
    departments.length,
    loadingDepartments,
    workspace.id,
    needsExplicitProvider,
    fixedServiceProviderId,
    onAvailabilityChange,
  ]);

  useEffect(() => {
    const hasReqs =
      selectedType &&
      (departments.length === 0 || !needsExplicitProvider || effectiveProviderId);
    if (!hasReqs) {
      setExistingBookings([]);
      return;
    }
    const providerTimezone = generalSettings?.timezone?.trim() || 'UTC';
    const duration = selectedType
      ? event_type_session_duration_minutes(selectedType, selectedType.duration_minutes ?? 30)
      : 30;
    const { rangeStart, rangeEnd } = resolve_booking_data_fetch_range({
      days,
      event_type: selectedType,
      provider_timezone: providerTimezone,
      duration_minutes: duration,
    });
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const fetchBookings = async () => {
      setLoadingBookings(true);
      try {
        const url = effectiveProviderId
          ? `/api/embed/bookings?workspace_id=${workspace.id}&start_date=${fmt(rangeStart)}&end_date=${fmt(rangeEnd)}&service_provider_id=${effectiveProviderId}`
          : `/api/embed/bookings?workspace_id=${workspace.id}&start_date=${fmt(rangeStart)}&end_date=${fmt(rangeEnd)}`;
        const res = await fetch(url);
        if (res.ok) {
          const result = await res.json();
          const active = (result.data || [])
            .filter((b: Booking & { service_provider_id?: string }) => {
              if (
                b.status === 'cancelled' ||
                b.status === 'emergency' ||
                b.status === 'deleted'
              ) {
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
        console.error('Error fetching embed bookings:', e);
      } finally {
        setLoadingBookings(false);
      }
    };
    fetchBookings();
  }, [
    selectedType,
    effectiveProviderId,
    days,
    departments.length,
    workspace.id,
    needsExplicitProvider,
    generalSettings?.timezone,
  ]);

  useEffect(() => {
    const hasReqs =
      selectedType &&
      (departments.length === 0 || !needsExplicitProvider || effectiveProviderId);
    if (!hasReqs) {
      setDateExceptions([]);
      return;
    }
    const providerTimezone = generalSettings?.timezone?.trim() || 'UTC';
    const duration = selectedType
      ? event_type_session_duration_minutes(selectedType, selectedType.duration_minutes ?? 30)
      : 30;
    const { rangeStart, rangeEnd } = resolve_booking_data_fetch_range({
      days,
      event_type: selectedType,
      provider_timezone: providerTimezone,
      duration_minutes: duration,
    });
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    const fetchExceptions = async () => {
      try {
        const params = new URLSearchParams({
          workspace_id: String(workspace.id),
          from: fmt(rangeStart),
          to: fmt(rangeEnd),
        });
        if (effectiveProviderId) {
          params.set('service_provider_id', effectiveProviderId);
        }
        const res = await fetch(`/api/embed/date-exceptions?${params.toString()}`);
        if (res.ok) {
          const result = await res.json();
          setDateExceptions(
            Array.isArray(result.exceptions) ? result.exceptions : []
          );
        }
      } catch (e) {
        console.error('Error fetching embed date exceptions:', e);
      }
    };
    void fetchExceptions();
  }, [
    selectedType,
    effectiveProviderId,
    days,
    departments.length,
    workspace.id,
    needsExplicitProvider,
    generalSettings?.timezone,
  ]);

  const effectiveIntakeForm = settingsIntakeForm ?? intakeForm;
  useEffect(() => {
    if (!isServicesEnabled(effectiveIntakeForm)) {
      setServices([]);
      return;
    }
    const fetchServices = async () => {
      setLoadingServices(true);
      try {
        const params = new URLSearchParams({ workspace_id: workspace.id });
        if (effectiveProviderId) {
          params.set('service_provider_id', effectiveProviderId);
        }
        const res = await fetch(`/api/embed/services?${params.toString()}`);
        if (res.ok) {
          const data: { services?: Service[] } = await res.json();
          const all = data.services || [];
          const allowed = getAllowedServiceIds(effectiveIntakeForm);
          const filtered = allowed.length > 0 ? all.filter((s) => allowed.includes(s.id)) : all;
          setServices(filtered);
        }
      } finally {
        setLoadingServices(false);
      }
    };
    fetchServices();
  }, [effectiveIntakeForm, workspace.id, effectiveProviderId]);

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
        const params = new URLSearchParams({
          workspace_id: workspace.id,
          department_id: String(selectedDepartment.id),
          service_provider_id: effectiveProviderId,
        });
        const res = await fetch(`/api/embed/services?${params.toString()}`);
        if (res.ok) {
          const data: { services?: Service[] } = await res.json();
          setProviderScopedCatalogServices(data.services || []);
        } else {
          setProviderScopedCatalogServices([]);
        }
      } finally {
        setLoadingProviderScopedCatalog(false);
        setProviderScopedCatalogSettled(true);
      }
    };
    fetchScoped();
  }, [selectedDepartment, effectiveProviderId, workspace.id]);

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
    loadingDepartments,
    serviceProviders: providersActingInDepartment,
    loadingProviders: false,
    eventTypes: bookableEventTypes,
    loadingEventTypes,
    availabilitySettings,
    existingBookings,
    dateExceptions,
    loadingAvailability,
    loadingBookings,
    services,
    loadingServices,
    providerScopedCatalogServices,
    loadingProviderScopedCatalog,
    providerScopedCatalogSettled,
    workspaceOwnerUserId,
    showProviderPicker,
    effectiveProviderId,
    intakeForm: effectiveIntakeForm,
    generalSettings,
    workspaceOwnerAdminNotice: scopedAdminNotice,
    meetingOptions: meetingOptionsSettings,
    bookingStepOrder,
    workspaceHostProfileHighlights,
    providerHostProfileHighlights,
  };
}
