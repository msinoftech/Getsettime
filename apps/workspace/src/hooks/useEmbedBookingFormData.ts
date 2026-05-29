import { useState, useEffect, useMemo } from 'react';
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
import { CALENDAR_BUFFER_DAYS, CALENDAR_BUFFER_DAYS_BEFORE } from '@/src/constants/booking';
import { userActsAsServiceProviderFromMetadata } from '@/lib/service_provider_role';
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
    () => filterBookableDepartments(allDepartments, scopedMembers),
    [allDepartments, scopedMembers]
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
  const [settingsIntakeForm, setSettingsIntakeForm] = useState<IntakeFormSettings | undefined>(undefined);
  const [meetingOptionsSettings, setMeetingOptionsSettings] = useState<
    meeting_options_settings | undefined
  >(undefined);
  const [generalSettings, setGeneralSettings] = useState<{
    primaryColor?: string;
    accentColor?: string;
    timezone?: string;
  } | null>(null);
  const [workspaceOwnerAdminNotice, setWorkspaceOwnerAdminNotice] = useState<string | null>(null);

  const providersActingInDepartment = useMemo((): ServiceProvider[] => {
    if (!selectedDepartment) return [];
    return scopedMembers
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
        departments: Array.isArray(m.departments) ? m.departments : [],
        is_workspace_owner: m.is_workspace_owner,
        additional_roles: m.additional_roles,
        role: m.role ?? null,
        admin_notice: m.admin_notice,
      }));
  }, [selectedDepartment, scopedMembers]);

  const showProviderPicker = useMemo(() => {
    if (fixedServiceProviderId) return false;
    return providersActingInDepartment.length > 0;
  }, [fixedServiceProviderId, providersActingInDepartment]);

  const effectiveProviderId = useMemo(() => {
    if (fixedServiceProviderId) return fixedServiceProviderId;
    if (!selectedDepartment) return null;
    if (!showProviderPicker) return workspaceOwnerUserId;
    if (selectedProvider?.id) return selectedProvider.id;
    if (providersActingInDepartment.length === 1) {
      return providersActingInDepartment[0].id;
    }
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

  const bookableEventTypes = useMemo(() => {
    if (needsExplicitProvider && !effectiveProviderId) return [];
    return filterEventTypesForServiceProvider(eventTypes, effectiveProviderId);
  }, [eventTypes, effectiveProviderId, needsExplicitProvider]);

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
            general?: { primaryColor?: string; accentColor?: string; timezone?: string };
            meeting_options?: meeting_options_settings;
          };
        } = await res.json();
        setSettingsIntakeForm(data.settings?.intake_form);
        setGeneralSettings(data.settings?.general || null);
        setMeetingOptionsSettings(data.settings?.meeting_options);
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
          fetch(
            `/api/embed/team-members?workspace_id=${workspace.id}${providerQuery}`
          ),
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

  useEffect(() => {
    const fetchEventTypes = async () => {
      setLoadingEventTypes(true);
      try {
        const params = new URLSearchParams({ workspace_slug: workspace.slug });
        if (effectiveProviderId) {
          params.set('service_provider_id', effectiveProviderId);
        }
        if (eventTypeSlug) {
          params.set('slug', eventTypeSlug);
        }
        const res = await fetch(`/api/embed/event-types?${params.toString()}`);
        if (res.ok) {
          const result = await res.json();
          setEventTypes(result.data || []);
        }
      } catch (e) {
        console.error('Error fetching embed event types:', e);
      } finally {
        setLoadingEventTypes(false);
      }
    };
    fetchEventTypes();
  }, [workspace.slug, effectiveProviderId, eventTypeSlug]);

  useEffect(() => {
    if (!effectiveProviderId && needsExplicitProvider) {
      setAvailabilitySettings(null);
      setExistingBookings([]);
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
        const url = effectiveProviderId
          ? `/api/embed/bookings?workspace_id=${workspace.id}&start_date=${fmt(rangeStart)}&end_date=${fmt(rangeEnd)}&service_provider_id=${effectiveProviderId}`
          : `/api/embed/bookings?workspace_id=${workspace.id}&start_date=${fmt(rangeStart)}&end_date=${fmt(rangeEnd)}`;
        const res = await fetch(url);
        if (res.ok) {
          const result = await res.json();
          const active = (result.data || []).filter(
            (b: Booking & { service_provider_id?: string }) => {
              if (b.status === 'cancelled' || b.status === 'emergency') return false;
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
        console.error('Error fetching embed bookings:', e);
      } finally {
        setLoadingBookings(false);
      }
    };
    fetchBookings();
  }, [selectedType, effectiveProviderId, days, departments.length, workspace.id, needsExplicitProvider]);

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
      return;
    }

    const fetchScoped = async () => {
      setLoadingProviderScopedCatalog(true);
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
        }
      } finally {
        setLoadingProviderScopedCatalog(false);
      }
    };
    fetchScoped();
  }, [selectedDepartment, effectiveProviderId, workspace.id]);

  return {
    departments,
    loadingDepartments,
    serviceProviders: providersActingInDepartment,
    loadingProviders: false,
    eventTypes: bookableEventTypes,
    loadingEventTypes,
    availabilitySettings,
    existingBookings,
    loadingAvailability,
    loadingBookings,
    services,
    loadingServices,
    providerScopedCatalogServices,
    loadingProviderScopedCatalog,
    workspaceOwnerUserId,
    showProviderPicker,
    effectiveProviderId,
    intakeForm: effectiveIntakeForm,
    generalSettings,
    workspaceOwnerAdminNotice: scopedAdminNotice,
    meetingOptions: meetingOptionsSettings,
  };
}
