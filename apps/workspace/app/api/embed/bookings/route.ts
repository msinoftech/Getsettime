import crypto from 'crypto';
import { after } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';
import { verifyOTP, isOTPVerified } from '@/lib/otp-service';
import { findOrCreateContact } from '@/lib/contact-linking';
import { getLocalTimePartsInTimezone } from '@/lib/date-timezone';
import {
  resolveBookingTimezonesForInsert,
  resolveValidationTimezone,
} from '@/lib/booking-timezone-api';
import { run_post_booking_processing } from '@/lib/post_booking_processing';
import { resolve_booking_service_provider_name_snapshot } from '@/lib/booking_service_provider_phone';
import {
  list_bookable_meeting_option_keys,
} from '@/src/utils/meeting_options';
import { parse_location_meeting_option } from '@/src/utils/google_meet';
import { resolveAvailabilityForServiceProvider } from '@/src/utils/availabilityResolution';
import {
  resolveNotificationsForServiceProvider,
  resolveMeetingOptionsForServiceProvider,
} from '@/src/utils/providerSettingsResolution';
import {
  resolveEffectiveDurationForBookingRequest,
  validateBookingEndAt,
} from '@/lib/booking-effective-duration';
import { normalizeInviteePhoneForStorage } from '@/src/utils/phone';
import {
  fetchActiveDateExceptionsForSlot,
  validateSlotDateExceptions,
} from '@/src/utils/dateExceptionApiValidation';

type DayName = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

interface BreakTime {
  id: string;
  start: string;
  end: string;
}

interface DaySchedule {
  enabled: boolean;
  startTime: string;
  endTime: string;
  breaks: BreakTime[];
}

interface AvailabilitySettings {
  timesheet?: Record<DayName, DaySchedule>;
  individual?: Record<string, boolean>;
}

function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get('workspace_id');
    const date = searchParams.get('date') || '';
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';
    const serviceProviderId = searchParams.get('service_provider_id') || '';

    if (!workspaceId) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServerClient();
    
    // Build query
    let query = supabase
      .from('bookings')
      .select('id, start_at, end_at, status, service_provider_id')
      .eq('workspace_id', workspaceId)
      .order('start_at', { ascending: true });

    // Apply date filter if provided (fetch bookings for a specific date)
    if (date) {
      const dateObj = new Date(date);
      const startOfDay = new Date(dateObj);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(dateObj);
      endOfDay.setHours(23, 59, 59, 999);
      
      query = query
        .gte('start_at', startOfDay.toISOString())
        .lte('start_at', endOfDay.toISOString());
    }
    
    // Apply date range filter if provided (fetch bookings within a date range)
    // This is used for availability checking across multiple dates
    if (startDate && endDate) {
      const startDateObj = new Date(startDate);
      const startOfRange = new Date(startDateObj);
      startOfRange.setHours(0, 0, 0, 0);
      
      const endDateObj = new Date(endDate);
      const endOfRange = new Date(endDateObj);
      endOfRange.setHours(23, 59, 59, 999);
      
      query = query
        .gte('start_at', startOfRange.toISOString())
        .lte('start_at', endOfRange.toISOString());
    }

    // Apply service provider filter if provided
    if (serviceProviderId) {
      query = query.eq('service_provider_id', serviceProviderId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching bookings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter out cancelled bookings
    const activeBookings = (data || []).filter(
      (booking) => booking.status !== 'cancelled'
    );

    // Fetch Google Calendar busy slots for availability (when date or date range requested)
    let calendarBusy: { start_at: string; end_at: string }[] = [];
    if (workspaceId && (startDate || date)) {
      try {
        const { getBusySlots } = await import('@/lib/google-calendar-service');
        const rangeStart = startDate ? new Date(startDate) : new Date(date);
        const rangeEnd = endDate ? new Date(endDate) : new Date(date);
        rangeStart.setHours(0, 0, 0, 0);
        rangeEnd.setHours(23, 59, 59, 999);
        calendarBusy = await getBusySlots(
          Number(workspaceId),
          rangeStart.toISOString(),
          rangeEnd.toISOString(),
          serviceProviderId || undefined
        );
      } catch {
        // Non-blocking
      }
    }

    return NextResponse.json({ data: activeBookings, calendar_busy: calendarBusy });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      workspace_id,
      event_type_id,
      event_type_slug: event_type_slug_raw,
      service_provider_id,
      department_id,
      invitee_name,
      invitee_email,
      invitee_phone,
      start_at,
      end_at,
      otp_code,
      verified_identifier,
      intake_form,
      location,
    } = body;

    // Validate required fields
    if (!invitee_name || !invitee_name.trim()) {
      return NextResponse.json(
        { error: 'Invitee name is required' },
        { status: 400 }
      );
    }

    if (!start_at) {
      return NextResponse.json(
        { error: 'Start time is required' },
        { status: 400 }
      );
    }

    if (!workspace_id) {
      return NextResponse.json(
        { error: 'Workspace ID is required' },
        { status: 400 }
      );
    }

    const inviteePhoneNorm = normalizeInviteePhoneForStorage(invitee_phone);
    if (inviteePhoneNorm.invalid) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }
    const invitee_phone_e164 = inviteePhoneNorm.value;

    if (intake_form && typeof intake_form === 'object' && typeof intake_form.phone === 'string') {
      const intakePhoneNorm = normalizeInviteePhoneForStorage(intake_form.phone);
      if (intakePhoneNorm.invalid) {
        return NextResponse.json({ error: 'Invalid phone number in intake form' }, { status: 400 });
      }
      if (intakePhoneNorm.value) {
        (intake_form as Record<string, unknown>).phone = intakePhoneNorm.value;
      }
    }

    try {
      const supabaseAdmin = createSupabaseServerClient();
      const { assertBookingAllowed } = await import('@app/db/subscription');
      await assertBookingAllowed(supabaseAdmin, Number(workspace_id));
    } catch (planErr) {
      const { planLimitErrorResponse } = await import('@/lib/plan-limit-response');
      const planResp = planLimitErrorResponse(planErr);
      if (planResp) return planResp;
      throw planErr;
    }

    // Validate that the booking time is not in the past
    const startDate = new Date(start_at);
    const now = new Date();
    if (startDate < now) {
      return NextResponse.json({ 
        error: 'Cannot book a time slot in the past. Please select a future time.' 
      }, { status: 400 });
    }

    // Verify OTP if provided (optional for direct booking)
    if (otp_code && verified_identifier) {
      const identifier = verified_identifier.includes('@')
        ? normalizeEmail(verified_identifier)
        : normalizePhone(verified_identifier);

      const alreadyVerified = await isOTPVerified(identifier);
      let isValid = false;
      if (alreadyVerified) {
        isValid = await verifyOTP(identifier, otp_code, false);
      } else {
        isValid = await verifyOTP(identifier, otp_code, false);
      }

      if (!isValid) {
        return NextResponse.json(
          { error: 'Invalid or expired OTP code' },
          { status: 400 }
        );
      }

      const supabaseForOTP = createSupabaseServerClient();
      await supabaseForOTP
        .from('otp_verifications')
        .delete()
        .eq('identifier', identifier);
    }

    // Verify workspace exists
    const supabase = createSupabaseServerClient();
    const { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('id', workspace_id)
      .single();

    if (!workspace) {
      return NextResponse.json(
        { error: 'Workspace not found' },
        { status: 404 }
      );
    }

    const event_type_slug_from_body =
      typeof event_type_slug_raw === 'string' ? event_type_slug_raw.trim() : '';

    if (event_type_id) {
      const { data: event_type_access_row } = await supabase
        .from('event_types')
        .select('id, slug, is_public, status')
        .eq('id', event_type_id)
        .eq('workspace_id', workspace_id)
        .maybeSingle();

      if (!event_type_access_row) {
        return NextResponse.json(
          { error: 'Event type not found' },
          { status: 404 }
        );
      }

      if (event_type_access_row.status === 'draft') {
        return NextResponse.json(
          { error: 'Event type is not available for booking' },
          { status: 403 }
        );
      }

      const event_is_private = event_type_access_row.is_public !== true;
      const row_slug =
        typeof event_type_access_row.slug === 'string'
          ? event_type_access_row.slug.trim()
          : '';

      if (
        event_is_private &&
        (!row_slug || row_slug !== event_type_slug_from_body)
      ) {
        return NextResponse.json(
          { error: 'Private event type requires a valid direct link' },
          { status: 403 }
        );
      }
    }

    // Validate availability before creating booking (startDate already validated above)
    const effectiveDurationMinutes = await resolveEffectiveDurationForBookingRequest(
      supabase,
      workspace_id,
      event_type_id,
      intake_form && typeof intake_form === 'object' ? { intake_form } : null
    );
    const durationValidation = validateBookingEndAt(
      start_at,
      end_at,
      effectiveDurationMinutes
    );
    if (!durationValidation.ok) {
      return NextResponse.json({ error: durationValidation.message }, { status: 400 });
    }
    const resolvedEndAt = durationValidation.resolvedEndAt;
    const endDate = new Date(resolvedEndAt);

    // Fetch availability settings
    const { data: configData } = await supabase
      .from('configurations')
      .select('settings')
      .eq('workspace_id', workspace_id)
      .single();

    const bookingServiceProviderId =
      typeof service_provider_id === 'string' && service_provider_id.trim()
        ? service_provider_id.trim()
        : null;
    const availabilityData: AvailabilitySettings = configData?.settings?.availability || {};
    const availability = resolveAvailabilityForServiceProvider(
      availabilityData,
      bookingServiceProviderId
    );
    const resolvedNotifications = resolveNotificationsForServiceProvider(
      configData?.settings?.notifications as Record<string, unknown> | undefined,
      bookingServiceProviderId
    );
    const resolvedMeetingOptions = resolveMeetingOptionsForServiceProvider(
      configData?.settings?.meeting_options as Record<string, unknown> | undefined,
      bookingServiceProviderId
    );

    const workspaceTimezone =
      (configData?.settings as { general?: { timezone?: string } } | undefined)?.general
        ?.timezone ?? null;
    const tzFields = resolveBookingTimezonesForInsert(
      body as Record<string, unknown>,
      workspaceTimezone
    );

    const tz = resolveValidationTimezone(
      workspaceTimezone,
      tzFields.customer_timezone,
      tzFields.provider_timezone
    );
    const startParts = tz ? getLocalTimePartsInTimezone(start_at, tz) : null;
    const endParts = tz && end_at ? getLocalTimePartsInTimezone(end_at, tz) : null;

    const dayName: DayName = startParts
      ? (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][startParts.dayOfWeek] as DayName)
      : (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][startDate.getDay()] as DayName);
    const daySchedule = availability.timesheet?.[dayName];

    const startMinutes = startParts ? startParts.startMinutes : startDate.getHours() * 60 + startDate.getMinutes();
    const endMinutes = endParts ? endParts.startMinutes : endDate.getHours() * 60 + endDate.getMinutes();
    const dateStr = startParts ? startParts.dateStr : startDate.toISOString().split('T')[0];
    const timesheetStart = daySchedule
      ? parseInt(daySchedule.startTime.split(':')[0]) * 60 + parseInt(daySchedule.startTime.split(':')[1])
      : 9 * 60;
    const timesheetEnd = daySchedule
      ? parseInt(daySchedule.endTime.split(':')[0]) * 60 + parseInt(daySchedule.endTime.split(':')[1])
      : 17 * 60;

    const dateExceptions = await fetchActiveDateExceptionsForSlot(
      supabase,
      workspace_id,
      dateStr,
      bookingServiceProviderId
    );
    const exceptionValidation = validateSlotDateExceptions(
      dateExceptions,
      dateStr,
      bookingServiceProviderId,
      startMinutes,
      endMinutes,
      timesheetStart,
      timesheetEnd
    );

    if (exceptionValidation.blocked && exceptionValidation.error?.includes('closed')) {
      return NextResponse.json({ error: exceptionValidation.error }, { status: 400 });
    }
    
    if (!daySchedule || !daySchedule.enabled) {
      if (!exceptionValidation.allowDisabledDay) {
        return NextResponse.json({ 
          error: 'This time slot is not available. The selected day is not enabled in availability settings.' 
        }, { status: 400 });
      }
    }

    const scheduleStart = exceptionValidation.startMinutes ?? timesheetStart;
    const scheduleEnd = exceptionValidation.endMinutes ?? timesheetEnd;
    
    if (startMinutes < scheduleStart || endMinutes > scheduleEnd) {
      return NextResponse.json({ 
        error: 'This time slot is outside available hours.' 
      }, { status: 400 });
    }

    // Check if time conflicts with breaks
    if (daySchedule?.breaks && daySchedule.breaks.length > 0) {
      const conflictsWithBreak = daySchedule.breaks.some((breakTime) => {
        const breakStart = parseInt(breakTime.start.split(':')[0]) * 60 + parseInt(breakTime.start.split(':')[1]);
        const breakEnd = parseInt(breakTime.end.split(':')[0]) * 60 + parseInt(breakTime.end.split(':')[1]);
        return startMinutes < breakEnd && endMinutes > breakStart;
      });
      
      if (conflictsWithBreak) {
        return NextResponse.json({ 
          error: 'This time slot conflicts with a break time.' 
        }, { status: 400 });
      }
    }

    // Check individual overrides (format: YYYY-MM-DD-H)
    const slotHour = startParts ? startParts.hours : startDate.getHours();
    const individualKey = `${dateStr}-${slotHour}`;
    const individualOverride = availability.individual?.[individualKey];
    
    if (individualOverride === false) {
      return NextResponse.json({ 
        error: 'This time slot has been marked as unavailable.' 
      }, { status: 400 });
    }

    if (exceptionValidation.blocked) {
      return NextResponse.json({
        error: exceptionValidation.error || 'This time slot is blocked by an availability exception.',
      }, { status: 400 });
    }

    // Check Google Calendar for busy slots (if integrated)
    try {
      const { isSlotBusyInCalendar } = await import('@/lib/google-calendar-service');
      const endAt = resolvedEndAt;
      const isBusy = await isSlotBusyInCalendar(
        workspace_id,
        start_at,
        endAt,
        service_provider_id || undefined
      );
      if (isBusy) {
        return NextResponse.json({
          error: 'This time slot is already booked or blocked in calendar. Please select another time.',
        }, { status: 400 });
      }
    } catch (calErr) {
      console.warn('Google Calendar conflict check failed (non-blocking):', calErr);
    }

    // Check for existing booking conflicts for the same service provider
    // A booking conflicts if: new_start < existing_end AND new_end > existing_start
    let conflictQuery = supabase
      .from('bookings')
      .select('start_at, end_at')
      .eq('workspace_id', workspace_id)
      .neq('status', 'cancelled')
      .gte('start_at', new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).toISOString())
      .lte('start_at', new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1).toISOString());
    
    // Only check conflicts for the same service provider
    if (service_provider_id) {
      conflictQuery = conflictQuery.eq('service_provider_id', service_provider_id);
    }
    
    const { data: existingBookings } = await conflictQuery;

    if (existingBookings && existingBookings.length > 0) {
      const hasConflict = existingBookings.some((booking) => {
        const bookingStart = new Date(booking.start_at);
        const bookingEnd = booking.end_at ? new Date(booking.end_at) : new Date(bookingStart);
        return startDate < bookingEnd && endDate > bookingStart;
      });

      if (hasConflict) {
        return NextResponse.json({ 
          error: 'This time slot is already booked. Please select another time.' 
        }, { status: 400 });
      }
    }

    // Check auto-confirm setting (reuse configData from availability check)
    let bookingStatus = 'pending';
    const autoConfirm = resolvedNotifications['auto-confirm-booking'];
    if (autoConfirm === true) {
      bookingStatus = 'confirmed';
    }

    // Prepare metadata with intake_form and notes for backward compatibility
    const metadataPayload: Record<string, unknown> = {
      source: 'embed',
      verified_phone: invitee_phone_e164,
      verified_email: invitee_email ? normalizeEmail(invitee_email) : null,
    };

    // Add intake_form if provided
    if (intake_form && typeof intake_form === 'object') {
      metadataPayload.intake_form = intake_form;
      
      // Preserve notes for backward compatibility with email templates
      if (intake_form.additional_description) {
        metadataPayload.notes = intake_form.additional_description;
      }
    }

    const contactId = await findOrCreateContact(
      supabase,
      workspace_id,
      invitee_name?.trim() ?? '',
      invitee_email?.trim() || null,
      invitee_phone_e164
    );

    const publicCode = crypto.randomUUID();

    let eventTypeLocationType: string | null = null;
    if (event_type_id) {
      const { data: eventTypeRow } = await supabase
        .from('event_types')
        .select('location_type')
        .eq('id', event_type_id)
        .eq('workspace_id', workspace_id)
        .maybeSingle();
      eventTypeLocationType =
        typeof eventTypeRow?.location_type === 'string' ? eventTypeRow.location_type : null;
    }

    const bookableMeetingKeys = list_bookable_meeting_option_keys(
      eventTypeLocationType,
      resolvedMeetingOptions
    );

    let locationForInsert: Record<string, unknown> | null = null;
    if (location !== undefined && location !== null) {
      const mo = parse_location_meeting_option(location);
      if (mo === null) {
        return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
      }
      if (!bookableMeetingKeys.includes(mo)) {
        return NextResponse.json(
          { error: 'Meeting option is not available for this event type' },
          { status: 400 }
        );
      }
      locationForInsert = { meeting_option: mo };
    }

    const serviceProviderNameSnapshot =
      await resolve_booking_service_provider_name_snapshot(
        supabase,
        supabase,
        workspace_id,
        service_provider_id || null
      );

    // Create booking with embed source
    let { data, error } = await supabase
      .from('bookings')
      .insert({
        workspace_id,
        event_type_id: event_type_id || null,
        service_provider_id: service_provider_id || null,
        service_provider_name: serviceProviderNameSnapshot,
        department_id: department_id || null,
        host_user_id: null,
        invitee_name: invitee_name.trim(),
        invitee_email: invitee_email?.trim() || null,
        invitee_phone: invitee_phone_e164,
        contact_id: contactId ?? null,
        start_at,
        end_at: resolvedEndAt || null,
        customer_timezone: tzFields.customer_timezone,
        provider_timezone: tzFields.provider_timezone,
        status: bookingStatus,
        location: locationForInsert,
        payment_id: null,
        metadata: metadataPayload,
        public_code: publicCode,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating embed booking:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    const origin = new URL(req.url).origin;
    const whatsappOptIn = Boolean(
      intake_form &&
        typeof intake_form === 'object' &&
        (intake_form as Record<string, unknown>).whatsapp_opt_in
    );

    after(async () => {
      try {
        await run_post_booking_processing({
          origin,
          booking: data,
          workspace_id,
          event_type_id: event_type_id || null,
          service_provider_id: service_provider_id || null,
          department_id: department_id || null,
          invitee_name: invitee_name.trim(),
          invitee_email: invitee_email?.trim() || null,
          invitee_phone_e164,
          start_at,
          resolved_end_at: resolvedEndAt,
          duration_minutes: effectiveDurationMinutes,
          booking_location: locationForInsert,
          calendar_location: location,
          metadata: metadataPayload,
          notes: metadataPayload.notes ? String(metadataPayload.notes) : undefined,
          whatsapp_opt_in: whatsappOptIn,
          tz_fields: tzFields,
          resolved_notifications: resolvedNotifications,
          supabase_client: supabase,
        });
      } catch (postBookingErr) {
        console.error('Post-booking processing failed (embed):', postBookingErr);
      }
    });

    return NextResponse.json({
      data,
      preview_url: `/booking-preview/${data.public_code}`,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}

