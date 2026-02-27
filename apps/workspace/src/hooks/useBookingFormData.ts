import { useState, useEffect } from 'react';
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
  const [workspaceName, setWorkspaceName] = useState<string>('Get Set Time');
  const [workspaceLogoUrl, setWorkspaceLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchDepartmentsWithProviders = async () => {
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const [departmentsResponse, teamMembersResponse] = await Promise.all([
          fetch('/api/departments', { headers: { Authorization: `Bearer ${session.access_token}` } }),
          fetch('/api/team-members', { headers: { Authorization: `Bearer ${session.access_token}` } }),
        ]);

        if (departmentsResponse.ok && teamMembersResponse.ok) {
          const departmentsResult = await departmentsResponse.json();
          const teamMembersResult = await teamMembersResponse.json();
          const allDepartments = departmentsResult.departments || [];
          const allServiceProviders = (teamMembersResult.teamMembers || []).filter(
            (m: { role?: string; deactivated?: boolean }) =>
              m.role === 'service_provider' && !m.deactivated
          );
          const departmentsWithProviders = allDepartments.filter((dept: Department) =>
            allServiceProviders.some(
              (p: { departments?: number[] }) => p.departments && p.departments.includes(dept.id)
            )
          );
          setDepartments(departmentsWithProviders);
        }
      } catch (e) {
        console.error('Error fetching departments:', e);
      } finally {
        setLoadingDepartments(false);
      }
    };
    fetchDepartmentsWithProviders();
  }, []);

  useEffect(() => {
    if (!selectedDepartment) {
      setServiceProviders([]);
      setAvailabilitySettings(null);
      setExistingBookings([]);
      onAvailabilityChange?.();
      return;
    }
    const fetchServiceProviders = async () => {
      setLoadingProviders(true);
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch('/api/team-members', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
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
        console.error('Error fetching service providers:', e);
      } finally {
        setLoadingProviders(false);
      }
    };
    fetchServiceProviders();
  }, [selectedDepartment]);

  useEffect(() => {
    const fetchEventTypes = async () => {
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const res = await fetch('/api/event-types', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
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
  }, []);

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
        const { supabase } = await import('@/lib/supabaseClient');
        const { data: { session } } = await supabase.auth.getSession();
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
          const generalTimesheet = availability.timesheet;
          const generalIndividual = availability.individual;
          let finalTimesheet = generalTimesheet;
          let finalIndividual = generalIndividual || {};
          if (selectedProvider) {
            const providers = availability.providers || {};
            const providerOverrides = providers[selectedProvider.id] || {};
            finalTimesheet = generalTimesheet
              ? { ...generalTimesheet, ...(providerOverrides.timesheet || {}) }
              : providerOverrides.timesheet;
            finalIndividual = { ...(generalIndividual || {}), ...(providerOverrides.individual || {}) };
          }
          setAvailabilitySettings({ timesheet: finalTimesheet, individual: finalIndividual });
        }
      } catch (e) {
        console.error('Error fetching availability settings:', e);
      } finally {
        setLoadingAvailability(false);
      }
    };
    fetchAvailability();
  }, [selectedProvider, departments.length, loadingDepartments, onAvailabilityChange]);

  useEffect(() => {
    const fetchWorkspaceName = async () => {
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const { data: { session } } = await supabase.auth.getSession();
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
    const hasReqs = departments.length === 0 || selectedProvider;
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
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;
        const url = selectedProvider
          ? `/api/bookings?start_date=${fmt(rangeStart)}&end_date=${fmt(rangeEnd)}&service_provider_id=${selectedProvider.id}`
          : `/api/bookings?start_date=${fmt(rangeStart)}&end_date=${fmt(rangeEnd)}`;
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
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
        console.error('Error fetching bookings:', e);
      } finally {
        setLoadingBookings(false);
      }
    };
    fetchBookings();
  }, [selectedProvider, days, departments.length]);

  useEffect(() => {
    if (!isServicesEnabled(intakeForm)) {
      setServices([]);
      return;
    }
    const fetchServices = async () => {
      setLoadingServices(true);
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const { data: { session } } = await supabase.auth.getSession();
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

  return {
    departments,
    setDepartments,
    loadingDepartments,
    serviceProviders,
    loadingProviders,
    eventTypes,
    loadingEventTypes,
    availabilitySettings,
    setAvailabilitySettings,
    existingBookings,
    loadingAvailability,
    loadingBookings,
    services,
    setServices,
    loadingServices,
    workspaceName,
    workspaceLogoUrl,
  };
}
