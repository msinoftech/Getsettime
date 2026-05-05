'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { Department, EventType, ServiceProvider } from '@/src/types/bookingForm';
import { useBookingFormData } from '@/src/hooks/useBookingFormData';
import { useTimeslots } from '@/src/hooks/useTimeslots';
import { Step3DateTime } from '@/src/components/Booking/MultiStepBooking/Step3DateTime';
import type { AvailabilitySettings } from '@/src/types/bookingForm';
import type { Booking as BusySlotBooking } from '@/src/types/bookingForm';
import { isTimeSlotBooked, normalizeDate } from '@/src/utils/bookingTime';
import { getDisplayTimezone, parseTimeStringTo24h } from '@/src/utils/timezone';
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
  ) as { id: string | number; name: string } | undefined;
  if (!raw) return null;
  return {
    id: typeof raw.id === 'number' ? raw.id : Number(raw.id),
    name: raw.name,
    description: null,
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
  onConfirm: (payload: { start_at: string; end_at: string; status?: string }) => void;
  saving: boolean;
}) {
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
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

  const onAvailabilityChange = useCallback(() => {
    setSelectedDate(null);
    setSelectedTime('');
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

  const minLead = mode === 'reschedule' ? 60 : 0;
  const timeslots = useTimeslots(
    selectedType,
    selectedDate,
    availabilitySettings as AvailabilitySettings | null,
    existing_for_slots as BusySlotBooking[],
    minLead
  );

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
  }, [open, booking.start_at]);

  useEffect(() => {
    if (!open || !booking.start_at || !selectedDate) return;
    const d = new Date(booking.start_at);
    const pad = (n: number) => String(n).padStart(2, '0');
    const h = d.getHours();
    const m = d.getMinutes();
    const hour12 = h % 12 === 0 ? 12 : h % 12;
    const ampm = h >= 12 ? 'PM' : 'AM';
    const timeStr = `${hour12}:${pad(m)} ${ampm}`;
    setSelectedTime(timeStr);
  }, [open, booking.start_at, selectedDate]);

  useEffect(() => {
    if (selectedDate && selectedTime) {
      const valid = timeslots.some((s) => s.time === selectedTime && !s.disabled);
      if (!valid) setSelectedTime('');
    } else if (!selectedDate) setSelectedTime('');
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
    const slot = timeslots.find((s) => s.time === selectedTime);
    if (slot?.disabled) {
      setError(
        `This time slot is not available${slot.reason ? ` (${slot.reason})` : ''}.`
      );
      return;
    }
    const parsed = parseTimeStringTo24h(selectedTime);
    if (!parsed) {
      setError('Invalid time');
      return;
    }
    const startDate = new Date(selectedDate);
    startDate.setHours(parsed.hour, parsed.minute, 0, 0);
    if (startDate < new Date()) {
      setError('Cannot select a time in the past.');
      return;
    }
    const endDate = new Date(startDate);
    endDate.setMinutes(
      endDate.getMinutes() + (selectedType.duration_minutes || 30)
    );
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

    const payload: { start_at: string; end_at: string; status?: string } = {
      start_at: startDate.toISOString(),
      end_at: endDate.toISOString(),
    };

    if (mode === 'reschedule') payload.status = 'reschedule';

    void onConfirm(payload);
  };

  if (!open) return null;

  const tz = getDisplayTimezone(clientTimezone ?? undefined);

  /** Match intake/booking-form: implicit workspace host when picker is unnecessary */
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
              departmentsCount={departments.length}
              workspacePrimaryColor={workspacePrimaryColor}
              workspaceAccentColor={workspaceAccentColor}
              onSelectDate={setSelectedDate}
              onSelectTime={setSelectedTime}
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
            />
            <p className="mt-2 text-center text-xs text-slate-500">
              Times shown in {tz || 'local timezone'}.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
