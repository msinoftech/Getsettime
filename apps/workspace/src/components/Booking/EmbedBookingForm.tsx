'use client';

import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import type { Workspace } from '@app/db';
import type { Department, EventType, IntakeValues, ServiceProvider } from '@/src/types/bookingForm';
import { useEmbedBookingFormData } from '@/src/hooks/useEmbedBookingFormData';
import { useTimeslots } from '@/src/hooks/useTimeslots';
import { useIntakeValidation } from '@/src/hooks/useIntakeValidation';
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
} from '@/src/constants/booking';
import { isServicesEnabled } from '@/src/utils/intakeForm';
import { isTimeSlotBooked, normalizeDate } from '@/src/utils/bookingTime';
import { getDisplayTimezone, parseTimeStringTo24h } from '@/src/utils/timezone';
import {
  getSortedFilteredEventTypes,
  parseEventTypeDurationParam,
} from '@/src/utils/bookingFormUtils';
import { BookingPreviewSidebar } from './MultiStepBooking/BookingPreviewSidebar';
import { ProgressIndicator } from './MultiStepBooking/ProgressIndicator';
import { Step1DepartmentProvider } from './MultiStepBooking/Step1DepartmentProvider';
import { Step2ServiceSelection } from './MultiStepBooking/Step2ServiceSelection';
import { Step4IntakeForm } from './MultiStepBooking/Step4IntakeForm';
import { Step5Success } from './MultiStepBooking/Step5Success';
import { AdminNoticeBanner, AdminNoticeIcon } from './MultiStepBooking/AdminNotice';

const Step3DateTime = lazy(() =>
  import('./MultiStepBooking/Step3DateTime').then((m) => ({ default: m.Step3DateTime }))
);

interface EmbedBookingFormProps {
  workspace: Workspace;
  eventType?: string;
  eventTypeSlug?: string;
  rescheduleCode?: string;
}

const StepFallback = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-8 h-8 border-[3px] border-purple-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function EmbedBookingForm({ workspace, eventType, eventTypeSlug, rescheduleCode }: EmbedBookingFormProps) {
  const isRescheduleMode = Boolean(rescheduleCode);
  const [rescheduleEventTypeId, setRescheduleEventTypeId] = useState<string | null>(null);
  const [rescheduleReady, setRescheduleReady] = useState(false);
  const [previousStartAt, setPreviousStartAt] = useState<string | null>(null);
  const [previousEndAt, setPreviousEndAt] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  const [selectedType, setSelectedType] = useState<EventType | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<{ name: boolean; email: boolean; phone: boolean }>({
    name: false,
    email: false,
    phone: false,
  });
  const [touchedCustomFields, setTouchedCustomFields] = useState<Record<string, boolean>>({});
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);

  const targetDuration = parseEventTypeDurationParam(eventType);
  const [days, setDays] = useState<Date[]>(() =>
    Array.from({ length: 10 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return normalizeDate(d);
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
    loadingServices,
    intakeForm,
    generalSettings,
    workspaceOwnerAdminNotice,
  } = useEmbedBookingFormData({
    workspace,
    selectedDepartment,
    selectedProvider,
    selectedType,
    days,
    intakeForm: undefined,
    onAvailabilityChange,
  });

  const sortedEventTypes = getSortedFilteredEventTypes(eventTypes, {
    slug: eventTypeSlug,
    duration: targetDuration,
  });

  const timeslots = useTimeslots(selectedType, selectedDate, availabilitySettings, existingBookings, isRescheduleMode ? 60 : 0);

  const intakeValidation = useIntakeValidation(
    intakeForm,
    name,
    email,
    phone,
    customFieldValues,
    selectedServiceIds,
    services,
    loadingServices
  );
  const isStep4Valid = Object.keys(intakeValidation).length === 0;

  const workspacePrimaryColor = generalSettings?.primaryColor ?? DEFAULT_PRIMARY_COLOR;
  const workspaceAccentColor = generalSettings?.accentColor ?? null;
  const hasPreselectedEventType = Boolean(
    (eventTypeSlug || targetDuration !== null) && selectedType && sortedEventTypes.length === 1
  );

  useEffect(() => {
    if ((eventTypeSlug || targetDuration !== null) && sortedEventTypes.length === 1 && !selectedType) {
      setSelectedType(sortedEventTypes[0]);
    }
  }, [eventTypeSlug, targetDuration, sortedEventTypes, selectedType]);

  useEffect(() => {
    if (isRescheduleMode) return;
    if (!loadingDepartments && departments.length === 0 && step === 1) {
      setStep(hasPreselectedEventType ? 3 : 2);
    }
  }, [loadingDepartments, departments.length, step, hasPreselectedEventType, isRescheduleMode]);

  useEffect(() => {
    if (hasPreselectedEventType && step === 2) setStep(3);
  }, [hasPreselectedEventType, step]);

  useEffect(() => {
    if (selectedType) {
      setSelectedDate(null);
      setSelectedTime('');
    }
  }, [selectedType]);

  useEffect(() => {
    if (step === 3 && !selectedDate) setCurrentMonth(new Date());
  }, [step, selectedDate]);

  useEffect(() => {
    if (selectedDate && selectedTime) {
      const valid = timeslots.some((s) => s.time === selectedTime && !s.disabled);
      if (!valid) setSelectedTime('');
    } else if (!selectedDate) setSelectedTime('');
  }, [selectedDate, timeslots, selectedTime]);

  useEffect(() => {
    if (!intakeForm) return;
    if (intakeForm.name === false) setName('');
    if (intakeForm.email === false) setEmail('');
    if (intakeForm.phone === false) setPhone('');
    if (intakeForm.additional_description === false) setNotes('');
  }, [intakeForm]);

  useEffect(() => {
    if (step === 4) {
      setTouched({ name: false, email: false, phone: false });
      setTouchedCustomFields({});
    }
  }, [step]);

  useEffect(() => {
    if (intakeForm && !isServicesEnabled(intakeForm)) {
      setSelectedServiceIds((prev) => prev.filter((id) => services.some((s) => s.id === id)));
    }
  }, [intakeForm, services]);

  // Reschedule mode: fetch original booking and extract event_type_id
  useEffect(() => {
    if (!rescheduleCode) return;
    const fetchOriginalBooking = async () => {
      try {
        const res = await fetch(`/api/booking-preview/${rescheduleCode}`);
        if (!res.ok) return;
        const json = await res.json();
        const etId = json.booking?.event_type_id as string | null;
        if (etId) setRescheduleEventTypeId(etId);
        if (json.booking?.start_at) setPreviousStartAt(json.booking.start_at);
        if (json.booking?.end_at) setPreviousEndAt(json.booking.end_at);
        setRescheduleReady(true);
      } catch {
        setRescheduleReady(true);
      }
    };
    fetchOriginalBooking();
  }, [rescheduleCode]);

  // Reschedule mode: auto-select event type once event types are loaded
  useEffect(() => {
    if (!isRescheduleMode || !rescheduleReady || !rescheduleEventTypeId) return;
    if (loadingEventTypes || selectedType) return;
    const match = eventTypes.find((et) => et.id === rescheduleEventTypeId);
    if (match) {
      setSelectedType(match);
      setStep(3);
    }
  }, [isRescheduleMode, rescheduleReady, rescheduleEventTypeId, loadingEventTypes, eventTypes, selectedType]);

  const ALLOWED_FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/heic', 'image/heif'];
  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

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

  const handleRescheduleConfirm = async () => {
    if (!selectedType || !selectedDate || !selectedTime || !rescheduleCode) {
      setError('Please select a date and time');
      return;
    }
    const selectedSlot = timeslots.find((s) => s.time === selectedTime);
    if (selectedSlot?.disabled) {
      setError('This time slot is not available. Please select another time.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const parsed = parseTimeStringTo24h(selectedTime);
      if (!parsed) {
        setError('Invalid time selection. Please try again.');
        setLoading(false);
        return;
      }
      const startDate = new Date(selectedDate);
      startDate.setHours(parsed.hour, parsed.minute, 0, 0);
      if (startDate < new Date()) {
        setError('Cannot reschedule to a time in the past.');
        setLoading(false);
        return;
      }

      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + (selectedType.duration_minutes || 30));
      if (isTimeSlotBooked(startDate, endDate, selectedDate, existingBookings)) {
        setError('This time slot has already been booked. Please select another time.');
        setLoading(false);
        return;
      }

      const timezone = getDisplayTimezone(generalSettings?.timezone);

      const res = await fetch('/api/embed/bookings/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_code: rescheduleCode,
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
          ...(timezone ? { timezone } : {}),
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to reschedule booking');
      }
      if (result.preview_url) setPreviewUrl(result.preview_url);
      setConfirmed(true);
      setStep(5);
    } catch (err) {
      setError((err as Error).message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

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
        intakeValidation.services;
      setError(first || 'Please fill in all required fields');
      return;
    }
    if (departments.length > 0) {
      if (!selectedProvider) {
        setError('Please select a service provider');
        return;
      }
      if (!selectedDepartment) {
        setError('Please select a department');
        return;
      }
    }
    const selectedSlot = timeslots.find((s) => s.time === selectedTime);
    if (selectedSlot?.disabled) {
      setError('This time slot is not available. Please select another time.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const parsed = parseTimeStringTo24h(selectedTime);
      if (!parsed) {
        setError('Invalid time selection. Please try again.');
        setLoading(false);
        return;
      }
      const startDate = new Date(selectedDate);
      startDate.setHours(parsed.hour, parsed.minute, 0, 0);
      if (startDate < new Date()) {
        setError('Cannot book a time slot in the past. Please select a future time.');
        setLoading(false);
        return;
      }

      const endDate = new Date(startDate);
      endDate.setMinutes(endDate.getMinutes() + (selectedType.duration_minutes || 30));
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

      const inviteeName = nameEnabled ? name.trim() : (email.trim() || phone.trim() || 'Invitee');
      const intakeFormPayload: IntakeValues = {};
      if (nameEnabled) intakeFormPayload.name = name.trim();
      if (emailEnabled) intakeFormPayload.email = email.trim();
      if (phoneEnabled) intakeFormPayload.phone = phone.trim();
      if (servicesEnabled) intakeFormPayload.services = selectedServiceIds;
      if (additionalDescriptionEnabled && notes.trim()) intakeFormPayload.additional_description = notes.trim();
      for (const field of intakeForm?.custom_fields || []) {
        const v = (customFieldValues[field.id] || '').trim();
        if (v) intakeFormPayload[field.id] = v;
      }
      if (sendWhatsapp) intakeFormPayload.whatsapp_opt_in = 'true';

      if (file && intakeForm?.file_upload === true) {
        if (!validateFile(file)) {
          setLoading(false);
          return;
        }
        const uploadForm = new FormData();
        uploadForm.append('file', file);
        uploadForm.append('workspace_id', String(workspace.id));
        const uploadRes = await fetch('/api/embed/upload', { method: 'POST', body: uploadForm });
        const uploadResult = await uploadRes.json();
        if (!uploadRes.ok) {
          throw new Error(uploadResult.error || 'Failed to upload file');
        }
        intakeFormPayload.file_upload_url = uploadResult.url;
      }

      const timezone = getDisplayTimezone(generalSettings?.timezone);

      const res = await fetch('/api/embed/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          event_type_id: selectedType.id,
          service_provider_id: selectedProvider?.id || null,
          department_id: selectedDepartment?.id || null,
          invitee_name: inviteeName,
          invitee_email: emailEnabled ? (email.trim() || null) : null,
          invitee_phone: phoneEnabled ? (phone.trim() || null) : null,
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
          intake_form: Object.keys(intakeFormPayload).length > 0 ? intakeFormPayload : null,
          ...(timezone ? { timezone } : {}),
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to create booking');
      }
      if (result.preview_url) setPreviewUrl(result.preview_url);
      setConfirmed(true);
      setStep(5);
    } catch (err) {
      setError((err as Error).message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const primary = workspacePrimaryColor || DEFAULT_PRIMARY_COLOR;
  const accent = workspaceAccentColor || primary || DEFAULT_ACCENT_COLOR;

  const provider_admin_notice =
    typeof selectedProvider?.admin_notice === 'string' &&
    selectedProvider.admin_notice.trim() !== ''
      ? selectedProvider.admin_notice.trim()
      : null;
  const admin_notice = provider_admin_notice ?? workspaceOwnerAdminNotice;

  return (
    <div className="w-full max-w-7xl h-auto mx-auto px-6 sm:px-4 py-4 sm:py-6 lg:py-8">
      <div className="rounded-xl drop-shadow-xl overflow-hidden bg-gray-100 relative backdrop-blur-xl">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-10 blur-3xl"
            style={{ background: `radial-gradient(circle, ${primary}, transparent)` }}
          />
          <div
            className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-10 blur-3xl"
            style={{ background: `radial-gradient(circle, ${accent}, transparent)` }}
          />
        </div>
        {/*admin_notice && (
          <AdminNoticeIcon
            notice={admin_notice}
            className="absolute right-3 top-3 sm:right-4 sm:top-4"
          />
        )*/}
        <div className="flex flex-col lg:grid lg:grid-cols-2 relative z-10">
          <BookingPreviewSidebar
            workspaceName={workspace.name}
            workspaceLogoUrl={workspace.logo_url ?? null}
            workspacePrimaryColor={workspacePrimaryColor}
            workspaceAccentColor={workspaceAccentColor}
            loadingSettings={false}
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
            displayTimezone={getDisplayTimezone(generalSettings?.timezone)}
          />
          <div className="p-4 sm:p-6 lg:p-8 xl:p-10 bg-white relative">
            <ProgressIndicator step={step} />
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
                  loadingDepartments={loadingDepartments}
                  loadingProviders={loadingProviders}
                  onSelectDepartment={(dept) => {
                    setSelectedDepartment(dept);
                    setSelectedProvider(null);
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
                  onSelectType={(t) => {
                    setSelectedType(t);
                    setStep(3);
                  }}
                />
              )}
              {step === 3 && (
                <Suspense fallback={<StepFallback />}>
                  <Step3DateTime
                    selectedDate={selectedDate}
                    selectedTime={selectedTime}
                    minLeadTimeMinutes={isRescheduleMode ? 60 : 0}
                    timeslots={timeslots}
                    days={days}
                    currentMonth={currentMonth}
                    showCalendar={showCalendar}
                    loadingAvailability={loadingAvailability}
                    loadingBookings={loadingBookings}
                    availabilitySettings={availabilitySettings}
                    existingBookings={existingBookings}
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
                    onSetCurrentMonth={(d) => setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1))}
                    onBack={isRescheduleMode ? undefined : () => {
                      setStep(departments.length === 0 ? 2 : 1);
                      setSelectedDate(null);
                      setSelectedTime('');
                    }}
                    onContinue={isRescheduleMode ? handleRescheduleConfirm : () => setStep(4)}
                    continueLabel={isRescheduleMode ? (loading ? 'Rescheduling...' : 'Confirm Reschedule') : undefined}
                    continueDisabled={isRescheduleMode ? loading : undefined}
                    onDaysChange={setDays}
                    previousStartAt={isRescheduleMode ? previousStartAt : undefined}
                    previousEndAt={isRescheduleMode ? previousEndAt : undefined}
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
                />
              )}
              {step === 5 && (
                <Step5Success
                  selectedType={selectedType}
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                  previewUrl={previewUrl}
                  isReschedule={isRescheduleMode}
                />
              )}
            </div>
          </div>
        </div>
        {/*admin_notice && (
          <div className="relative z-10 border-t border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
            <AdminNoticeBanner notice={admin_notice} className="mt-0" />
          </div>
        )*/}
      </div>
    </div>
  );
}
