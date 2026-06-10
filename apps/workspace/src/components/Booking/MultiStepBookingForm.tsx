'use client';

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useWorkspaceSettings } from '../../hooks/useWorkspaceSettings';
import { useBookingFormData } from '../../hooks/useBookingFormData';
import { useAutoAdvanceStep1 } from '../../hooks/useAutoAdvanceStep1';
import { useTimeslots } from '../../hooks/useTimeslots';
import { useIntakeValidation } from '../../hooks/useIntakeValidation';
import type {
  Department,
  EventType,
  IntakeValues,
  MultiStepBookingFormProps,
  ServiceProvider,
} from '../../types/bookingForm';
import { DEFAULT_ACCENT_COLOR, DEFAULT_PRIMARY_COLOR } from '../../constants/booking';
import { sortEventTypesByDuration } from '../../utils/bookingFormUtils';
import { isServicesEnabled } from '../../utils/intakeForm';
import {
  default_booking_meeting_option_key,
  effective_meeting_option_key,
  label_for_meeting_option_key,
  list_bookable_meeting_option_keys,
  type meeting_option_key,
} from '../../utils/meeting_options';
import {
  mergeServiceCatalogForDuration,
  resolveEffectiveBookingDurationMinutes,
} from '../../utils/bookingDuration';
import { isTimeSlotBooked } from '../../utils/bookingTime';
import {
  isWorkspaceTimezoneConfigured,
  resolveCustomerTimezone,
  resolveProviderTimezone,
} from '../../utils/timezone';
import { useLocationContext } from '@app/location';
import type { Timeslot } from '../../types/bookingForm';
import { normalizeInviteePhoneForStorage } from '@/src/utils/phone';
import {
  can_navigate_to_booking_step,
  type booking_step_nav_context,
} from '@/src/utils/booking_step_navigation';
import {
  step3PerfDateCommitted,
  step3PerfSlotCommitted,
  step3PerfSync,
} from '@/src/utils/bookingStep3Perf';

import { BookingPreviewSidebar } from './MultiStepBooking/BookingPreviewSidebar';
import { ProgressIndicator } from './MultiStepBooking/ProgressIndicator';
import { Step1DepartmentProvider } from './MultiStepBooking/Step1DepartmentProvider';
import { Step2ServiceSelection } from './MultiStepBooking/Step2ServiceSelection';
import { Step4IntakeForm } from './MultiStepBooking/Step4IntakeForm';
import { useAuth } from '@/src/providers/AuthProvider';

const Step3DateTime = lazy(() =>
  import('./MultiStepBooking/Step3DateTime').then((m) => ({ default: m.Step3DateTime }))
);

const StepFallback = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-8 h-8 border-[3px] border-indigo-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

const MultiStepBookingForm = ({
  variant = 'overlay',
  hide_embedded_toolbar = false,
  onSave,
  onCancel,
}: MultiStepBookingFormProps) => {
  const { general, settings, loading: loadingSettings } = useWorkspaceSettings();
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [selectedStartUtc, setSelectedStartUtc] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [touched, setTouched] = useState({ name: false, email: false, phone: false });
  const [touchedCustomFields, setTouchedCustomFields] = useState<Record<string, boolean>>({});
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [workspacePrimaryColor, setWorkspacePrimaryColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [workspaceAccentColor, setWorkspaceAccentColor] = useState<string | null>(null);
  const [selectedMeetingOption, setSelectedMeetingOption] = useState('');

  const intakeForm = settings.intake_form;

  const [days, setDays] = useState<Date[]>(() =>
    Array.from({ length: 10 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const n = new Date(d);
      n.setHours(0, 0, 0, 0);
      return n;
    })
  );

  const onAvailabilityChange = useCallback(() => {
    setSelectedDate(null);
    setSelectedTime('');
  }, []);

  const {
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
    setServices,
    loadingServices,
    providerScopedCatalogServices,
    loadingProviderScopedCatalog,
    workspaceOwnerUserId,
    showProviderPicker,
    workspaceName,
    workspaceLogoUrl,
    effectiveProviderId,
    providerMeetingOptions,
    providerNotifications,
  } = useBookingFormData({
    selectedDepartment,
    selectedProvider,
    days,
    intakeForm,
    onAvailabilityChange,
  });

  const resolvedMeetingOptions = providerMeetingOptions ?? settings.meeting_options;
  const resolvedNotifications = providerNotifications ?? settings.notifications;

  const bookableMeetingOptionKeys = useMemo(
    () =>
      list_bookable_meeting_option_keys(
        selectedType?.location_type,
        resolvedMeetingOptions
      ),
    [selectedType?.location_type, resolvedMeetingOptions]
  );

  const intakeMeetingValidation = useMemo(
    () =>
      bookableMeetingOptionKeys.length > 1
        ? { enabledKeys: bookableMeetingOptionKeys, selectedKey: selectedMeetingOption }
        : null,
    [bookableMeetingOptionKeys, selectedMeetingOption]
  );

  const meetingChoiceLabel = useMemo(() => {
    const k = effective_meeting_option_key(bookableMeetingOptionKeys, selectedMeetingOption);
    return k ? label_for_meeting_option_key(k) : '';
  }, [bookableMeetingOptionKeys, selectedMeetingOption]);

  useEffect(() => {
    if (
      selectedDepartment &&
      !departments.some((d) => d.id === selectedDepartment.id)
    ) {
      setSelectedDepartment(null);
      setSelectedProvider(null);
      setSelectedServiceIds([]);
    }
  }, [departments, selectedDepartment]);

  useEffect(() => {
    if (!selectedDepartment) return;
    if (serviceProviders.length === 1) {
      setSelectedProvider((prev) =>
        prev?.id === serviceProviders[0].id ? prev : serviceProviders[0]
      );
      return;
    }
    setSelectedProvider((prev) =>
      prev && serviceProviders.some((p) => p.id === prev.id) ? prev : null
    );
  }, [selectedDepartment, serviceProviders]);

  useAutoAdvanceStep1({
    enabled: true,
    step,
    loadingDepartments,
    departments,
    selectedDepartment,
    setSelectedDepartment,
    setSelectedProvider,
    selectedProvider,
    showProviderPicker,
    serviceProviders,
    onClearOptionalServices: () => setSelectedServiceIds([]),
    advanceToNextStep: () => setStep(2),
  });

  const sortedEventTypes = useMemo(() => sortEventTypesByDuration(eventTypes), [eventTypes]);

  const serviceCatalogForSlots = useMemo(
    () => mergeServiceCatalogForDuration(providerScopedCatalogServices, services),
    [providerScopedCatalogServices, services]
  );

  const profileCountry =
    typeof user?.user_metadata?.country === 'string' ? user.user_metadata.country : undefined;

  const {
    customerTimezone: manualCustomerTz,
    setCustomerTimezone,
    context: locationCtx,
    hasManualTimezone,
    refresh: refreshLocation,
  } = useLocationContext({
    hostTimezone: general?.timezone,
    profileCountry,
  });

  const viewerTimezone = resolveCustomerTimezone(manualCustomerTz, locationCtx?.timezone);
  const providerTimezone = resolveProviderTimezone(general?.timezone, viewerTimezone);
  const workspaceTimezoneConfigured = isWorkspaceTimezoneConfigured(general?.timezone);

  const timeslots = useTimeslots(
    selectedType,
    selectedDate,
    availabilitySettings,
    existingBookings,
    0,
    selectedServiceIds,
    serviceCatalogForSlots,
    providerTimezone,
    viewerTimezone
  );

  const handleSelectDate = useCallback((date: Date) => {
    const t0 = performance.now();
    setSelectedDate(date);
    setSelectedTime('');
    setSelectedStartUtc(null);
    step3PerfSync('MultiStepBookingForm handleSelectDate sync', t0);
  }, []);

  const handleSelectSlot = useCallback((slot: Timeslot) => {
    const t0 = performance.now();
    setSelectedTime(slot.time);
    setSelectedStartUtc(slot.startUtc);
    step3PerfSync('MultiStepBookingForm handleSelectSlot sync', t0, {
      startUtc: slot.startUtc,
    });
  }, []);

  useEffect(() => {
    if (!selectedDate) return;
    const enabled = timeslots.filter((s) => !s.disabled).length;
    step3PerfDateCommitted(selectedDate, enabled);
  }, [selectedDate, timeslots]);

  useEffect(() => {
    if (!selectedTime && !selectedStartUtc) return;
    step3PerfSlotCommitted(selectedTime, selectedStartUtc);
  }, [selectedTime, selectedStartUtc]);

  const handleTimezoneChange = useCallback(
    (tz: string) => {
      setCustomerTimezone(tz);
      setSelectedTime('');
      setSelectedStartUtc(null);
    },
    [setCustomerTimezone]
  );

  const hideIntakeCatalogServices = providerScopedCatalogServices.length > 0;

  const intakeValidation = useIntakeValidation(
    intakeForm,
    name,
    email,
    phone,
    customFieldValues,
    selectedServiceIds,
    services,
    loadingServices,
    hideIntakeCatalogServices && isServicesEnabled(intakeForm),
    intakeMeetingValidation
  );
  const isStep4Valid = Object.keys(intakeValidation).length === 0;

  const step_nav_context = useMemo(
    (): booking_step_nav_context => ({
      step,
      totalSteps: 4,
      departmentsCount: departments.length,
      showProviderPicker,
      hasSelectedDepartment: !!selectedDepartment,
      hasSelectedProvider: !!selectedProvider,
      hasSelectedType: !!selectedType,
      loadingEventTypes,
      hasSelectedDate: !!selectedDate,
      hasSelectedTime: !!selectedTime,
    }),
    [
      step,
      departments.length,
      showProviderPicker,
      selectedDepartment,
      selectedProvider,
      selectedType,
      loadingEventTypes,
      selectedDate,
      selectedTime,
    ]
  );

  const can_click_booking_step = useCallback(
    (target: number) => can_navigate_to_booking_step(step_nav_context, target),
    [step_nav_context]
  );

  const handle_step_click = useCallback(
    (target: number) => {
      if (!can_navigate_to_booking_step(step_nav_context, target)) return;
      if (step === 3 && target < 3) {
        setSelectedDate(null);
        setSelectedTime('');
        setSelectedStartUtc(null);
      }
      setStep(target);
    },
    [step_nav_context, step]
  );

  useEffect(() => {
    if (!loadingDepartments && departments.length === 0 && step === 1) setStep(2);
  }, [loadingDepartments, departments.length, step]);

  useEffect(() => {
    if (selectedType) {
      setSelectedDate(null);
      setSelectedTime('');
      setSelectedStartUtc(null);
    }
  }, [selectedType]);

  useEffect(() => {
    if (step === 3 && !selectedDate) setCurrentMonth(new Date());
  }, [step, selectedDate]);

  useEffect(() => {
    if (step === 3 && !hasManualTimezone) {
      void refreshLocation();
    }
  }, [step, hasManualTimezone, refreshLocation]);

  useEffect(() => {
    if (selectedDate && (selectedTime || selectedStartUtc)) {
      const valid = timeslots.some(
        (s) =>
          !s.disabled &&
          (selectedStartUtc ? s.startUtc === selectedStartUtc : s.time === selectedTime)
      );
      if (!valid) {
        setSelectedTime('');
        setSelectedStartUtc(null);
      }
    } else if (!selectedDate) {
      setSelectedTime('');
      setSelectedStartUtc(null);
    }
  }, [selectedDate, timeslots, selectedTime, selectedStartUtc]);

  useEffect(() => {
    if (!intakeForm) return;
    if (intakeForm.name === false) setName('');
    if (intakeForm.email === false) setEmail('');
    if (intakeForm.phone === false) setPhone('');
    setSendWhatsapp(false);
    if (intakeForm.additional_description === false) setNotes('');
  }, [intakeForm]);

  useEffect(() => {
    if (step === 4) {
      setTouched({ name: false, email: false, phone: false });
      setTouchedCustomFields({});
    }
  }, [step]);

  useEffect(() => {
    setSelectedMeetingOption((prev) => {
      if (
        prev.trim() &&
        bookableMeetingOptionKeys.includes(prev as meeting_option_key)
      ) {
        return prev;
      }
      return default_booking_meeting_option_key(
        bookableMeetingOptionKeys,
        resolvedMeetingOptions
      ) ?? '';
    });
  }, [selectedType?.id, bookableMeetingOptionKeys, resolvedMeetingOptions]);

  useEffect(() => {
    if (!loadingSettings && general) {
      if (general.primaryColor) setWorkspacePrimaryColor(general.primaryColor);
      if (general.accentColor) setWorkspaceAccentColor(general.accentColor);
    }
  }, [loadingSettings, general]);

  useEffect(() => {
    if (!intakeForm) return;
    const scoped = providerScopedCatalogServices;
    const catalogActive = scoped.length > 0;
    if (!isServicesEnabled(intakeForm)) {
      setSelectedServiceIds((prev) =>
        catalogActive ? prev.filter((id) => scoped.some((s) => s.id === id)) : []
      );
      return;
    }
    if (catalogActive) {
      setSelectedServiceIds((prev) =>
        prev.filter((id) => scoped.some((s) => s.id === id))
      );
    } else {
      setSelectedServiceIds((prev) =>
        prev.filter((id) => services.some((s) => s.id === id))
      );
    }
  }, [intakeForm, services, providerScopedCatalogServices]);

  const ALLOWED_FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/heic', 'image/heif'];
  const MAX_FILE_SIZE = 2 * 1024 * 1024;

  const validateFile = useCallback((f: File | null): boolean => {
    if (!f) {
      setFileError('');
      return true;
    }
    if (!ALLOWED_FILE_TYPES.includes(f.type)) {
      setFileError('Only PDF, PNG, JPG, and HEIC files are allowed.');
      return false;
    }
    if (f.size > MAX_FILE_SIZE) {
      setFileError('File size must be 2 MB or less.');
      return false;
    }
    setFileError('');
    return true;
  }, []);

  const handleFileChange = useCallback((f: File | null) => {
    if (f && !validateFile(f)) {
      setFile(null);
      return;
    }
    setFile(f);
    setFileError('');
  }, [validateFile]);

  const handleConfirm = async () => {
    if (!selectedType || !selectedDate || !selectedTime) {
      setError('Please fill in all required fields');
      return;
    }
    if (!isStep4Valid) {
      const first =
        intakeValidation._config ||
        intakeValidation.name ||
        intakeValidation.email ||
        intakeValidation.phone ||
        intakeValidation.services ||
        intakeValidation.meeting_option;
      setError(first || 'Please fill in all required fields');
      return;
    }
    const usesExplicitProviderPicker =
      departments.length > 0 && selectedDepartment !== null && showProviderPicker;
    if (departments.length > 0) {
      if (!selectedDepartment) {
        setError('Please select a department');
        return;
      }
      if (usesExplicitProviderPicker && !selectedProvider) {
        setError('Please select a service provider');
        return;
      }
    }
    const selectedSlot = timeslots.find((s) =>
      selectedStartUtc ? s.startUtc === selectedStartUtc : s.time === selectedTime
    );
    if (selectedSlot?.disabled) {
      setError(`This time slot is not available${selectedSlot.reason ? ` (${selectedSlot.reason})` : ''}. Please select another time.`);
      return;
    }
    if (!selectedSlot?.startUtc) {
      setError('Invalid time selection. Please try again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      let bookingStatus = 'pending';
      if (resolvedNotifications?.['auto-confirm-booking'] === true) {
        bookingStatus = 'confirmed';
      }

      const durationMin = resolveEffectiveBookingDurationMinutes(
        selectedType,
        selectedServiceIds,
        serviceCatalogForSlots
      );
      const startDate = new Date(selectedSlot.startUtc);
      if (startDate < new Date()) {
        setError('Cannot book a time slot in the past. Please select a future time.');
        setLoading(false);
        return;
      }

      const endDate = new Date(startDate.getTime() + durationMin * 60_000);
      if (isTimeSlotBooked(startDate, endDate, selectedDate, existingBookings)) {
        setError('This time slot has already been booked. Please refresh and select another time.');
        setLoading(false);
        return;
      }

      const nameEnabled = intakeForm?.name !== false;
      const emailEnabled = intakeForm?.email !== false;
      const phoneEnabled = intakeForm?.phone === true;
      const servicesEnabled = isServicesEnabled(intakeForm);
      const additionalDescriptionEnabled = intakeForm?.additional_description === true;

      let inviteePhoneE164: string | null = null;
      if (phoneEnabled) {
        const normalized = normalizeInviteePhoneForStorage(phone);
        if (normalized.invalid) {
          setError('Enter a valid phone number');
          setLoading(false);
          return;
        }
        inviteePhoneE164 = normalized.value;
      }

      const inviteeName = nameEnabled
        ? name.trim()
        : (email.trim() || inviteePhoneE164 || phone.trim() || 'Invitee');
      const intakeFormPayload: IntakeValues = {};
      if (nameEnabled) intakeFormPayload.name = name.trim();
      if (emailEnabled) intakeFormPayload.email = email.trim();
      if (phoneEnabled && inviteePhoneE164) intakeFormPayload.phone = inviteePhoneE164;
      if (servicesEnabled) intakeFormPayload.services = selectedServiceIds;
      else if (selectedServiceIds.length > 0) intakeFormPayload.services = selectedServiceIds;
      if (additionalDescriptionEnabled && notes.trim()) intakeFormPayload.additional_description = notes.trim();
      for (const field of intakeForm?.custom_fields || []) {
        const v = (customFieldValues[field.id] || '').trim();
        if (v) intakeFormPayload[field.id] = v;
      }

      const meetingKey = effective_meeting_option_key(
        bookableMeetingOptionKeys,
        selectedMeetingOption
      );
      if (meetingKey) {
        intakeFormPayload.meeting_option = meetingKey;
      }

      const metadata: Record<string, unknown> = {};
      if (additionalDescriptionEnabled && notes.trim()) metadata.notes = notes.trim();
      if (sendWhatsapp) metadata.whatsapp_opt_in = true;

      if (file && intakeForm?.file_upload === true) {
        if (!validateFile(file)) {
          setLoading(false);
          return;
        }
        const uploadForm = new FormData();
        uploadForm.append('file', file);
        uploadForm.append('workspace_id', String(user?.user_metadata?.workspace_id));
        const uploadRes = await fetch('/api/embed/upload', { method: 'POST', body: uploadForm });
        const uploadResult = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadResult.error || 'Failed to upload file');
        }
        intakeFormPayload.file_upload_url = uploadResult.url;
      }

      if (Object.keys(intakeFormPayload).length > 0) metadata.intake_form = intakeFormPayload;

      const service_provider_id =
        departments.length === 0
          ? selectedProvider?.id ?? null
          : usesExplicitProviderPicker
            ? selectedProvider!.id
            : workspaceOwnerUserId ?? null;

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          event_type_id: selectedType.id,
          service_provider_id,
          department_id: selectedDepartment?.id ?? null,
          invitee_name: inviteeName,
          invitee_email: emailEnabled ? (email.trim() || null) : null,
          invitee_phone: phoneEnabled ? inviteePhoneE164 : null,
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
          status: bookingStatus,
          ...(meetingKey ? { location: { meeting_option: meetingKey } } : {}),
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
          customer_timezone: viewerTimezone,
          provider_timezone: providerTimezone,
          timezone: viewerTimezone,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to create booking');
      }
      window.dispatchEvent(new Event('bookings-viewed-update'));
      onSave();
    } catch (err) {
      setError((err as Error).message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const primary = workspacePrimaryColor || DEFAULT_PRIMARY_COLOR;
  const accent = workspaceAccentColor || primary || DEFAULT_ACCENT_COLOR;

  const embedded = variant === 'embedded';

  return (
    <div
      className={
        embedded
          ? 'w-full max-w-full'
          : 'mx-auto h-auto w-full max-w-7xl px-6 py-4 sm:px-4 sm:py-6 lg:py-8'
      }
    >
      <div
        className={
          embedded
            ? 'relative overflow-hidden rounded-[28px] border border-slate-200/70 bg-white shadow-[0_16px_40px_-20px_rgba(15,23,42,0.18)] backdrop-blur-xl'
            : 'relative overflow-hidden rounded-xl bg-gray-100 drop-shadow-xl backdrop-blur-xl'
        }
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className={`absolute -right-40 ${embedded ? '-top-32 w-64 h-64 opacity-[0.07]' : '-top-40 w-80 h-80 opacity-10 blur-3xl'} rounded-full blur-3xl`}
            style={{
              background: `radial-gradient(circle, ${primary}, transparent)`,
            }}
          />
          <div
            className={`absolute ${embedded ? '-left-36 -bottom-32 h-56 w-56 opacity-[0.07]' : '-bottom-40 -left-40 h-80 w-80 opacity-10 blur-3xl'} rounded-full blur-3xl`}
            style={{
              background: `radial-gradient(circle, ${accent}, transparent)`,
            }}
          />
        </div>
        <div className="flex flex-col lg:grid lg:grid-cols-2 relative z-10">
          <BookingPreviewSidebar
            workspaceName={workspaceName}
            workspaceLogoUrl={workspaceLogoUrl}
            workspacePrimaryColor={workspacePrimaryColor}
            workspaceAccentColor={workspaceAccentColor}
            loadingSettings={loadingSettings}
            departments={departments}
            selectedDepartment={selectedDepartment}
            selectedProvider={selectedProvider}
            selectedType={selectedType}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            step={step}
            name={name}
            email={email}
            phone={phone}
            notes={notes}
            displayTimezone={viewerTimezone}
            providerTimezone={providerTimezone}
            selectedStartUtc={selectedStartUtc}
            selectedStep1ServiceIds={selectedServiceIds}
            step1CatalogServices={providerScopedCatalogServices}
            intakeForm={intakeForm}
            customFieldValues={customFieldValues}
            meetingChoiceLabel={meetingChoiceLabel.trim() || undefined}
          />
          <div className="p-4 sm:p-6 lg:p-8 xl:p-10 bg-white relative">
            {embedded && !hide_embedded_toolbar && (
              <div className="mb-4 flex justify-end lg:absolute lg:right-6 lg:top-6 lg:z-20 lg:mb-0">
                <button
                  type="button"
                  onClick={onCancel}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            )}
            <ProgressIndicator
              step={step}
              totalSteps={4}
              onStepClick={handle_step_click}
              canClickStep={can_click_booking_step}
            />
            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                {error}
              </div>
            )}
            <div className="relative">
              {step === 1 && (
                <Step1DepartmentProvider
                  departments={departments}
                  selectedDepartment={selectedDepartment}
                  selectedProvider={selectedProvider}
                  serviceProviders={serviceProviders}
                  showProviderPicker={showProviderPicker}
                  loadingDepartments={loadingDepartments}
                  loadingProviders={loadingProviders}
                  providerScopedCatalogServices={providerScopedCatalogServices}
                  loadingProviderScopedCatalog={loadingProviderScopedCatalog}
                  selectedOptionalServiceIds={selectedServiceIds}
                  onToggleOptionalService={(id) =>
                    setSelectedServiceIds((prev) =>
                      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                    )
                  }
                  onSelectDepartment={(dept) => {
                    setSelectedDepartment(dept);
                    setSelectedProvider(null);
                    setSelectedServiceIds([]);
                  }}
                  onSelectProvider={setSelectedProvider}
                  onContinue={() => setStep(2)}
                />
              )}
              {step === 2 && (
                <Step2ServiceSelection
                  eventTypes={sortedEventTypes}
                  selectedType={selectedType}
                  loadingEventTypes={loadingEventTypes}
                  onSelectType={setSelectedType}
                  onBack={
                    departments.length > 0
                      ? () => setStep(1)
                      : undefined
                  }
                  onContinue={() => setStep(3)}
                />
              )}
              {step === 3 && (
                <Suspense fallback={<StepFallback />}>
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
                    existingBookings={existingBookings}
                    selectedType={selectedType}
                    selectedServiceIds={selectedServiceIds}
                    serviceCatalog={serviceCatalogForSlots}
                    departmentsCount={departments.length}
                    workspacePrimaryColor={workspacePrimaryColor}
                    workspaceAccentColor={workspaceAccentColor}
                    onSelectDate={handleSelectDate}
                    onSelectTime={setSelectedTime}
                    onSelectSlot={handleSelectSlot}
                    selectedStartUtc={selectedStartUtc}
                    customerTimezone={viewerTimezone}
                    providerTimezone={providerTimezone}
                    workspaceTimezoneConfigured={workspaceTimezoneConfigured}
                    onTimezoneChange={handleTimezoneChange}
                    onToggleCalendar={() => setShowCalendar((s) => !s)}
                    onNavigateMonth={(dir) => setCurrentMonth((prev) => {
                      const next = new Date(prev);
                      next.setMonth(prev.getMonth() + (dir === 'next' ? 1 : -1));
                      return next;
                    })}
                    onSetCurrentMonth={(d) => setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1))}
                    onBack={() => {
                      setStep(departments.length === 0 ? 2 : 1);
                      setSelectedDate(null);
                      setSelectedTime('');
                      setSelectedStartUtc(null);
                    }}
                    onContinue={() => setStep(4)}
                    onDaysChange={setDays}
                  />
                </Suspense>
              )}
              {step === 4 && (
                <Step4IntakeForm
                  intakeForm={intakeForm}
                  name={name}
                  email={email}
                  phone={phone}
                  notes={notes}
                  sendWhatsapp={sendWhatsapp}
                  customFieldValues={customFieldValues}
                  selectedServiceIds={selectedServiceIds}
                  services={services}
                  loadingServices={loadingServices}
                  touched={touched}
                  touchedCustomFields={touchedCustomFields}
                  intakeValidation={intakeValidation}
                  loading={loading}
                  isStep4Valid={isStep4Valid}
                  onNameChange={setName}
                  onEmailChange={setEmail}
                  onPhoneChange={setPhone}
                  onNotesChange={setNotes}
                  onSendWhatsappChange={setSendWhatsapp}
                  onCustomFieldChange={(id, v) => setCustomFieldValues((prev) => ({ ...prev, [id]: v }))}
                  onServiceToggle={(id) =>
                    setSelectedServiceIds((prev) =>
                      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
                    )
                  }
                  onTouchedName={() => setTouched((t) => ({ ...t, name: true }))}
                  onTouchedEmail={() => setTouched((t) => ({ ...t, email: true }))}
                  onTouchedPhone={() => setTouched((t) => ({ ...t, phone: true }))}
                  onTouchedCustomField={(id) => setTouchedCustomFields((prev) => ({ ...prev, [id]: true }))}
                  file={file}
                  onFileChange={handleFileChange}
                  fileError={fileError}
                  onBack={() => setStep(3)}
                  onConfirm={handleConfirm}
                  hideIntakeCatalogServices={hideIntakeCatalogServices}
                  enabledMeetingOptionKeys={bookableMeetingOptionKeys}
                  selectedMeetingOption={selectedMeetingOption}
                  onMeetingOptionChange={setSelectedMeetingOption}
                  profileCountry={
                    typeof user?.user_metadata?.country === 'string'
                      ? user.user_metadata.country
                      : null
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiStepBookingForm;
