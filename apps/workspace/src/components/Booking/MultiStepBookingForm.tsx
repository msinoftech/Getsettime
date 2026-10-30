'use client';

import { authFetch } from '@/src/lib/auth_session';
import React, { useState, useEffect, useMemo, useCallback, useRef, lazy, Suspense } from 'react';
import { useWorkspaceSettings } from '../../hooks/useWorkspaceSettings';
import { useBookingFormData } from '../../hooks/useBookingFormData';
import { useAutoSelectSoleBookingOptions } from '../../hooks/useAutoSelectSoleBookingOptions';
import { useAutoAdvanceSkippableBookingSteps } from '../../hooks/useAutoAdvanceSkippableBookingSteps';
import { useBookingStepStates } from '../../hooks/useBookingStepStates';
import { useTimeslots } from '../../hooks/useTimeslots';
import { useIntakeValidation } from '../../hooks/useIntakeValidation';
import { useBookingStepFlow } from '../../hooks/useBookingStepFlow';
import { useBookSeriesOption } from '../../hooks/useBookSeriesOption';
import type {
  Department,
  EventType,
  IntakeValues,
  MultiStepBookingFormProps,
  ServiceProvider,
} from '../../types/bookingForm';
import {
  BOOKINGS_LIST_REFRESH_EVENT,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
} from '../../constants/booking';
import { sortEventTypesByDuration } from '../../utils/bookingFormUtils';
import { resolve_provider_scoped_service_gate } from '../../utils/provider_scoped_service_gate';
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
import { slot_occupancy_context_from_event_type } from '@/lib/booking_capacity';
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
  booking_step_number,
  event_type_max_window_days,
  event_type_session_duration_minutes,
  event_type_slot_capacity,
  department_step_is_ready,
  event_type_step_is_ready,
  indicator_booking_step_ids,
  is_booking_step_resolving,
  is_event_type_before_department,
  parse_booking_step_order,
  previous_booking_step_id,
  resolve_next_booking_step_id,
} from '@/src/features/booking-flow';
import {
  step3PerfDateCommitted,
  step3PerfSlotCommitted,
  step3PerfSync,
} from '@/src/utils/bookingStep3Perf';

import { BookingPreviewSidebar } from './MultiStepBooking/BookingPreviewSidebar';
import { read_clinic_image_url } from '@/src/utils/workspace_logo';
import { format_workspace_public_address } from '@/src/utils/workspace_public_address';
import { ProgressIndicator } from './MultiStepBooking/ProgressIndicator';
import { Step1DepartmentProvider } from './MultiStepBooking/Step1DepartmentProvider';
import { Step2ServiceSelection } from './MultiStepBooking/Step2ServiceSelection';
import { Step4IntakeForm } from './MultiStepBooking/Step4IntakeForm';
import { Step5Success } from './MultiStepBooking/Step5Success';
import { useAuth } from '@/src/providers/AuthProvider';
import { InviteeDuplicateBookingAlert } from './InviteeDuplicateBookingAlert';
import {
  apply_booking_form_error,
  BookingFormSubmitError,
  find_client_duplicate_invitee_error,
  throw_if_booking_api_error,
} from '@/src/utils/bookingFormDuplicateInvitee';

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
  const { general, settings, loading: loadingSettings, bookingStepOrder } = useWorkspaceSettings();
  const { user, accessToken } = useAuth();
  const parsed_step_order = useMemo(
    () => parse_booking_step_order(bookingStepOrder),
    [bookingStepOrder]
  );
  const {
    current_step_id,
    step_order,
    is_step,
    go_to_step,
    progress_ids,
  } = useBookingStepFlow({
    step_order: parsed_step_order,
    hide_success_in_progress: true,
  });
  const event_type_before_department = is_event_type_before_department(step_order);
  // Once the user manually steps backward, stop auto-advancing/masking so they can
  // review earlier steps (department, event type) even when each has a single option.
  const [disableAutoAdvance, setDisableAutoAdvance] = useState(false);
  const stepTopRef = useRef<HTMLDivElement | null>(null);
  const hasMountedRef = useRef(false);

  // Scroll the step content back to the top whenever the step changes (skip the
  // initial render so opening the form doesn't trigger an unwanted scroll).
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    stepTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [current_step_id]);

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
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [duplicatePreviewPath, setDuplicatePreviewPath] = useState<string | null>(null);
  const showFormError = useCallback((message: string, previewPath?: string | null) => {
    setError(message);
    setDuplicatePreviewPath(previewPath ?? null);
  }, []);
  const clearFormError = useCallback(() => {
    setError(null);
    setDuplicatePreviewPath(null);
  }, []);

  useEffect(() => {
    if (error) {
      stepTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [error, duplicatePreviewPath]);

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [workspacePrimaryColor, setWorkspacePrimaryColor] = useState(DEFAULT_PRIMARY_COLOR);
  const [workspaceAccentColor, setWorkspaceAccentColor] = useState<string | null>(null);
  const [selectedMeetingOption, setSelectedMeetingOption] = useState('');
  const { bookSeries, setBookSeries, showBookSeriesOption } = useBookSeriesOption({
    selectedType,
  });

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
    dateExceptions,
    loadingAvailability,
    loadingBookings,
    services,
    setServices,
    loadingServices,
    providerScopedCatalogServices,
    loadingProviderScopedCatalog,
    providerScopedCatalogSettled,
    workspaceOwnerUserId,
    showProviderPicker,
    workspaceName,
    workspaceLogoUrl,
    workspaceHostProfileHighlights,
    providerHostProfileHighlights,
    effectiveProviderId,
    providerMeetingOptions,
    providerNotifications,
  } = useBookingFormData({
    selectedDepartment,
    selectedProvider,
    selectedType,
    lockEventTypeCatalog: event_type_before_department && !!selectedType,
    eventTypeBeforeDepartment: event_type_before_department,
    days,
    intakeForm,
    onAvailabilityChange,
  });

  const workspaceAddress = useMemo(
    () => format_workspace_public_address(general as Record<string, unknown> | undefined),
    [general]
  );

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
    if (!selectedType || !event_type_before_department) return;
    setSelectedDepartment(null);
    setSelectedProvider(null);
    setSelectedServiceIds([]);
  }, [selectedType?.id, event_type_before_department]);

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

  const providerCatalogContextReady = !!selectedDepartment && !!effectiveProviderId;
  const serviceGate = useMemo(
    () =>
      resolve_provider_scoped_service_gate(
        providerScopedCatalogServices,
        loadingProviderScopedCatalog,
        providerCatalogContextReady,
        providerScopedCatalogSettled
      ),
    [
      providerScopedCatalogServices,
      loadingProviderScopedCatalog,
      providerCatalogContextReady,
      providerScopedCatalogSettled,
    ]
  );

  const handleAutoSelectSingleService = useCallback((id: string) => {
    setSelectedServiceIds((prev) => (prev.length === 1 && prev[0] === id ? prev : [id]));
  }, []);

  const sortedEventTypes = useMemo(() => sortEventTypesByDuration(eventTypes), [eventTypes]);

  const department_step_ready = department_step_is_ready(step_order, selectedType);

  const event_type_context_ready = event_type_step_is_ready(step_order, {
    departmentsCount: departments.length,
    hasSelectedDepartment: !!selectedDepartment,
    showProviderPicker,
    hasSelectedProvider: !!selectedProvider,
  });

  useAutoSelectSoleBookingOptions({
    enabled: !disableAutoAdvance && department_step_ready,
    autoSelectEventTypeEnabled: !disableAutoAdvance && event_type_context_ready,
    loadingDepartments,
    departments,
    selectedDepartment,
    setSelectedDepartment,
    setSelectedProvider,
    selectedProvider,
    showProviderPicker,
    serviceProviders,
    onClearOptionalServices: () => setSelectedServiceIds([]),
    loadingProviderScopedCatalog,
    providerScopedCatalogServices,
    providerCatalogContextReady,
    providerScopedCatalogSettled,
    onAutoSelectSingleService: handleAutoSelectSingleService,
    loadingEventTypes,
    eventTypes: sortedEventTypes,
    selectedType,
    setSelectedType,
    eventTypeContextReady: event_type_context_ready,
  });

  const step_states = useBookingStepStates({
    step_order,
    loadingEventTypes,
    eventTypesCount: sortedEventTypes.length,
    selectedType,
    departmentsCount: departments.length,
    loadingDepartments,
    selectedDepartment,
    showProviderPicker,
    serviceProvidersCount: serviceProviders.length,
    loadingProviders,
    selectedProvider,
    providerCatalogContextReady,
    loadingProviderScopedCatalog,
    providerScopedCatalogServices,
    providerScopedCatalogSettled,
    selectedServiceIds,
  });

  // While a step with nothing to choose settles its sole option, show a loader
  // instead of flashing the step we are about to skip.
  const current_step_resolving =
    !disableAutoAdvance && is_booking_step_resolving(step_states, current_step_id);

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
    viewerTimezone,
    dateExceptions,
    effectiveProviderId
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

  const visible_progress_ids = useMemo(
    () => indicator_booking_step_ids(progress_ids),
    [progress_ids]
  );

  const visible_progress_step = useMemo(
    () => booking_step_number(visible_progress_ids, current_step_id),
    [visible_progress_ids, current_step_id]
  );

  // Navigation adjacency follows the steps the user actually sees, so a skipped
  // single-option step never blocks the progress indicator.
  const step_nav_context = useMemo(
    (): booking_step_nav_context => ({
      current_step_id,
      step_order: visible_progress_ids,
      departmentsCount: departments.length,
      showProviderPicker,
      hasSelectedDepartment: !!selectedDepartment,
      hasSelectedProvider: !!selectedProvider,
      hasSelectedType: !!selectedType,
      loadingEventTypes,
      hasSelectedDate: !!selectedDate,
      hasSelectedTime: !!selectedTime,
      isSuccessScreen: is_step('success'),
    }),
    [
      current_step_id,
      visible_progress_ids,
      departments.length,
      showProviderPicker,
      selectedDepartment,
      selectedProvider,
      selectedType,
      loadingEventTypes,
      selectedDate,
      selectedTime,
      is_step,
    ]
  );

  const can_click_booking_step = useCallback(
    (target: number) => {
      const target_id = visible_progress_ids[target - 1];
      return !!target_id && can_navigate_to_booking_step(step_nav_context, target_id);
    },
    [visible_progress_ids, step_nav_context]
  );

  const handle_step_click = useCallback(
    (target: number) => {
      const target_id = visible_progress_ids[target - 1];
      if (!target_id || !can_navigate_to_booking_step(step_nav_context, target_id)) return;
      const current_index = step_order.indexOf(current_step_id);
      const target_index = step_order.indexOf(target_id);
      setDisableAutoAdvance(true);
      if (is_step('date_time') && target_index < current_index) {
        setSelectedDate(null);
        setSelectedTime('');
        setSelectedStartUtc(null);
      }
      go_to_step(target_id);
    },
    [step_nav_context, current_step_id, step_order, visible_progress_ids, is_step, go_to_step]
  );

  const go_to_next_step = useCallback(() => {
    const next_id = resolve_next_booking_step_id(step_order, current_step_id, step_states);
    if (next_id) go_to_step(next_id);
  }, [current_step_id, go_to_step, step_order, step_states]);

  const previous_step_id = useMemo(
    () => previous_booking_step_id(step_order, current_step_id),
    [current_step_id, step_order]
  );

  const go_to_previous_step = useCallback(() => {
    if (!previous_step_id) return;
    setDisableAutoAdvance(true);
    go_to_step(previous_step_id);
  }, [go_to_step, previous_step_id]);

  useAutoAdvanceSkippableBookingSteps({
    enabled: !disableAutoAdvance,
    current_step_id,
    step_order,
    step_states,
    go_to_step,
  });

  useEffect(() => {
    if (selectedType) {
      setSelectedDate(null);
      setSelectedTime('');
      setSelectedStartUtc(null);
    }
  }, [selectedType]);

  useEffect(() => {
    if (is_step('date_time') && !selectedDate) setCurrentMonth(new Date());
  }, [current_step_id, selectedDate, is_step]);

  useEffect(() => {
    if (is_step('date_time') && !hasManualTimezone) {
      void refreshLocation();
    }
  }, [current_step_id, hasManualTimezone, refreshLocation, is_step]);

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
    if (is_step('intake')) {
      setTouched({ name: false, email: false, phone: false });
      setTouchedCustomFields({});
    }
  }, [current_step_id, is_step]);

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

  useEffect(() => {
    if (!serviceGate.soleServiceId || loadingProviderScopedCatalog) return;
    setSelectedServiceIds((prev) =>
      prev.length === 1 && prev[0] === serviceGate.soleServiceId
        ? prev
        : [serviceGate.soleServiceId!]
    );
  }, [serviceGate.soleServiceId, loadingProviderScopedCatalog]);

  const ALLOWED_FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/heic', 'image/heif'];
  const MAX_PER_FILE_SIZE = 2 * 1024 * 1024;
  const MAX_TOTAL_FILE_SIZE = 10 * 1024 * 1024;

  const validateFiles = useCallback((nextFiles: File[]): boolean => {
    if (nextFiles.length === 0) {
      setFileError('');
      return true;
    }
    for (const f of nextFiles) {
      if (!ALLOWED_FILE_TYPES.includes(f.type)) {
        setFileError('Only PDF, PNG, JPG, and HEIC files are allowed.');
        return false;
      }
      if (f.size > MAX_PER_FILE_SIZE) {
        setFileError('Each file must be 2 MB or less.');
        return false;
      }
    }
    const totalSize = nextFiles.reduce((sum, f) => sum + f.size, 0);
    if (totalSize > MAX_TOTAL_FILE_SIZE) {
      setFileError('Total file size must be 10 MB or less.');
      return false;
    }
    setFileError('');
    return true;
  }, []);

  const handleFilesChange = useCallback((nextFiles: File[]) => {
    if (!validateFiles(nextFiles)) {
      return;
    }
    setFiles(nextFiles);
    setFileError('');
  }, [validateFiles]);

  const handleConfirm = async () => {
    if (!selectedType || !selectedDate || !selectedTime) {
      showFormError('Please fill in all required fields');
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
      showFormError(first || 'Please fill in all required fields');
      return;
    }
    const usesExplicitProviderPicker =
      departments.length > 0 && selectedDepartment !== null && showProviderPicker;
    if (departments.length > 0) {
      if (!selectedDepartment) {
        showFormError('Please select a department');
        return;
      }
      if (usesExplicitProviderPicker && !selectedProvider) {
        showFormError('Please select a service provider');
        return;
      }
    }
    const selectedSlot = timeslots.find((s) =>
      selectedStartUtc ? s.startUtc === selectedStartUtc : s.time === selectedTime
    );
    if (selectedSlot?.disabled) {
      showFormError(`This time slot is not available${selectedSlot.reason ? ` (${selectedSlot.reason})` : ''}. Please select another time.`);
      return;
    }
    if (!selectedSlot?.startUtc) {
      showFormError('Invalid time selection. Please try again.');
      return;
    }

    setLoading(true);
    clearFormError();

    try {
      if (!accessToken) throw new Error('Not authenticated');

      let bookingStatus = 'pending';
      if (resolvedNotifications?.['auto-confirm-booking'] === true) {
        bookingStatus = 'confirmed';
      }

      const durationMin = event_type_session_duration_minutes(
        selectedType,
        resolveEffectiveBookingDurationMinutes(
          selectedType,
          selectedServiceIds,
          serviceCatalogForSlots
        )
      );
      const startDate = new Date(selectedSlot.startUtc);
      if (startDate < new Date()) {
        showFormError('Cannot book a time slot in the past. Please select a future time.');
        setLoading(false);
        return;
      }

      const endDate = new Date(startDate.getTime() + durationMin * 60_000);
      if (
        isTimeSlotBooked(
          startDate,
          endDate,
          selectedDate,
          existingBookings,
          event_type_slot_capacity(selectedType),
          slot_occupancy_context_from_event_type(selectedType)
        )
      ) {
        showFormError('This time slot has already been booked. Please refresh and select another time.');
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
          showFormError('Enter a valid phone number');
          setLoading(false);
          return;
        }
        inviteePhoneE164 = normalized.value;
      }

      const duplicateError = find_client_duplicate_invitee_error(existingBookings, {
        start_at: startDate.toISOString(),
        timezone: viewerTimezone,
        event_type_id: selectedType.id,
        invitee: {
          invitee_email: emailEnabled ? email.trim() || null : null,
          invitee_phone: inviteePhoneE164,
        },
      });
      if (duplicateError) {
        apply_booking_form_error(setError, setDuplicatePreviewPath, duplicateError);
        setLoading(false);
        return;
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

      if (files.length > 0 && intakeForm?.file_upload === true) {
        if (!validateFiles(files)) {
          setLoading(false);
          return;
        }
        const uploadedUrls: string[] = [];
        for (const uploadFile of files) {
          const uploadForm = new FormData();
          uploadForm.append('file', uploadFile);
          uploadForm.append('workspace_id', String(user?.user_metadata?.workspace_id));
          const uploadRes = await fetch('/api/embed/upload', { method: 'POST', body: uploadForm });
          const uploadResult = await uploadRes.json();
          if (!uploadRes.ok) {
            throw new Error(uploadResult.error || 'Failed to upload file');
          }
          uploadedUrls.push(uploadResult.url);
        }
        intakeFormPayload.file_upload_urls = uploadedUrls;
        intakeFormPayload.file_upload_url = uploadedUrls[0];
      }

      if (Object.keys(intakeFormPayload).length > 0) metadata.intake_form = intakeFormPayload;

      const service_provider_id =
        departments.length === 0
          ? selectedProvider?.id ?? null
          : usesExplicitProviderPicker
            ? selectedProvider!.id
            : workspaceOwnerUserId ?? null;

      const res = await authFetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
          book_series: bookSeries,
        }),
      });

      const result = await res.json();
      throw_if_booking_api_error(res, result, 'Failed to create booking');
      if (result.preview_url) setPreviewUrl(result.preview_url);
      go_to_step('success');
      window.dispatchEvent(new Event(BOOKINGS_LIST_REFRESH_EVENT));
      window.dispatchEvent(new Event('bookings-viewed-update'));
    } catch (err) {
      if (err instanceof BookingFormSubmitError) {
        apply_booking_form_error(setError, setDuplicatePreviewPath, {
          message: err.message,
          duplicatePreviewPath: err.duplicatePreviewPath,
        });
      } else {
        showFormError((err as Error).message || 'An error occurred');
      }
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
            ? 'relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_16px_40px_-20px_rgba(15,23,42,0.18)] backdrop-blur-xl'
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
            workspaceTagline={general?.tagline}
            workspaceLogoUrl={workspaceLogoUrl}
            workspaceClinicImageUrl={read_clinic_image_url(
              general as Record<string, unknown> | undefined
            )}
            workspaceHostProfileHighlights={workspaceHostProfileHighlights}
            providerHostProfileHighlights={providerHostProfileHighlights}
            workspaceAddress={workspaceAddress}
            workspacePrimaryColor={workspacePrimaryColor}
            workspaceAccentColor={workspaceAccentColor}
            loadingSettings={loadingSettings}
            departments={departments}
            selectedDepartment={selectedDepartment}
            selectedProvider={selectedProvider}
            selectedType={selectedType}
            selectedDate={selectedDate}
            selectedTime={selectedTime}
            current_step_id={current_step_id}
            step={visible_progress_step}
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
          <div ref={stepTopRef} className="scroll-mt-4 p-4 sm:p-6 bg-white relative">
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
            {!current_step_resolving && (
              <ProgressIndicator
                step={visible_progress_step}
                totalSteps={visible_progress_ids.length}
                onStepClick={handle_step_click}
                canClickStep={can_click_booking_step}
              />
            )}
            {error && (
              <InviteeDuplicateBookingAlert
                message={error}
                previewPath={duplicatePreviewPath}
                className="mb-6"
              />
            )}
            <div className="relative">
              {current_step_resolving && <StepFallback />}
              {is_step('department_provider') && !current_step_resolving && (
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
                  onBack={previous_step_id ? go_to_previous_step : undefined}
                  onContinue={go_to_next_step}
                />
              )}
              {is_step('event_type') && !current_step_resolving && (
                <Step2ServiceSelection
                  eventTypes={sortedEventTypes}
                  selectedType={selectedType}
                  loadingEventTypes={loadingEventTypes}
                  onSelectType={setSelectedType}
                  onBack={previous_step_id ? go_to_previous_step : undefined}
                  onContinue={go_to_next_step}
                />
              )}
              {is_step('date_time') && (
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
                    dateExceptions={dateExceptions}
                    serviceProviderId={effectiveProviderId}
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
                    onBack={previous_step_id ? () => {
                      go_to_previous_step();
                      setSelectedDate(null);
                      setSelectedTime('');
                      setSelectedStartUtc(null);
                    } : undefined}
                    onContinue={go_to_next_step}
                    onDaysChange={setDays}
                    bookSeries={bookSeries}
                    onBookSeriesChange={setBookSeries}
                    showBookSeriesOption={showBookSeriesOption}
                    maxWindowDays={event_type_max_window_days(selectedType)}
                    allowAutoAdvance={!disableAutoAdvance}
                  />
                </Suspense>
              )}
              {is_step('intake') && (
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
                  files={files}
                  onFilesChange={handleFilesChange}
                  fileError={fileError}
                  onBack={go_to_previous_step}
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
              {is_step('success') && (
                <Step5Success
                  selectedType={selectedType}
                  selectedDate={selectedDate}
                  selectedTime={selectedTime}
                  selectedStartUtc={selectedStartUtc}
                  customerTimezone={viewerTimezone}
                  providerTimezone={providerTimezone}
                  previewUrl={previewUrl}
                  onDone={embedded ? onSave : undefined}
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
