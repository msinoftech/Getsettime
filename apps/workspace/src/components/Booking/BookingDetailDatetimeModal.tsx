'use client';

import { getWorkspaceSession } from '@/src/lib/auth_session';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import {
  event_type_max_window_days,
  event_type_min_notice_minutes,
  event_type_session_duration_minutes,
  event_type_slot_capacity,
} from '@/src/features/booking-flow';
import { slot_occupancy_context_from_event_type } from '@/lib/booking_capacity';
import {
  find_duplicate_invitee_booking_on_date,
  booking_preview_path,
} from '@/lib/invitee_duplicate_booking';
import { InviteeDuplicateBookingAlert } from './InviteeDuplicateBookingAlert';
import type { Booking } from '@/src/types/booking';
import type { NormalizedIntakeForm } from '@/src/utils/intakeForm';
import type { IntakeFormSettings } from '@/src/types/workspace';
import { STRIP_MAX_DAYS } from '@/src/constants/booking';

type Mode = 'follow_up' | 'reschedule' | 'pick_datetime';

function build_day_strip(count: number, anchor = new Date()): Date[] {
  const start = normalizeDate(anchor);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return normalizeDate(d);
  });
}

function same_calendar_day(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

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
  saveDuplicatePreviewPath,
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
  saveDuplicatePreviewPath?: string | null;
}) {
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(() =>
    build_department(booking.department_id, departments)
  );
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
  const [duplicatePreviewPath, setDuplicatePreviewPath] = useState<string | null>(null);
  const modalTopRef = useRef<HTMLDivElement | null>(null);
  const [rescheduleServiceCatalog, setRescheduleServiceCatalog] = useState<Service[]>([]);
  /**
   * Preselect the original booking slot once per open. Must not re-run on every
   * `timeslots` rebuild — Step3's date strip grows to STRIP_MAX_DAYS and each
   * growth refetches busy slots, which would otherwise overwrite the user's pick.
   */
  const initial_slot_applied_ref = useRef(false);

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

  const {
    departments: hookDepartments,
    serviceProviders,
    availabilitySettings,
    existingBookings,
    dateExceptions,
    loadingAvailability,
    loadingBookings,
    loadingDepartments,
    loadingProviders,
    services,
    needsExplicitProvider,
    effectiveProviderId,
  } = useBookingFormData({
    selectedDepartment,
    selectedProvider,
    // Reschedules keep the booking's original department/provider, which may
    // predate the event type's current assignments, so they stay unscoped.
    selectedType: null,
    schedulingEventType: selectedType,
    days,
    intakeForm:
      intakeForm != null ? (intakeForm as unknown as IntakeFormSettings) : undefined,
    fixedServiceProviderId: booking.service_provider_id,
  });

  const exclude_id = mode === 'follow_up' ? null : booking.id;
  const exclude_self_from_duplicate = mode !== 'follow_up';

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

  const minLead = useMemo(() => {
    const reschedule_floor = mode === 'reschedule' ? 60 : 0;
    return Math.max(reschedule_floor, event_type_min_notice_minutes(selectedType));
  }, [mode, selectedType]);

  const serviceProviderIdForSlots =
    effectiveProviderId ?? booking.service_provider_id?.trim() ?? null;

  const timeslots = useTimeslots(
    selectedType,
    selectedDate,
    availabilitySettings as AvailabilitySettings | null,
    existing_for_slots as BusySlotBooking[],
    minLead,
    intakeServiceIds,
    serviceCatalogForSlots,
    providerTimezone,
    viewerTimezone,
    dateExceptions,
    serviceProviderIdForSlots
  );

  const handleSelectDate = useCallback((date: Date) => {
    setSelectedDate(date);
    setSelectedTime('');
    setSelectedStartUtc(null);
  }, []);

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
        const { session } = await getWorkspaceSession();
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
    setDuplicatePreviewPath(null);
    const dept = build_department(booking.department_id, departments);
    if (dept) setSelectedDepartment(dept);
  }, [open, booking.department_id, departments]);

  useEffect(() => {
    if (error || saveError) {
      modalTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [error, duplicatePreviewPath, saveError, saveDuplicatePreviewPath]);

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
      eventTypes.find(
        (e) => String(e.id) === String(booking.event_type_id ?? '')
      ) ?? null;
    const next_type = et
      ? {
          ...et,
          duration_minutes: et.duration_minutes ?? 30,
        }
      : null;
    setSelectedType(next_type);
    if (next_type) {
      const window_days = Math.min(
        STRIP_MAX_DAYS,
        event_type_max_window_days(next_type) ?? STRIP_MAX_DAYS
      );
      const anchor = booking.start_at ? new Date(booking.start_at) : new Date();
      setDays(build_day_strip(window_days, anchor));
    }
  }, [open, booking.event_type_id, booking.start_at, eventTypes]);

  useEffect(() => {
    if (!open) {
      initial_slot_applied_ref.current = false;
      return;
    }
    if (!booking.start_at) return;
    const d = new Date(booking.start_at);
    setSelectedDate(normalizeDate(d));
    setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1));
    setSelectedStartUtc(booking.start_at);
    setSelectedTime('');
    initial_slot_applied_ref.current = false;
  }, [open, booking.start_at]);

  useEffect(() => {
    if (!open || !booking.start_at || !selectedDate || timeslots.length === 0) return;
    if (initial_slot_applied_ref.current) return;

    const booking_day = normalizeDate(new Date(booking.start_at));
    if (!same_calendar_day(selectedDate, booking_day)) {
      // User (or Step3 auto-select) already moved off the original day — do not
      // force the first enabled slot; that was overwriting manual picks.
      initial_slot_applied_ref.current = true;
      return;
    }

    const slot = timeslots.find(
      (s) => s.startUtc === booking.start_at && !s.disabled
    );
    if (slot) {
      setSelectedTime(slot.time);
      setSelectedStartUtc(slot.startUtc);
    }
    initial_slot_applied_ref.current = true;
  }, [open, booking.start_at, selectedDate, timeslots]);

  useEffect(() => {
    if (loadingAvailability || loadingBookings) return;
    if (selectedDate && (selectedTime || selectedStartUtc)) {
      const valid = timeslots.some(
        (s) =>
          !s.disabled &&
          (selectedStartUtc
            ? s.startUtc === selectedStartUtc
            : s.time === selectedTime)
      );
      if (!valid) {
        setSelectedTime('');
        setSelectedStartUtc(null);
      }
    } else if (!selectedDate) {
      setSelectedTime('');
      setSelectedStartUtc(null);
    }
  }, [
    selectedDate,
    timeslots,
    selectedTime,
    selectedStartUtc,
    loadingAvailability,
    loadingBookings,
  ]);

  const title =
    mode === 'follow_up'
      ? 'Schedule follow-up'
      : mode === 'pick_datetime'
        ? 'Choose date & time'
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

    const duplicate_invitee = find_duplicate_invitee_booking_on_date(
      existing_for_slots as BusySlotBooking[],
      {
        start_at: startIso,
        timezone: viewerTimezone || providerTimezone || 'UTC',
        event_type_id: selectedType.id,
        invitee: {
          invitee_email: booking.invitee_email,
          invitee_phone: booking.invitee_phone,
          contact_id: booking.contact_id,
        },
        exclude_booking_id: exclude_self_from_duplicate ? booking.id : null,
      }
    );
    if (duplicate_invitee) {
      setError('You already have a booking on the selected date.');
      setDuplicatePreviewPath(booking_preview_path(duplicate_invitee.public_code));
      return;
    }
    const durationMin = event_type_session_duration_minutes(
      selectedType,
      resolveEffectiveBookingDurationMinutes(
        selectedType,
        intakeServiceIds,
        serviceCatalogForSlots
      )
    );
    const endDate = new Date(startDate.getTime() + durationMin * 60_000);
    if (
      isTimeSlotBooked(
        startDate,
        endDate,
        selectedDate,
        existing_for_slots as BusySlotBooking[],
        event_type_slot_capacity(selectedType),
        slot_occupancy_context_from_event_type(selectedType)
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

    setError(null);
    setDuplicatePreviewPath(null);
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
      className="fixed inset-0 z-100001 flex items-start justify-center overflow-y-auto bg-slate-900/40 backdrop-blur-[2px] p-4"
      role="dialog"
      aria-modal
      aria-labelledby="booking-datetime-modal-title"
      onClick={onClose}
    >
      <div
        className="my-8 w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-2">
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
            <div ref={modalTopRef} className="scroll-mt-2" />
            {error && (
              <InviteeDuplicateBookingAlert
                message={error}
                previewPath={duplicatePreviewPath}
                className="mb-4"
              />
            )}
            {saveError && (
              <InviteeDuplicateBookingAlert
                message={saveError}
                previewPath={saveDuplicatePreviewPath}
                className="mb-4"
              />
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
              onSelectDate={handleSelectDate}
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
              continueLabel={
                saving
                  ? 'Saving…'
                  : mode === 'pick_datetime'
                    ? 'Apply'
                    : 'Save'
              }
              continueDisabled={saving}
              previousStartAt={booking.start_at}
              previousEndAt={booking.end_at}
              minLeadTimeMinutes={minLead}
              customerTimezone={viewerTimezone}
              providerTimezone={providerTimezone}
              workspaceTimezoneConfigured={workspaceTimezoneConfigured}
              selectedStartUtc={selectedStartUtc}
              onTimezoneChange={handleTimezoneChange}
              dateExceptions={dateExceptions}
              serviceProviderId={serviceProviderIdForSlots}
              maxWindowDays={
                selectedType
                  ? event_type_max_window_days(selectedType)
                  : undefined
              }
              disableStripExpansion
              retainTimeslotsWhileLoading
            />
          </div>
        )}
      </div>
    </div>
  );
}
