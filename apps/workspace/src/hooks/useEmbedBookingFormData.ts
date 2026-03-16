import { useState, useEffect } from 'react';
import type { Workspace } from '@app/db';
import type {
  AvailabilitySettings,
  Booking,
  Department,
  EventType,
  Service,
  ServiceProvider,
} from '@/src/types/bookingForm';
import type { IntakeFormSettings } from '@/src/types/workspace';
import { getAllowedServiceIds, isServicesEnabled } from '@/src/utils/intakeForm';
import { CALENDAR_BUFFER_DAYS, CALENDAR_BUFFER_DAYS_BEFORE } from '@/src/constants/booking';

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
  const [serviceProviders, setServiceProviders] = useState<ServiceProvider[]>([]);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [eventTypes, setEventTypes] = useState<EventType[]>([]);
  const [loadingEventTypes, setLoadingEventTypes] = useState(true);
  const [availabilitySettings, setAvailabilitySettings] = useState<AvailabilitySettings | null>(null);
  const [existingBookings, setExistingBookings] = useState<Booking[]>([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [settingsIntakeForm, setSettingsIntakeForm] = useState<IntakeFormSettings | undefined>(undefined);
  const [generalSettings, setGeneralSettings] = useState<{ primaryColor?: string; accentColor?: string; timezone?: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch(`/api/embed/settings?workspace_id=${workspace.id}`);
        if (!res.ok) return;
        const data: {
          settings?: { intake_form?: IntakeFormSettings; general?: { primaryColor?: string; accentColor?: string; timezone?: string } };
        } = await res.json();
        setSettingsIntakeForm(data.settings?.intake_form);
        setGeneralSettings(data.settings?.general || null);
      } catch (e) {
        console.error('Error fetching embed settings:', e);
      }
    };
    fetchSettings();
  }, [workspace.id]);

  useEffect(() => {
    const fetchDepartmentsWithProviders = async () => {
      try {
        const [depRes, tmRes] = await Promise.all([
          fetch(`/api/embed/departments?workspace_id=${workspace.id}`),
          fetch(`/api/embed/team-members?workspace_id=${workspace.id}`),
        ]);
        if (depRes.ok && tmRes.ok) {
          const depData = await depRes.json();
          const tmData = await tmRes.json();
          const allDepts = depData.departments || [];
          const allProviders = (tmData.teamMembers || []).filter(
            (m: { role?: string; deactivated?: boolean }) =>
              m.role === 'service_provider' && !m.deactivated
          );
          const withProviders = allDepts.filter((dept: Department) =>
            allProviders.some(
              (p: { departments?: number[] }) => p.departments && p.departments.includes(dept.id)
            )
          );
          setDepartments(withProviders);
        }
      } catch (e) {
        console.error('Error fetching embed departments:', e);
      } finally {
        setLoadingDepartments(false);
      }
    };
    fetchDepartmentsWithProviders();
  }, [workspace.id]);

  useEffect(() => {
    if (!selectedDepartment) {
      setServiceProviders([]);
      setAvailabilitySettings(null);
      setExistingBookings([]);
      onAvailabilityChange?.();
      return;
    }
    const fetchProviders = async () => {
      setLoadingProviders(true);
      try {
        const res = await fetch(`/api/embed/team-members?workspace_id=${workspace.id}`);
        if (res.ok) {
          const result = await res.json();
          const providers = (result.teamMembers || []).filter(
            (m: { role?: string; deactivated?: boolean; departments?: number[] }) =>
              m.role === 'service_provider' &&
              !m.deactivated &&
              m.departments?.includes(selectedDepartment.id)
          );
          setServiceProviders(providers);
        }
      } catch (e) {
        console.error('Error fetching embed providers:', e);
      } finally {
        setLoadingProviders(false);
      }
    };
    fetchProviders();
  }, [selectedDepartment, workspace.id]);

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
    if (!selectedProvider && departments.length > 0) {
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
  }, [selectedProvider, departments.length, loadingDepartments, workspace.id, onAvailabilityChange]);

  useEffect(() => {
    const hasReqs =
      selectedType && (departments.length === 0 || selectedProvider);
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
  }, [selectedType, selectedProvider, days, departments.length, workspace.id]);

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

  return {
    departments,
    loadingDepartments,
    serviceProviders,
    loadingProviders,
    eventTypes,
    loadingEventTypes,
    availabilitySettings,
    existingBookings,
    loadingAvailability,
    loadingBookings,
    services,
    loadingServices,
    intakeForm: effectiveIntakeForm,
    generalSettings,
  };
}
