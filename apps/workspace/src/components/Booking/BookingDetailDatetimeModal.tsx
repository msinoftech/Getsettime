'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Department, EventType, Service, ServiceProvider } from '@/src/types/bookingForm';
import { useBookingFormData } from '@/src/hooks/useBookingFormData';
import { useTimeslots } from '@/src/hooks/useTimeslots';
import { Step3DateTime } from '@/src/components/Booking/MultiStepBooking/Step3DateTime';
import type { AvailabilitySettings, Timeslot } from '@/src/types/bookingForm';
import type { Booking as BusySlotBooking } from '@/src/types/bookingForm';
import {
  intakeServiceIdsFromMetadata,
  mergeServiceCatalogForDuration,
  resolveEffectiveBookingDurationMinutes,
} from '@/src/utils/bookingDuration';
import { isTimeSlotBooked, normalizeDate } from '@/src/utils/bookingTime';
import {
  isWorkspaceTimezoneConfigured,
  resolveCustomerTimezone,
  resolveProviderTimezone,
} from '@/src/utils/timezone';
import { useLocationContext } from '@app/location';
import type { Booking } from '@/src/types/booking';
import type { NormalizedIntakeForm } from '@/src/utils/intakeForm';
import type { IntakeFormSettings } from '@/src/types/workspace';

type Mode = 'follow_up' | 'reschedule';

function build_department(
  booking_department_id: string | number | null | undefined,
  list: unknown[]
): Department | null {
  if (booking_department_id == null || booking_department_id === '') return null;
  const raw = list.find(
    (d) => String((d as { id: string | number }).id) === String(booking_department_id)
  ) as
    | {
        id: string | number;
        name: string;
        description?: string | null;
        status?: string;
      }
    | undefined;
  if (!raw) return null;
  return {
    id: typeof raw.id === 'number' ? raw.id : Number(raw.id),
    name: raw.name,
    description: raw.description ?? null,
    status: raw.status ?? 'active',
  };
}

export function BookingDetailDatetimeModal({
  open,
  mode,
  booking,
  departments,
  eventTypes,
  intakeForm,
  workspacePrimaryColor,
  workspaceAccentColor,
  clientTimezone,
  onClose,
  onConfirm,
  saving,
  saveError,
}: {
  open: boolean;
  mode: Mode;
  booking: Booking;
  departments: unknown[];
  eventTypes: EventType[];
  intakeForm: NormalizedIntakeForm | null;
  workspacePrimaryColor: string;
  workspaceAccentColor: string | null;
  clientTimezone: string | null;
  onClose: () => void;
  onConfirm: (payload: {
    start_at: string;
    end_at: string;
    status?: string;
    customer_timezone?: string;
    provider_timezone?: string;
  }) => void;
  saving: boolean;
  saveError?: string | null;
}) {
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedStartUtc, setSelectedStartUtc] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [days, setDays] = useState<Date[]>(() =>
    Array.from({ length: 10 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return normalizeDate(d);
    })
  );
  const [error, setError] = useState<string | null>(null);
  const [rescheduleServiceCatalog, setRescheduleServiceCatalog] = useState<Service[]>([]);

  const {
    customerTimezone: manualCustomerTz,
    setCustomerTimezone,
    context: locationCtx,
  } = useLocationContext({
    hostTimezone: clientTimezone,
    profileCountry: undefined,
  });

  const viewerTimezone = resolveCustomerTimezone(
    manualCustomerTz ?? booking.customer_timezone,
    locationCtx?.timezone
  );
  const providerTimezone = resolveProviderTimezone(clientTimezone, viewerTimezone);
  const workspaceTimezoneConfigured = isWorkspaceTimezoneConfigured(clientTimezone);

  const intakeServiceIds = useMemo(
    () => intakeServiceIdsFromMetadata(booking.metadata),
    [booking.metadata]
  );

  const onAvailabilityChange = useCallback(() => {
    setSelectedDate(null);
    setSelectedTime('');
    setSelectedStartUtc(null);
  }, []);

  const {
    departments: hookDepartments,
    serviceProviders,
    availabilitySettings,
    existingBookings,
    loadingAvailability,
    loadingBookings,
    loadingDepartments,
    loadingProviders,
    services,
    needsExplicitProvider,
  } = useBookingFormData({
    selectedDepartment,
    selectedProvider,
    days,
    intakeForm:
      intakeForm != null ? (intakeForm as unknown as IntakeFormSettings) : undefined,
    onAvailabilityChange,
  });

  const exclude_id = mode === 'follow_up' ? null : booking.id;

  const existing_for_slots = useMemo(() => {
    const list = existingBookings as BusySlotBooking[];
    if (!exclude_id) return list;
    return list.filter((b) => b.id !== exclude_id);
  }, [existingBookings, exclude_id]);

  const serviceCatalogForSlots = useMemo(
    () =>
      mergeServiceCatalogForDuration(
        services.filter((s) => intakeServiceIds.includes(s.id)),
        rescheduleServiceCatalog
      ),
    [services, intakeServiceIds, rescheduleServiceCatalog]
  );

  const minLead = mode === 'reschedule' ? 60 : 0;
  const timeslots = useTimeslots(
    selectedType,
    selectedDate,
    availabilitySettings as AvailabilitySettings | null,
    existing_for_slots as BusySlotBooking[],
    minLead,
    intakeServiceIds,
    serviceCatalogForSlots,
    providerTimezone,
    viewerTimezone
  );

  const handleSelectSlot = useCallback((slot: Timeslot) => {
    setSelectedTime(slot.time);
    setSelectedStartUtc(slot.startUtc);
  }, []);

  const handleTimezoneChange = useCallback(
    (tz: string) => {
      setCustomerTimezone(tz);
      setSelectedTime('');
      setSelectedStartUtc(null);
    },
    [setCustomerTimezone]
  );

  useEffect(() => {
    if (!open || intakeServiceIds.length === 0) {
      setRescheduleServiceCatalog([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const { supabase } = await import('@/lib/supabaseClient');
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token || cancelled) return;
        const res = await fetch('/api/services', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { services?: Service[] };
        const filtered = (data.services ?? []).filter((s) =>
          intakeServiceIds.includes(s.id)
        );
        if (!cancelled) setRescheduleServiceCatalog(filtered);
      } catch {
        if (!cancelled) setRescheduleServiceCatalog([]);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [open, intakeServiceIds]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSelectedDepartment(build_department(booking.department_id, departments));
  }, [open, booking.department_id, departments]);

  useEffect(() => {
    if (!open) return;
    const sp_id = booking.service_provider_id?.trim();
    if (sp_id) {
      const p = serviceProviders.find((x) => x.id === sp_id);
      setSelectedProvider(p ?? null);
      return;
    }
    if (!needsExplicitProvider) {
      setSelectedProvider(null);
      return;
    }
    const ownerRow = serviceProviders.find((x) => x.is_workspace_owner);
    if (ownerRow) {
      setSelectedProvider(ownerRow);
      return;
    }
    if (serviceProviders.length === 1) {
      setSelectedProvider(serviceProviders[0]);
      return;
    }
    setSelectedProvider(null);
  }, [
    open,
    booking.service_provider_id,
    serviceProviders,
    needsExplicitProvider,
  ]);

  useEffect(() => {
    if (!open) return;
    const et =
      eventTypes.find((e) => e.id === booking.event_type_id) ??
      null;
    setSelectedType(
      et
        ? {
            ...et,
            duration_minutes: et.duration_minutes ?? 30,
          }
        : null
    );
  }, [open, booking.event_type_id, eventTypes]);

  useEffect(() => {
    if (!open || !booking.start_at) return;
    const d = new Date(booking.start_at);
    setSelectedDate(normalizeDate(d));
    setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedStartUtc(booking.start_at);
  }, [open, booking.start_at]);

  useEffect(() => {
    if (!open || !booking.start_at || !selectedDate || timeslots.length === 0) return;
    const slot =
      timeslots.find((s) => s.startUtc === booking.start_at && !s.disabled) ??
      timeslots.find((s) => !s.disabled);
    if (slot) {
      setSelectedTime(slot.time);
      setSelectedStartUtc(slot.startUtc);
    }
  }, [open, booking.start_at, selectedDate, timeslots]);

  useEffect(() => {
    if (selectedDate && selectedTime) {
      const valid = timeslots.some((s) => s.time === selectedTime && !s.disabled);
      if (!valid) {
        setSelectedTime('');
        setSelectedStartUtc(null);
      }
    } else if (!selectedDate) {
      setSelectedTime('');
      setSelectedStartUtc(null);
    }
  }, [selectedDate, timeslots, selectedTime]);

  const title =
    mode === 'follow_up'
      ? 'Schedule follow-up'
      : 'Reschedule booking';

  const handle_save = () => {
    if (!selectedType || !selectedDate || !selectedTime) {
      setError('Please select date and time');
      return;
    }
    const slot = timeslots.find(
      (s) => s.time === selectedTime || s.startUtc === selectedStartUtc
    );
    if (slot?.disabled) {
      setError(
        `This time slot is not available${slot.reason ? ` (${slot.reason})` : ''}.`
      );
      return;
    }
    const startIso = selectedStartUtc ?? slot?.startUtc;
    if (!startIso) {
      setError('Invalid time');
      return;
    }
    const startDate = new Date(startIso);
    if (startDate < new Date()) {
      setError('Cannot select a time in the past.');
      return;
    }
    const durationMin = resolveEffectiveBookingDurationMinutes(
      selectedType,
      intakeServiceIds,
      serviceCatalogForSlots
    );
    const endDate = new Date(startDate.getTime() + durationMin * 60_000);
    if (
      isTimeSlotBooked(
        startDate,
        endDate,
        selectedDate,
        existing_for_slots as BusySlotBooking[]
      )
    ) {
      setError('Time slot overlaps another booking.');
      return;
    }

    const payload: {
      start_at: string;
      end_at: string;
      status?: string;
      customer_timezone: string;
      provider_timezone: string;
    } = {
      start_at: startIso,
      end_at: endDate.toISOString(),
      customer_timezone: viewerTimezone,
      provider_timezone: providerTimezone,
    };

    if (mode === 'reschedule') payload.status = 'reschedule';

    void onConfirm(payload);
  };

  if (!open) return null;

  const ready =
    Boolean(selectedType) &&
    !loadingDepartments &&
    !loadingProviders &&
    !(hookDepartments.length > 0 && !selectedDepartment) &&
    !(needsExplicitProvider && !selectedProvider);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/50 p-4"
      role="dialog"
      aria-modal
      aria-labelledby="booking-datetime-modal-title"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-4xl rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 id="booking-datetime-modal-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-50"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {!ready ? (
          <div className="p-10 text-center text-slate-500">Loading scheduling data…</div>
        ) : (
          <div className="max-h-[min(80vh,720px)] overflow-y-auto p-4 md:p-6">
            {error && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}
            {saveError && (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {saveError}
              </div>
            )}
            <Step3DateTime
              selectedDate={selectedDate}
              selectedTime={selectedTime}
              timeslots={timeslots}
              days={days}
              currentMonth={currentMonth}
              showCalendar={showCalendar}
              loadingAvailability={loadingAvailability}
              loadingBookings={loadingBookings}
              availabilitySettings={availabilitySettings}
              existingBookings={existing_for_slots as BusySlotBooking[]}
              selectedType={selectedType}
              selectedServiceIds={intakeServiceIds}
              serviceCatalog={serviceCatalogForSlots}
              departmentsCount={departments.length}
              workspacePrimaryColor={workspacePrimaryColor}
              workspaceAccentColor={workspaceAccentColor}
              onSelectDate={setSelectedDate}
              onSelectTime={setSelectedTime}
              onSelectSlot={handleSelectSlot}
              onToggleCalendar={() => setShowCalendar((s) => !s)}
              onNavigateMonth={(dir) =>
                setCurrentMonth((prev) => {
                  const next = new Date(prev);
                  next.setMonth(prev.getMonth() + (dir === 'next' ? 1 : -1));
                  return next;
                })
              }
              onSetCurrentMonth={(d) =>
                setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1))
              }
              onContinue={handle_save}
              onDaysChange={(updater) => setDays((prev) => updater(prev))}
              continueLabel={saving ? 'Saving…' : 'Save'}
              continueDisabled={saving}
              previousStartAt={booking.start_at}
              previousEndAt={booking.end_at}
              minLeadTimeMinutes={minLead}
              customerTimezone={viewerTimezone}
              providerTimezone={providerTimezone}
              workspaceTimezoneConfigured={workspaceTimezoneConfigured}
              selectedStartUtc={selectedStartUtc}
              onTimezoneChange={handleTimezoneChange}
            />
          </div>
        )}
      </div>
    </div>
  );
}
