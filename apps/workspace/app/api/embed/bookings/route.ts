import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';
import { verifyOTP, isOTPVerified } from '@/lib/otp-service';
import { findOrCreateContact } from '@/lib/contact-linking';
import { getLocalTimePartsInTimezone } from '@/lib/date-timezone';

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
          rangeEnd.toISOString()
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
      timezone: clientTimezone,
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

    // Validate availability before creating booking (startDate already validated above)
    const endDate = end_at ? new Date(end_at) : new Date(startDate);
    
    // Fetch availability settings
    const { data: configData } = await supabase
      .from('configurations')
      .select('settings')
      .eq('workspace_id', workspace_id)
      .single();

    const availabilityData: AvailabilitySettings = configData?.settings?.availability || {};
    
    // Get provider-specific availability if service_provider_id is provided
    let availability: AvailabilitySettings = availabilityData;
    if (service_provider_id && availabilityData) {
      const providers = (availabilityData as any).providers || {};
      const providerOverrides = providers[service_provider_id] || {};
      
      // Merge general availability with provider-specific overrides
      const generalTimesheet = availabilityData.timesheet;
      const generalIndividual = availabilityData.individual;
      const finalTimesheet = generalTimesheet ? { ...generalTimesheet, ...(providerOverrides.timesheet || {}) } : providerOverrides.timesheet;
      const finalIndividual = { ...(generalIndividual || {}), ...(providerOverrides.individual || {}) };
      
      availability = {
        timesheet: finalTimesheet,
        individual: finalIndividual,
      };
    }
    
    // Use timezone-aware parsing when client sends timezone (fixes Vercel UTC vs local mismatch)
    const tz = typeof clientTimezone === 'string' && clientTimezone.trim() ? clientTimezone.trim() : null;
    const startParts = tz ? getLocalTimePartsInTimezone(start_at, tz) : null;
    const endParts = tz && end_at ? getLocalTimePartsInTimezone(end_at, tz) : null;

    const dayName: DayName = startParts
      ? (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][startParts.dayOfWeek] as DayName)
      : (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][startDate.getDay()] as DayName);
    const daySchedule = availability.timesheet?.[dayName];
    
    if (!daySchedule || !daySchedule.enabled) {
      return NextResponse.json({ 
        error: 'This time slot is not available. The selected day is not enabled in availability settings.' 
      }, { status: 400 });
    }

    const startMinutes = startParts ? startParts.startMinutes : startDate.getHours() * 60 + startDate.getMinutes();
    const endMinutes = endParts ? endParts.startMinutes : endDate.getHours() * 60 + endDate.getMinutes();
    const scheduleStart = parseInt(daySchedule.startTime.split(':')[0]) * 60 + parseInt(daySchedule.startTime.split(':')[1]);
    const scheduleEnd = parseInt(daySchedule.endTime.split(':')[0]) * 60 + parseInt(daySchedule.endTime.split(':')[1]);
    
    if (startMinutes < scheduleStart || endMinutes > scheduleEnd) {
      return NextResponse.json({ 
        error: 'This time slot is outside available hours.' 
      }, { status: 400 });
    }

    // Check if time conflicts with breaks
    if (daySchedule.breaks && daySchedule.breaks.length > 0) {
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
    const dateStr = startParts ? startParts.dateStr : startDate.toISOString().split('T')[0];
    const slotHour = startParts ? startParts.hours : startDate.getHours();
    const individualKey = `${dateStr}-${slotHour}`;
    const individualOverride = availability.individual?.[individualKey];
    
    if (individualOverride === false) {
      return NextResponse.json({ 
        error: 'This time slot has been marked as unavailable.' 
      }, { status: 400 });
    }

    // Check Google Calendar for busy slots (if integrated)
    try {
      const { isSlotBusyInCalendar } = await import('@/lib/google-calendar-service');
      const endAt = end_at || start_at;
      const isBusy = await isSlotBusyInCalendar(workspace_id, start_at, endAt);
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
    const autoConfirm = configData?.settings?.notifications?.['auto-confirm-booking'];
    if (autoConfirm === true) {
      bookingStatus = 'confirmed';
    }

    // Prepare metadata with intake_form and notes for backward compatibility
    const metadataPayload: Record<string, unknown> = {
      source: 'embed',
      verified_phone: invitee_phone ? normalizePhone(invitee_phone) : null,
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
      invitee_phone?.trim() || null
    );

    // Create booking with embed source
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        workspace_id,
        event_type_id: event_type_id || null,
        service_provider_id: service_provider_id || null,
        department_id: department_id || null,
        host_user_id: null, // Embed bookings don't have a host user
        invitee_name: invitee_name.trim(),
        invitee_email: invitee_email?.trim() || null,
        invitee_phone: invitee_phone?.trim() || null,
        contact_id: contactId ?? null,
        start_at,
        end_at: end_at || null,
        status: bookingStatus,
        location: null,
        payment_id: null,
        metadata: metadataPayload,
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

    // Build notification context (names may be missing; fall back to "Not assigned")
    let providerEmail: string | undefined;
    let providerName: string | undefined;
    let departmentName: string | undefined;
    let eventTypeName = 'Appointment';
    let durationMinutes = 30;

    try {
      if (event_type_id) {
        const { data: eventTypeData } = await supabase
          .from('event_types')
          .select('title, duration_minutes')
          .eq('id', event_type_id)
          .single();

        if (eventTypeData) {
          eventTypeName = eventTypeData.title || eventTypeName;
          durationMinutes = eventTypeData.duration_minutes || durationMinutes;
        }
      }
    } catch (eventTypeErr) {
      console.error('Error fetching event type details:', eventTypeErr);
    }

    try {
      if (department_id) {
        const { data: departmentData } = await supabase
          .from('departments')
          .select('name')
          .eq('id', department_id)
          .single();
        departmentName = departmentData?.name || undefined;
      }
    } catch (deptErr) {
      console.error('Error fetching department details:', deptErr);
    }

    try {
      if (service_provider_id) {
        const supabaseServiceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
        if (!supabaseServiceRoleKey) {
          console.warn('Service role key not configured, cannot fetch provider details for notifications');
        } else {
          const { createClient } = await import('@supabase/supabase-js');
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
          const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
            auth: { autoRefreshToken: false, persistSession: false },
          });

          const { data: { user: providerUser }, error: providerError } =
            await adminClient.auth.admin.getUserById(service_provider_id);

          if (providerError) {
            console.error('Error fetching service provider:', providerError);
          } else if (providerUser) {
            providerEmail = providerUser.email || undefined;
            providerName = providerUser.user_metadata?.name || providerUser.email?.split('@')[0] || 'Service Provider';
          }
        }
      }
    } catch (providerErr) {
      console.error('Error resolving provider details:', providerErr);
    }

    const providerLabel = providerName?.trim() ? providerName : (service_provider_id ? 'Assigned (details unavailable)' : 'Not assigned');
    const departmentLabel = departmentName?.trim() ? departmentName : (department_id ? 'Assigned (details unavailable)' : 'Not assigned');

    // Send email notifications after successful booking creation (best-effort)
    try {
      if (invitee_email && invitee_email.trim()) {
        const { sendBookingConfirmationEmails } = await import('@/lib/email-service');

        const emailData = {
          inviteeName: invitee_name.trim(),
          inviteeEmail: invitee_email.trim(),
          providerName: providerLabel,
          providerEmail: providerEmail,
          eventTypeName,
          departmentName: departmentLabel,
          startTime: start_at,
          endTime: end_at || start_at,
          duration: durationMinutes,
          notes: metadataPayload.notes ? String(metadataPayload.notes) : undefined,
          ...(clientTimezone ? { timezone: clientTimezone } : {}),
        };

        const emailResult = await sendBookingConfirmationEmails(emailData);
        console.log('Email notifications:', {
          userEmailSent: emailResult.userEmailSent,
          providerEmailSent: emailResult.providerEmailSent,
          errors: emailResult.errors,
        });
      }
    } catch (emailError) {
      console.error('Error sending email notifications:', emailError);
    }

    // Send WhatsApp notification (best-effort; don't fail booking)
    try {
      if (invitee_phone && invitee_phone.trim()) {
        const origin = new URL(req.url).origin;
        const whenOpts: Intl.DateTimeFormatOptions = {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
          ...(clientTimezone?.trim() && { timeZone: clientTimezone.trim() }),
        };
        const when = new Date(start_at).toLocaleString('en-US', whenOpts);

        const message = [
          'Booking confirmed' + ' ' + `Event: ${eventTypeName}` + ' ' + `Department: ${departmentLabel}` + ' ' + `Service Provider: ${providerLabel}` + ' ' + `When: ${when}` + ' ' + (metadataPayload.notes ? `Notes: ${String(metadataPayload.notes)}` : ''),
        ]
          .filter((s) => s && String(s).trim().length > 0)
          .join('\n');

        await fetch(`${origin}/api/whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: invitee_name?.trim() || 'Invitee',
            email: invitee_email?.trim() || null,
            phone: invitee_phone?.trim(),
            message,
          }),
        }).catch((whatsappError) => {
          console.error('Error sending WhatsApp notification:', whatsappError);
        });
      }
    } catch (whatsappError) {
      console.error('Error sending WhatsApp notification:', whatsappError);
    }

    // Sync to Google Calendar (best-effort)
    try {
      const { createCalendarEvent } = await import('@/lib/google-calendar-service');
      const endAt = end_at || start_at;
      const { eventId } = await createCalendarEvent({
        workspaceId: workspace_id,
        summary: `${eventTypeName}: ${invitee_name.trim()}`,
        description: metadataPayload.notes ? String(metadataPayload.notes) : undefined,
        startAt: start_at,
        endAt,
        attendeeEmail: invitee_email?.trim() || undefined,
        metadata: { bookingId: data?.id, eventTypeName },
      });
      if (eventId && data?.metadata && typeof data.metadata === 'object') {
        await supabase
          .from('bookings')
          .update({ metadata: { ...(data.metadata as object), google_calendar_event_id: eventId } })
          .eq('id', data.id);
      }
    } catch (calErr) {
      console.warn('Google Calendar sync failed (non-blocking):', calErr);
    }

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}

