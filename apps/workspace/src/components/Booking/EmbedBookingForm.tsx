'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import type { Workspace } from '@app/db';
import type { Department, EventType, IntakeValues, ServiceProvider, Timeslot } from '@/src/types/bookingForm';
import { useEmbedBookingFormData } from '@/src/hooks/useEmbedBookingFormData';
import { useAutoSelectSoleBookingOptions } from '@/src/hooks/useAutoSelectSoleBookingOptions';
import { useAutoAdvanceSkippableBookingSteps } from '@/src/hooks/useAutoAdvanceSkippableBookingSteps';
import { useBookingStepStates } from '@/src/hooks/useBookingStepStates';
import { useTimeslots } from '@/src/hooks/useTimeslots';
import { useIntakeValidation } from '@/src/hooks/useIntakeValidation';
import { useBookingStepFlow } from '@/src/hooks/useBookingStepFlow';
import { useBookSeriesOption } from '@/src/hooks/useBookSeriesOption';
import {
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
} from '@/src/constants/booking';
import { isServicesEnabled } from '@/src/utils/intakeForm';
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
import { normalizeInviteePhoneForStorage } from '@/src/utils/phone';
import {
  getSortedFilteredEventTypes,
  parseEventTypeDurationParam,
} from '@/src/utils/bookingFormUtils';
import {
  default_booking_meeting_option_key,
  effective_meeting_option_key,
  label_for_meeting_option_key,
  list_bookable_meeting_option_keys,
  type meeting_option_key,
} from '@/src/utils/meeting_options';
import { BookingPreviewSidebar } from './MultiStepBooking/BookingPreviewSidebar';
import { format_workspace_public_address } from '@/src/utils/workspace_public_address';
import { ProgressIndicator } from './MultiStepBooking/ProgressIndicator';
import { Step1DepartmentProvider } from './MultiStepBooking/Step1DepartmentProvider';
import { Step2ServiceSelection } from './MultiStepBooking/Step2ServiceSelection';
import { Step4IntakeForm } from './MultiStepBooking/Step4IntakeForm';
import { Step5Success } from './MultiStepBooking/Step5Success';
import { AdminNoticeBanner, AdminNoticeIcon } from './MultiStepBooking/AdminNotice';
import {
  step3PerfDateCommitted,
  step3PerfSlotCommitted,
  step3PerfSync,
} from '@/src/utils/bookingStep3Perf';
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
import { resolve_provider_scoped_service_gate } from '@/src/utils/provider_scoped_service_gate';
import { slot_occupancy_context_from_event_type } from '@/lib/booking_capacity';
import { InviteeDuplicateBookingAlert } from './InviteeDuplicateBookingAlert';
import { EmbedBookingOtpModal } from './EmbedBookingOtpModal';
import {
  apply_booking_form_error,
  BookingFormSubmitError,
  find_client_duplicate_invitee_error,
  throw_if_booking_api_error,
} from '@/src/utils/bookingFormDuplicateInvitee';

const Step3DateTime = lazy(() =>
  import('./MultiStepBooking/Step3DateTime').then((m) => ({ default: m.Step3DateTime }))
);

interface EmbedBookingFormProps {
  workspace: Workspace;
  eventType?: string;
  eventTypeSlug?: string;
  serviceProviderId?: string;
  rescheduleCode?: string;
}

const StepFallback = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-8 h-8 border-[3px] border-purple-600 border-t-transparent rounded-full animate-spin" />
  </div>
);

export default function EmbedBookingForm({ workspace, eventType, eventTypeSlug, serviceProviderId, rescheduleCode }: EmbedBookingFormProps) {
  const isRescheduleMode = Boolean(rescheduleCode);
  const [rescheduleEventTypeId, setRescheduleEventTypeId] = useState<string | null>(null);
  const [rescheduleReady, setRescheduleReady] = useState(false);
  const [rescheduleNotAllowed, setRescheduleNotAllowed] = useState(false);
  const [previousStartAt, setPreviousStartAt] = useState<string | null>(null);
  const [previousEndAt, setPreviousEndAt] = useState<string | null>(null);
  const [rescheduleBookingMeta, setRescheduleBookingMeta] = useState<{
    id?: string | number;
    invitee_email?: string | null;
    invitee_phone?: string | null;
    contact_id?: string | number | null;
  } | null>(null);
  const [disableAutoAdvance, setDisableAutoAdvance] = useState(false);
  const stepTopRef = useRef<HTMLDivElement | null>(null);
  const hasMountedRef = useRef(false);

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
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<{ name: boolean; email: boolean; phone: boolean }>({
    name: false,
    email: false,
    phone: false,
  });
  const [touchedCustomFields, setTouchedCustomFields] = useState<Record<string, boolean>>({});
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicatePreviewPath, setDuplicatePreviewPath] = useState<string | null>(null);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const showFormError = useCallback((message: string, previewPath?: string | null) => {
    setError(message);
    setDuplicatePreviewPath(previewPath ?? null);
  }, []);
  const clearFormError = useCallback(() => {
    setError(null);
    setDuplicatePreviewPath(null);
  }, []);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedMeetingOption, setSelectedMeetingOption] = useState('');
  const { bookSeries, setBookSeries, showBookSeriesOption } = useBookSeriesOption({
    selectedType,
    enabled: !isRescheduleMode,
  });

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

  useEffect(() => {
    setVerificationToken(null);
  }, [phone, email]);

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
    loadingServices,
    providerScopedCatalogServices,
    loadingProviderScopedCatalog,
    providerScopedCatalogSettled,
    workspaceOwnerUserId,
    showProviderPicker,
    effectiveProviderId,
    intakeForm,
    generalSettings,
    workspaceOwnerAdminNotice,
    meetingOptions,
    bookingStepOrder,
    workspaceHostProfileHighlights,
    providerHostProfileHighlights,
  } = useEmbedBookingFormData({
    workspace,
    eventTypeSlug,
    fixedServiceProviderId: serviceProviderId,
    selectedDepartment,
    selectedProvider,
    selectedType,
    lockEventTypeCatalog: !!selectedType,
    days,
    intakeForm: undefined,
    onAvailabilityChange,
  });

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
  });

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    stepTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [current_step_id]);

  useEffect(() => {
    if (error) {
      stepTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [error, duplicatePreviewPath]);

  useEffect(() => {
    if (!serviceProviderId || selectedDepartment || loadingDepartments) return;
    if (departments.length === 1) {
      setSelectedDepartment(departments[0]);
    }
  }, [serviceProviderId, selectedDepartment, loadingDepartments, departments]);

  const event_type_before_department = is_event_type_before_department(step_order);

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
    if (serviceProviderId) {
      const match = serviceProviders.find((p) => p.id === serviceProviderId);
      if (match) {
        setSelectedProvider((prev) => (prev?.id === match.id ? prev : match));
        return;
      }
    }
    setSelectedProvider((prev) =>
      prev && serviceProviders.some((p) => p.id === prev.id) ? prev : null
    );
  }, [selectedDepartment, serviceProviders, serviceProviderId]);

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

  const sortedEventTypes = getSortedFilteredEventTypes(eventTypes, {
    slug: eventTypeSlug,
    duration: targetDuration,
  });

  const department_step_ready = department_step_is_ready(step_order, selectedType);

  const event_type_context_ready = event_type_step_is_ready(step_order, {
    departmentsCount: departments.length,
    hasSelectedDepartment: !!selectedDepartment,
    showProviderPicker,
    hasSelectedProvider: !!selectedProvider,
  });

  useAutoSelectSoleBookingOptions({
    enabled: !isRescheduleMode && !disableAutoAdvance && department_step_ready,
    autoSelectEventTypeEnabled:
      !isRescheduleMode && !disableAutoAdvance && event_type_context_ready,
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

  const serviceCatalogForSlots = useMemo(
    () => mergeServiceCatalogForDuration(providerScopedCatalogServices, services),
    [providerScopedCatalogServices, services]
  );

  const {
    customerTimezone: manualCustomerTz,
    setCustomerTimezone,
    context: locationCtx,
    hasManualTimezone,
    refresh: refreshLocation,
  } = useLocationContext({
    hostTimezone: generalSettings?.timezone,
  });

  const viewerTimezone = resolveCustomerTimezone(manualCustomerTz, locationCtx?.timezone);
  const providerTimezone = resolveProviderTimezone(generalSettings?.timezone, viewerTimezone);
  const workspaceTimezoneConfigured = isWorkspaceTimezoneConfigured(generalSettings?.timezone);

  const timeslots = useTimeslots(
    selectedType,
    selectedDate,
    availabilitySettings,
    existingBookings,
    isRescheduleMode ? 60 : 0,
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
    step3PerfSync('EmbedBookingForm handleSelectDate sync', t0);
  }, []);

  const handleSelectSlot = useCallback((slot: Timeslot) => {
    const t0 = performance.now();
    setSelectedTime(slot.time);
    setSelectedStartUtc(slot.startUtc);
    step3PerfSync('EmbedBookingForm handleSelectSlot sync', t0, {
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

  const bookableMeetingOptionKeys = useMemo(
    () =>
      list_bookable_meeting_option_keys(selectedType?.location_type, meetingOptions),
    [selectedType?.location_type, meetingOptions]
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
      isRescheduleMode,
      rescheduleContinueDisabled: loading,
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
      isRescheduleMode,
      loading,
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

  const workspaceAddress = useMemo(
    () =>
      format_workspace_public_address(
        (generalSettings ?? undefined) as Record<string, unknown> | undefined
      ),
    [generalSettings]
  );

  const workspacePrimaryColor = generalSettings?.primaryColor ?? DEFAULT_PRIMARY_COLOR;
  const workspaceAccentColor = generalSettings?.accentColor ?? null;

  // While a step with nothing to choose settles its sole option, show a loader
  // instead of flashing the step we are about to skip.
  const current_step_resolving =
    !isRescheduleMode &&
    !disableAutoAdvance &&
    is_booking_step_resolving(step_states, current_step_id);

  useAutoAdvanceSkippableBookingSteps({
    enabled: !isRescheduleMode && !disableAutoAdvance,
    current_step_id,
    step_order,
    step_states,
    go_to_step,
  });

  useEffect(() => {
    if (selectedType) {
      setSelectedDate(null);
      setSelectedTime('');
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
      return default_booking_meeting_option_key(bookableMeetingOptionKeys, meetingOptions) ?? '';
    });
  }, [selectedType?.id, bookableMeetingOptionKeys, meetingOptions]);

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

  // Reschedule mode: fetch original booking and extract event_type_id
  useEffect(() => {
    if (!rescheduleCode) return;
    const fetchOriginalBooking = async () => {
      try {
        const res = await fetch(`/api/booking-preview/${rescheduleCode}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.allow_customer_reschedule === false) {
          setRescheduleNotAllowed(true);
          setRescheduleReady(true);
          return;
        }
        const etId = json.booking?.event_type_id as string | null;
        if (etId) setRescheduleEventTypeId(etId);
        if (json.booking?.start_at) setPreviousStartAt(json.booking.start_at);
        if (json.booking?.end_at) setPreviousEndAt(json.booking.end_at);
        if (json.booking) {
          setRescheduleBookingMeta({
            id: json.booking.id as string | number | undefined,
            invitee_email:
              typeof json.booking.invitee_email === 'string'
                ? json.booking.invitee_email
                : null,
            invitee_phone:
              typeof json.booking.invitee_phone === 'string'
                ? json.booking.invitee_phone
                : null,
            contact_id:
              typeof json.booking.contact_id === 'number' ||
              typeof json.booking.contact_id === 'string'
                ? json.booking.contact_id
                : null,
          });
        }
        const intakeIds = intakeServiceIdsFromMetadata(json.booking?.metadata);
        if (intakeIds.length > 0) setSelectedServiceIds(intakeIds);
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
      go_to_step('date_time');
    }
  }, [isRescheduleMode, rescheduleReady, rescheduleEventTypeId, loadingEventTypes, eventTypes, selectedType]);

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

  const handleRescheduleConfirm = async () => {
    if (!selectedType || !selectedDate || !selectedTime || !rescheduleCode) {
      showFormError('Please select a date and time');
      return;
    }
    const selectedSlot = timeslots.find((s) =>
      selectedStartUtc ? s.startUtc === selectedStartUtc : s.time === selectedTime
    );
    if (selectedSlot?.disabled || !selectedSlot?.startUtc) {
      showFormError('This time slot is not available. Please select another time.');
      return;
    }

    setLoading(true);
    clearFormError();

    try {
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
        showFormError('Cannot reschedule to a time in the past.');
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
        showFormError('This time slot has already been booked. Please select another time.');
        setLoading(false);
        return;
      }

      if (rescheduleBookingMeta) {
        const duplicateError = find_client_duplicate_invitee_error(existingBookings, {
          start_at: startDate.toISOString(),
          timezone: viewerTimezone,
          event_type_id: selectedType.id,
          invitee: {
            invitee_email: rescheduleBookingMeta.invitee_email,
            invitee_phone: rescheduleBookingMeta.invitee_phone,
            contact_id: rescheduleBookingMeta.contact_id,
          },
          exclude_booking_id: rescheduleBookingMeta.id,
        });
        if (duplicateError) {
          apply_booking_form_error(setError, setDuplicatePreviewPath, duplicateError);
          setLoading(false);
          return;
        }
      }

      const res = await fetch('/api/embed/bookings/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          public_code: rescheduleCode,
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
          customer_timezone: viewerTimezone,
          provider_timezone: providerTimezone,
          timezone: viewerTimezone,
        }),
      });

      const result = await res.json();
      throw_if_booking_api_error(res, result, 'Failed to reschedule booking');
      if (result.preview_url) setPreviewUrl(result.preview_url);
      setConfirmed(true);
      go_to_step('success');
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

  const handleConfirmRequest = () => {
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
    if (!isRescheduleMode) {
      const phoneEnabled = intakeForm?.phone === true;
      const emailEnabled = intakeForm?.email !== false;
      if (!phoneEnabled || !emailEnabled) {
        showFormError(
          'Phone and email are required on this booking form before you can verify and confirm.'
        );
        return;
      }
      if (!verificationToken) {
        setOtpModalOpen(true);
        return;
      }
    }
    void handleConfirm(verificationToken);
  };

  const handleConfirm = async (activeVerificationToken: string | null = verificationToken) => {
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
    if (selectedSlot?.disabled || !selectedSlot?.startUtc) {
      showFormError('This time slot is not available. Please select another time.');
      return;
    }

    if (!isRescheduleMode && !activeVerificationToken) {
      setOtpModalOpen(true);
      return;
    }

    setLoading(true);
    clearFormError();

    try {
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
      if (sendWhatsapp) intakeFormPayload.whatsapp_opt_in = 'true';

      const meetingKey = effective_meeting_option_key(
        bookableMeetingOptionKeys,
        selectedMeetingOption
      );
      if (meetingKey) {
        intakeFormPayload.meeting_option = meetingKey;
      }

      if (files.length > 0 && intakeForm?.file_upload === true) {
        if (!validateFiles(files)) {
          setLoading(false);
          return;
        }
        const uploadedUrls: string[] = [];
        for (const uploadFile of files) {
          const uploadForm = new FormData();
          uploadForm.append('file', uploadFile);
          uploadForm.append('workspace_id', String(workspace.id));
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

      const service_provider_id =
        effectiveProviderId ??
        (departments.length === 0
          ? selectedProvider?.id ?? null
          : usesExplicitProviderPicker
            ? selectedProvider!.id
            : workspaceOwnerUserId ?? null);

      const res = await fetch('/api/embed/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspace.id,
          event_type_id: selectedType.id,
          ...(eventTypeSlug ? { event_type_slug: eventTypeSlug } : {}),
          service_provider_id,
          department_id: selectedDepartment?.id || null,
          invitee_name: inviteeName,
          invitee_email: emailEnabled ? (email.trim() || null) : null,
          invitee_phone: phoneEnabled ? inviteePhoneE164 : null,
          start_at: startDate.toISOString(),
          end_at: endDate.toISOString(),
          intake_form: Object.keys(intakeFormPayload).length > 0 ? intakeFormPayload : null,
          ...(meetingKey ? { location: { meeting_option: meetingKey } } : {}),
          customer_timezone: viewerTimezone,
          provider_timezone: providerTimezone,
          timezone: viewerTimezone,
          book_series: bookSeries,
          ...(!isRescheduleMode && activeVerificationToken
            ? { verification_token: activeVerificationToken }
            : {}),
        }),
      });

      const result = await res.json();
      throw_if_booking_api_error(res, result, 'Failed to create booking');
      if (result.preview_url) setPreviewUrl(result.preview_url);
      setConfirmed(true);
      go_to_step('success');
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

  const provider_admin_notice =
    typeof selectedProvider?.admin_notice === 'string' &&
    selectedProvider.admin_notice.trim() !== ''
      ? selectedProvider.admin_notice.trim()
      : null;
  const admin_notice = provider_admin_notice ?? workspaceOwnerAdminNotice;

  if (isRescheduleMode && rescheduleNotAllowed) {
    return (
      <div className="w-full max-w-2xl mx-auto px-6 py-12">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Reschedule not available</h2>
          <p className="mt-2 text-sm text-slate-600">
            Online rescheduling is disabled for this workspace. Please contact the business
            directly if you need to change your appointment.
          </p>
        </div>
      </div>
    );
  }

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
            workspaceTagline={generalSettings?.tagline}
            workspaceLogoUrl={workspace.logo_url ?? null}
            workspaceClinicImageUrl={generalSettings?.clinic_image_url ?? null}
            workspaceHostProfileHighlights={workspaceHostProfileHighlights}
            providerHostProfileHighlights={providerHostProfileHighlights}
            workspaceAddress={workspaceAddress}
            workspacePrimaryColor={workspacePrimaryColor}
            workspaceAccentColor={workspaceAccentColor}
            loadingSettings={false}
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
          <div ref={stepTopRef} className="scroll-mt-4 p-4 sm:p-6 lg:p-8 xl:p-10 bg-white relative">
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
                  onBack={
                    isRescheduleMode || !previous_step_id
                      ? undefined
                      : go_to_previous_step
                  }
                  onContinue={go_to_next_step}
                />
              )}
              {is_step('event_type') && !current_step_resolving && (
                <Step2ServiceSelection
                  eventTypes={sortedEventTypes}
                  selectedType={selectedType}
                  loadingEventTypes={loadingEventTypes}
                  onSelectType={setSelectedType}
                  onBack={
                    isRescheduleMode || !previous_step_id
                      ? undefined
                      : go_to_previous_step
                  }
                  onContinue={go_to_next_step}
                />
              )}
              {is_step('date_time') && (
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
                    onNavigateMonth={(dir) =>
                      setCurrentMonth((prev) => {
                        const next = new Date(prev);
                        next.setMonth(prev.getMonth() + (dir === 'next' ? 1 : -1));
                        return next;
                      })
                    }
                    onSetCurrentMonth={(d) => setCurrentMonth(new Date(d.getFullYear(), d.getMonth(), 1))}
                    onBack={isRescheduleMode || !previous_step_id ? undefined : () => {
                      go_to_previous_step();
                      setSelectedDate(null);
                      setSelectedTime('');
                    }}
                    onContinue={isRescheduleMode ? handleRescheduleConfirm : go_to_next_step}
                    continueLabel={isRescheduleMode ? (loading ? 'Rescheduling...' : 'Confirm Reschedule') : undefined}
                    continueDisabled={isRescheduleMode ? loading : undefined}
                    onDaysChange={setDays}
                    previousStartAt={isRescheduleMode ? previousStartAt : undefined}
                    previousEndAt={isRescheduleMode ? previousEndAt : undefined}
                    bookSeries={bookSeries}
                    onBookSeriesChange={setBookSeries}
                    showBookSeriesOption={showBookSeriesOption}
                    maxWindowDays={event_type_max_window_days(selectedType)}
                    allowAutoAdvance={!isRescheduleMode && !disableAutoAdvance}
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
                  profileCountry={locationCtx?.country ?? undefined}
                  onTouchedCustomField={(id) => setTouchedCustomFields((prev) => ({ ...prev, [id]: true }))}
                  files={files}
                  onFilesChange={handleFilesChange}
                  fileError={fileError}
                  onBack={go_to_previous_step}
                  onConfirm={handleConfirmRequest}
                  hideIntakeCatalogServices={hideIntakeCatalogServices}
                  enabledMeetingOptionKeys={bookableMeetingOptionKeys}
                  selectedMeetingOption={selectedMeetingOption}
                  onMeetingOptionChange={setSelectedMeetingOption}
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
      {!isRescheduleMode && (
        <EmbedBookingOtpModal
          open={otpModalOpen}
          workspaceId={workspace.id}
          name={name.trim() || email.trim() || 'Guest'}
          email={email.trim()}
          phone={phone.trim()}
          onClose={() => setOtpModalOpen(false)}
          onVerified={(token) => {
            setVerificationToken(token);
            setOtpModalOpen(false);
            void handleConfirm(token);
          }}
        />
      )}
    </div>
  );
}
