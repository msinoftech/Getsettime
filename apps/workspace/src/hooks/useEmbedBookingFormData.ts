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
  selectedDepartment: Department | null;
  selectedProvider: ServiceProvider | null;
  selectedType: EventType | null;
  days: Date[];
  intakeForm: IntakeFormSettings | undefined;
  onAvailabilityChange?: () => void;
}

export function useEmbedBookingFormData({
  workspace,
  selectedDepartment,
  selectedProvider,
  selectedType,
  days,
  intakeForm,
  onAvailabilityChange,
}: UseEmbedBookingFormDataParams) {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [workspaceMembers, setWorkspaceMembers] = useState<TeamMemberRow[]>([]);
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
    return workspaceMembers
      .filter(
        (m) =>
          !m.deactivated &&
          userActsAsServiceProviderFromMetadata({
            role: m.role ?? null,
            is_workspace_owner: m.is_workspace_owner === true,
            additional_roles: m.additional_roles,
          }) &&
          Array.isArray(m.departments) &&
          m.departments.includes(selectedDepartment.id)
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
  }, [selectedDepartment, workspaceMembers]);

  const showProviderPicker = useMemo(
    () => providersActingInDepartment.some((p) => !p.is_workspace_owner),
    [providersActingInDepartment]
  );

  const needsExplicitProvider =
    departments.length > 0 && selectedDepartment !== null && showProviderPicker;

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`/api/embed/settings?workspace_id=${workspace.id}`);
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
  }, [workspace.id]);

  useEffect(() => {
    const fetchDepartmentsAndTeam = async () => {
      try {
        const [depRes, tmRes] = await Promise.all([
          fetch(`/api/embed/departments?workspace_id=${workspace.id}`),
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
  }, [workspace.id]);

  useEffect(() => {
    if (!selectedDepartment) {
      setAvailabilitySettings(null);
      setExistingBookings([]);
      onAvailabilityChange?.();
    }
  }, [selectedDepartment, onAvailabilityChange]);

  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        const res = await fetch(`/api/embed/event-types?workspace_slug=${workspace.slug}`);
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
  }, [workspace.slug]);

  useEffect(() => {
    if (!selectedProvider && needsExplicitProvider) {
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
        const res = await fetch(`/api/embed/settings?workspace_id=${workspace.id}`);
        if (!res.ok) {
          setLoadingAvailability(false);
          return;
        }
        const result = await res.json();
        const availability = result.settings?.availability || {};
        const generalTimesheet = availability.timesheet;
        const generalIndividual = availability.individual;
        let finalTimesheet = generalTimesheet;
        let finalIndividual = generalIndividual || {};
        if (selectedProvider) {
          const providers = availability.providers || {};
          const overrides = providers[selectedProvider.id] || {};
          finalTimesheet = generalTimesheet
            ? { ...generalTimesheet, ...(overrides.timesheet || {}) }
            : overrides.timesheet;
          finalIndividual = { ...(generalIndividual || {}), ...(overrides.individual || {}) };
        }
        setAvailabilitySettings({ timesheet: finalTimesheet, individual: finalIndividual });
      } catch (e) {
        console.error('Error fetching embed availability:', e);
      } finally {
        setLoadingAvailability(false);
      }
    };
    fetchAvailability();
  }, [
    selectedProvider,
    departments.length,
    loadingDepartments,
    workspace.id,
    needsExplicitProvider,
    onAvailabilityChange,
  ]);

  useEffect(() => {
    const hasReqs =
      selectedType &&
      (departments.length === 0 || !needsExplicitProvider || selectedProvider);
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
        const url = selectedProvider
          ? `/api/embed/bookings?workspace_id=${workspace.id}&start_date=${fmt(rangeStart)}&end_date=${fmt(rangeEnd)}&service_provider_id=${selectedProvider.id}`
          : `/api/embed/bookings?workspace_id=${workspace.id}&start_date=${fmt(rangeStart)}&end_date=${fmt(rangeEnd)}`;
        const res = await fetch(url);
        if (res.ok) {
          const result = await res.json();
          const active = (result.data || []).filter(
            (b: Booking & { service_provider_id?: string }) => {
              if (b.status === 'cancelled' || b.status === 'emergency') return false;
              if (selectedProvider && b.service_provider_id !== selectedProvider.id) return false;
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
  }, [selectedType, selectedProvider, days, departments.length, workspace.id, needsExplicitProvider]);

  const effectiveIntakeForm = settingsIntakeForm ?? intakeForm;
  useEffect(() => {
    if (!isServicesEnabled(effectiveIntakeForm)) {
      setServices([]);
      return;
    }
    const fetchServices = async () => {
      setLoadingServices(true);
      try {
        const res = await fetch(`/api/embed/services?workspace_id=${workspace.id}`);
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
  }, [effectiveIntakeForm, workspace.id]);

  useEffect(() => {
    const effectiveProviderId = showProviderPicker ? selectedProvider?.id : workspaceOwnerUserId;
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
  }, [selectedDepartment, selectedProvider?.id, showProviderPicker, workspace.id, workspaceOwnerUserId]);

  return {
    departments,
    loadingDepartments,
    serviceProviders: providersActingInDepartment,
    loadingProviders: false,
    eventTypes,
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
    intakeForm: effectiveIntakeForm,
    generalSettings,
    workspaceOwnerAdminNotice,
    meetingOptions: meetingOptionsSettings,
  };
}
