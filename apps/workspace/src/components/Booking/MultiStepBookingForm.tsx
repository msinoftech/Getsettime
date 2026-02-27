'use client';

import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { useWorkspaceSettings } from '../../hooks/useWorkspaceSettings';
import { useBookingFormData } from '../../hooks/useBookingFormData';
import { useTimeslots } from '../../hooks/useTimeslots';
import { useIntakeValidation } from '../../hooks/useIntakeValidation';
import type { Department, EventType, IntakeValues, ServiceProvider } from '../../types/bookingForm';
import { DEFAULT_ACCENT_COLOR, DEFAULT_PRIMARY_COLOR, SUCCESS_REDIRECT_MS } from '../../constants/booking';
import { sortEventTypesByDuration } from '../../utils/bookingFormUtils';
import { isServicesEnabled } from '../../utils/intakeForm';
import { isTimeSlotBooked, normalizeDate } from '../../utils/bookingTime';
import { getDisplayTimezone, parseTimeStringTo24h } from '../../utils/timezone';

import { BookingPreviewSidebar } from './MultiStepBooking/BookingPreviewSidebar';
import { ProgressIndicator } from './MultiStepBooking/ProgressIndicator';
import { Step1DepartmentProvider } from './MultiStepBooking/Step1DepartmentProvider';
import { Step2ServiceSelection } from './MultiStepBooking/Step2ServiceSelection';
import { Step4IntakeForm } from './MultiStepBooking/Step4IntakeForm';
import { Step5Success } from './MultiStepBooking/Step5Success';

const Step3DateTime = lazy(() =>
  import('./MultiStepBooking/Step3DateTime').then((m) => ({ default: m.Step3DateTime }))
);

interface MultiStepBookingFormProps {
  onSave: () => void;
  onCancel: () => void;
}

const StepFallback = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-8 h-8 border-[3px] border-purple-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

const MultiStepBookingForm = ({ onSave, onCancel }: MultiStepBookingFormProps) => {
  const { general, settings, loading: loadingSettings } = useWorkspaceSettings();
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
  const [touched, setTouched] = useState({ name: false, email: false, phone: false });
  const [touchedCustomFields, setTouchedCustomFields] = useState<Record<string, boolean>>({});
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [workspacePrimaryColor, setWorkspacePrimaryColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [workspaceAccentColor, setWorkspaceAccentColor] = useState<string | null>(null);

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
    workspaceName,
    workspaceLogoUrl,
  } = useBookingFormData({
    selectedDepartment,
    selectedProvider,
    days,
    intakeForm,
    onAvailabilityChange,
  });

  const sortedEventTypes = useMemo(() => sortEventTypesByDuration(eventTypes), [eventTypes]);

  const timeslots = useTimeslots(selectedType, selectedDate, availabilitySettings, existingBookings);

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

  useEffect(() => {
    if (!loadingDepartments && departments.length === 0 && step === 1) setStep(2);
  }, [loadingDepartments, departments.length, step]);

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
    if (confirmed) {
      const t = setTimeout(() => {
        setStep(1);
        setSelectedDepartment(null);
        setSelectedProvider(null);
        setSelectedType(null);
        setSelectedDate(null);
        setSelectedTime('');
        setName('');
        setEmail('');
        setPhone('');
        setNotes('');
        setConfirmed(false);
        onSave();
      }, SUCCESS_REDIRECT_MS);
      return () => clearTimeout(t);
    }
  }, [confirmed, onSave]);

  useEffect(() => {
    if (!loadingSettings && general) {
      if (general.primaryColor) setWorkspacePrimaryColor(general.primaryColor);
      if (general.accentColor) setWorkspaceAccentColor(general.accentColor);
    }
  }, [loadingSettings, general]);

  useEffect(() => {
    if (intakeForm && !isServicesEnabled(intakeForm)) {
      setSelectedServiceIds((prev) => prev.filter((id) => services.some((s) => s.id === id)));
    }
  }, [intakeForm, services]);

  const handleConfirm = async () => {
    if (!selectedType || !selectedDate || !selectedTime) {
      setError('Please fill in all required fields');
      return;
    }
    if (!isStep4Valid) {
      const first = intakeValidation._config || intakeValidation.name || intakeValidation.email || intakeValidation.phone || intakeValidation.services;
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
      setError(`This time slot is not available${selectedSlot.reason ? ` (${selectedSlot.reason})` : ''}. Please select another time.`);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { supabase } = await import('@/lib/supabaseClient');
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const { data: { user } } = await supabase.auth.getUser();
      const workspaceId = user?.user_metadata?.workspace_id;
      let bookingStatus = 'pending';
      if (workspaceId) {
        const { data: configData } = await supabase.from('configurations').select('settings').eq('workspace_id', workspaceId).single();
        if (configData?.settings?.notifications?.['auto-confirm-booking'] === true) bookingStatus = 'confirmed';
      }

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

      const metadata: Record<string, unknown> = {};
      if (additionalDescriptionEnabled && notes.trim()) metadata.notes = notes.trim();
      if (Object.keys(intakeFormPayload).length > 0) metadata.intake_form = intakeFormPayload;

      const timezone = getDisplayTimezone(general?.timezone);

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          event_type_id: selectedType.id,
          service_provider_id: selectedProvider?.id || null,
          department_id: selectedDepartment?.id ?? null,
          invitee_name: inviteeName,
          invitee_email: emailEnabled ? (email.trim() || null) : null,
          invitee_phone: phoneEnabled ? (phone.trim() || null) : null,
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
          status: bookingStatus,
          metadata: Object.keys(metadata).length > 0 ? metadata : null,
          ...(timezone ? { timezone } : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create booking');
      }
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

  return (
    <div className="w-full max-w-7xl h-auto mx-auto px-6 sm:px-4 py-4 sm:py-6 lg:py-8">
      <div className="rounded-xl drop-shadow-xl overflow-hidden bg-gray-100 relative backdrop-blur-xl">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full opacity-10 blur-3xl" style={{ background: `radial-gradient(circle, ${primary}, transparent)` }} />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-10 blur-3xl" style={{ background: `radial-gradient(circle, ${accent}, transparent)` }} />
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
            displayTimezone={getDisplayTimezone(general?.timezone)}
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
                  onBack={() => setStep(3)}
                  onConfirm={handleConfirm}
                />
              )}
              {step === 5 && (
                <Step5Success
                  selectedType={selectedType}
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
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
