import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { findOrCreateContact } from '@/lib/contact-linking';
import { getLocalTimePartsInTimezone } from '@/lib/date-timezone';
import { appendActivityLog } from '@/lib/activity-log';
import {
  admin_whatsapp_phones_for_booking,
  resolve_provider_notification_contact,
  sole_workspace_department_display_name,
} from '@/lib/booking_service_provider_phone';
import { post_booking_whatsapp_notification } from '@/lib/post_booking_whatsapp_notification';

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

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || null;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    // Create client with user's JWT token - this respects RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const workspaceId = user.user_metadata?.workspace_id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const search = searchParams.get('search') || '';
    const date = searchParams.get('date') || '';
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';
    const status = searchParams.get('status') || '';
    const eventTypeId = searchParams.get('event_type_id') || '';
    const serviceProviderId = searchParams.get('service_provider_id') || '';
    const departmentId = searchParams.get('department_id') || '';
    const sortBy = searchParams.get('sort') || 'start_at';
    const offset = (page - 1) * limit;
    
    const now = new Date().toISOString();
    const orderColumn = sortBy === 'latest' || sortBy === 'new' ? 'created_at' : 'start_at';
    const ascending = sortBy === 'upcoming';

    // Build query with search filter, event_types and contacts join
    let query = supabase
      .from('bookings')
      .select('*, event_types(title, duration_minutes), contacts(name, phone, email)', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order(orderColumn, { ascending });

    if (sortBy === 'upcoming') {
      query = query.gte('start_at', now);
    }
    if (sortBy === 'past') {
      query = query.lt('start_at', now);
    }
    if (sortBy === 'new') {
      query = query.or(
        'is_viewed.eq.false,and(is_reschedule_viewed.eq.false,status.eq.reschedule)'
      );
    }

    // Apply search filter if provided
    if (search.trim()) {
      query = query.ilike('invitee_name', `%${search.trim()}%`);
    }

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

    // Apply status filter if provided
    if (status.trim()) {
      query = query.eq('status', status.trim());
    }

    // Apply event type filter if provided
    if (eventTypeId.trim()) {
      query = query.eq('event_type_id', eventTypeId.trim());
    }

    // Apply service provider filter if provided
    if (serviceProviderId.trim()) {
      query = query.eq('service_provider_id', serviceProviderId.trim());
    }

    // Apply department filter if provided
    if (departmentId.trim()) {
      query = query.eq('department_id', departmentId.trim());
    }

    // Apply pagination only if not fetching for date range availability
    // Date range queries (used for availability checking) should return all bookings without pagination
    let data, error, count;
    if (startDate && endDate) {
      // Skip pagination for date range queries (availability checking)
      const result = await query;
      data = result.data;
      error = result.error;
      count = result.data?.length || 0;
    } else {
      // Apply pagination for standard queries
      const result = await query.range(offset, offset + limit - 1);
      data = result.data;
      error = result.error;
      count = result.count;
    }

    if (error) {
      console.error('Error fetching bookings:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch Google Calendar busy slots when date range requested (for availability)
    let calendarBusy: { start_at: string; end_at: string }[] = [];
    if (startDate && endDate && workspaceId) {
      try {
        const { getBusySlots } = await import('@/lib/google-calendar-service');
        const startOfRange = new Date(startDate);
        startOfRange.setHours(0, 0, 0, 0);
        const endOfRange = new Date(endDate);
        endOfRange.setHours(23, 59, 59, 999);
        calendarBusy = await getBusySlots(
          Number(workspaceId),
          startOfRange.toISOString(),
          endOfRange.toISOString()
        );
      } catch {
        // Non-blocking
      }
    }

    return NextResponse.json({
      data: data || [],
      calendar_busy: calendarBusy,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || null;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    // Create client with user's JWT token - this respects RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    let cachedServiceRoleClient: ReturnType<typeof createClient> | null | undefined;
    const getServiceRoleClient = (): ReturnType<typeof createClient> | null => {
      if (cachedServiceRoleClient !== undefined) {
        return cachedServiceRoleClient;
      }
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) {
        cachedServiceRoleClient = null;
        return null;
      }
      cachedServiceRoleClient = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      return cachedServiceRoleClient;
    };

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      event_type_id,
      service_provider_id,
      department_id,
      invitee_name,
      invitee_email,
      invitee_phone,
      start_at,
      end_at,
      status,
      location,
      payment_id,
      metadata,
      timezone: clientTimezone,
    } = body;

    if (!invitee_name || !invitee_name.trim()) {
      return NextResponse.json({ error: 'Invitee name is required' }, { status: 400 });
    }

    if (!start_at) {
      return NextResponse.json({ error: 'Start time is required' }, { status: 400 });
    }

    const workspaceId = user.user_metadata?.workspace_id;
    const hostUserId = user.id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    // Validate availability before creating booking
    const startDate = new Date(start_at);
    const endDate = end_at ? new Date(end_at) : new Date(startDate);

    // Validate that the booking time is not in the past
    const now = new Date();
    if (startDate < now) {
      return NextResponse.json({ 
        error: 'Cannot book a time slot in the past. Please select a future time.' 
      }, { status: 400 });
    }
    
    // Fetch availability settings
    const { data: configData } = await supabase
      .from('configurations')
      .select('settings')
      .eq('workspace_id', workspaceId)
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
      const isBusy = await isSlotBusyInCalendar(Number(workspaceId), start_at, end_at || start_at);
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
      .eq('workspace_id', workspaceId)
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

    const contactId = await findOrCreateContact(
      supabase,
      workspaceId,
      invitee_name?.trim() ?? '',
      invitee_email?.trim() || null,
      invitee_phone?.trim() || null
    );

    const publicCode = crypto.randomUUID();

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        workspace_id: workspaceId,
        event_type_id: event_type_id || null,
        service_provider_id: service_provider_id || null,
        department_id: department_id || null,
        host_user_id: hostUserId,
        invitee_name: invitee_name.trim(),
        invitee_email: invitee_email?.trim() || null,
        invitee_phone: invitee_phone?.trim() || null,
        contact_id: contactId ?? null,
        start_at: start_at,
        end_at: end_at || null,
        status: status || 'pending',
        location: location || null,
        payment_id: payment_id || null,
        metadata: metadata || null,
        public_code: publicCode,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating booking:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build notification context (omit department/provider in emails when not set).
    // Match embed: service-role reads avoid RLS gaps on workspaces/departments/event_types for JWT clients.
    let providerEmail: string | undefined;
    let providerName: string | undefined;
    let departmentName: string | undefined;
    let eventTypeName = 'Appointment';
    let durationMinutes = 30;
    let arriveEarlyMin = 10;
    let arriveEarlyMax = 15;

    const notifyAdminClient = getServiceRoleClient();
    const notifyDb = notifyAdminClient ?? supabase;

    try {
      if (event_type_id) {
        const { data: eventTypeData } = await notifyDb
          .from('event_types')
          .select('title, duration_minutes, buffer_before, buffer_after')
          .eq('id', event_type_id)
          .eq('workspace_id', workspaceId)
          .single();

        if (eventTypeData) {
          eventTypeName = eventTypeData.title || eventTypeName;
          durationMinutes = eventTypeData.duration_minutes || durationMinutes;
          arriveEarlyMin = Number(eventTypeData.buffer_before ?? arriveEarlyMin);
          arriveEarlyMax = Number(eventTypeData.buffer_after ?? arriveEarlyMax);

        }
      }
    } catch (eventTypeErr) {
      console.error('Error fetching event type details:', eventTypeErr);
    }

    try {
      if (department_id) {
        const { data: departmentData } = await notifyDb
          .from('departments')
          .select('name')
          .eq('id', department_id)
          .eq('workspace_id', workspaceId)
          .single();
        departmentName = departmentData?.name || undefined;
      }
    } catch (deptErr) {
      console.error('Error fetching department details:', deptErr);
    }

    if (!departmentName?.trim()) {
      try {
        const sole = await sole_workspace_department_display_name(
          notifyDb,
          workspaceId
        );
        if (sole) departmentName = sole;
      } catch (soleDeptErr) {
        console.error('Error resolving sole department name:', soleDeptErr);
      }
    }

    try {
      if (!notifyAdminClient) {
        console.warn('Service role key not configured, cannot fetch provider details for notifications');
      } else {
        const resolved = await resolve_provider_notification_contact(
          notifyAdminClient,
          notifyAdminClient,
          String(workspaceId),
          service_provider_id || null
        );
        providerEmail = resolved.email;
        providerName = resolved.provider_name;
      }
    } catch (providerErr) {
      console.error('Error resolving provider details:', providerErr);
    }

    // Send email notifications after successful booking creation (best-effort)
    try {
      if (invitee_email && invitee_email.trim()) {
        const { sendBookingConfirmationEmails } = await import('@/lib/email-service');

        const emailData = {
          inviteeName: invitee_name.trim(),
          inviteeEmail: invitee_email.trim(),
          ...(providerName?.trim() ? { providerName: providerName.trim() } : {}),
          providerEmail: providerEmail,
          eventTypeName,
          ...(departmentName?.trim() ? { departmentName: departmentName.trim() } : {}),
          startTime: start_at,
          endTime: end_at || start_at,
          duration: durationMinutes,
          notes: metadata?.notes || undefined,
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
    // metadata.whatsapp_opt_in controls messages to the user (invitee),
    // notifications.whatsapp (whatsappEnabled) controls messages to admins.
    const whatsappEnabled = configData?.settings?.notifications?.whatsapp === true;

    let admin_whatsapp_phones: string[] = [];
    if (whatsappEnabled && data?.id && workspaceId && notifyAdminClient) {
      try {
        admin_whatsapp_phones = await admin_whatsapp_phones_for_booking(
          supabase,
          data.id,
          {
            workspace_id: String(workspaceId),
            admin_supabase: notifyAdminClient,
          }
        );
      } catch (resolveAdminPhoneErr) {
        console.warn(
          'Could not resolve host phone for WhatsApp admin notification:',
          resolveAdminPhoneErr
        );
      }
    }

    try {
      if (invitee_phone && invitee_phone.trim() && (metadata?.whatsapp_opt_in || whatsappEnabled)) {
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

        const whatsappParts = [
          'Booking confirmed',
          `Event: ${eventTypeName}`,
          ...(departmentName?.trim() ? [`Department: ${departmentName.trim()}`] : []),
          ...(providerName?.trim() ? [`Service Provider: ${providerName.trim()}`] : []),
          `When: ${when}`,
          ...(metadata?.notes ? [`Notes: ${String(metadata.notes)}`] : []),
        ];
        const message = whatsappParts.join(' ');

        await post_booking_whatsapp_notification(origin, {
          name: invitee_name?.trim() || 'Invitee',
          email: invitee_email?.trim() || null,
          phone: invitee_phone?.trim() || '',
          message,
          service: eventTypeName,
          ...(departmentName?.trim() ? { department: departmentName.trim() } : {}),
          ...(providerName?.trim() ? { provider: providerName.trim() } : {}),
          start: start_at,
          end: end_at || start_at,
          note: metadata?.notes ? String(metadata.notes) : '',
          arrive_early_min: arriveEarlyMin,
          arrive_early_max: arriveEarlyMax,
          booking_reference: data?.public_code || data?.id || '',
          send_to_user: Boolean(metadata?.whatsapp_opt_in),
          send_to_admin: whatsappEnabled,
          admin_phone: admin_whatsapp_phones,
          skip_contact_form_email: true,
        });
      }
    } catch (whatsappError) {
      console.error('Error sending WhatsApp notification:', whatsappError);
    }

    // Sync to Google Calendar (best-effort)
    try {
      const { createCalendarEvent } = await import('@/lib/google-calendar-service');
      const { eventId } = await createCalendarEvent({
        workspaceId,
        summary: `${eventTypeName}: ${invitee_name.trim()}`,
        description: metadata?.notes ? String(metadata.notes) : undefined,
        startAt: start_at,
        endAt: end_at || start_at,
        location: location || undefined,
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

    await appendActivityLog(workspaceId, {
      type: 'booking',
      action: 'created',
      title: 'Booking created',
      description: `${data?.invitee_name || invitee_name.trim()} (${data?.status || status || 'pending'})`,
    });

    return NextResponse.json({
      data,
      preview_url: `/booking-preview/${data.public_code}`,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || null;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    // Create client with user's JWT token - this respects RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let cachedPatchServiceRole: ReturnType<typeof createClient> | null | undefined;
    const getPatchServiceRoleClient = (): ReturnType<typeof createClient> | null => {
      if (cachedPatchServiceRole !== undefined) {
        return cachedPatchServiceRole;
      }
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!serviceKey) {
        cachedPatchServiceRole = null;
        return null;
      }
      cachedPatchServiceRole = createClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      return cachedPatchServiceRole;
    };

    const body = await req.json();
    const {
      id,
      event_type_id,
      service_provider_id,
      department_id,
      invitee_name,
      invitee_email,
      invitee_phone,
      start_at,
      end_at,
      status,
      location,
      payment_id,
      metadata,
      is_viewed,
      is_reschedule_viewed,
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    const workspaceId = user.user_metadata?.workspace_id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const { data: existingRow, error: existingError } = await supabase
      .from('bookings')
      .select(
        'start_at, end_at, status, invitee_name, invitee_email, invitee_phone, event_type_id, service_provider_id, department_id, metadata, public_code'
      )
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single();

    if (existingError || !existingRow) {
      return NextResponse.json({ error: 'Booking not found or access denied' }, { status: 404 });
    }

    const nextStatusRaw = status !== undefined ? status : existingRow.status;
    const nextIsRescheduleStatus =
      String(nextStatusRaw ?? '').toLowerCase() === 'reschedule';

    const updateData: Record<string, unknown> = {};
    if (event_type_id !== undefined) updateData.event_type_id = event_type_id || null;
    if (service_provider_id !== undefined) updateData.service_provider_id = service_provider_id || null;
    if (department_id !== undefined) updateData.department_id = department_id || null;
    if (invitee_name !== undefined) updateData.invitee_name = invitee_name?.trim() || null;
    if (invitee_email !== undefined) updateData.invitee_email = invitee_email?.trim() || null;
    if (invitee_phone !== undefined) updateData.invitee_phone = invitee_phone?.trim() || null;
    if (start_at !== undefined) updateData.start_at = start_at;
    if (end_at !== undefined) updateData.end_at = end_at || null;
    if (status !== undefined) updateData.status = status;
    if (location !== undefined) updateData.location = location || null;
    if (payment_id !== undefined) updateData.payment_id = payment_id || null;
    if (metadata !== undefined) updateData.metadata = metadata || null;
    if (is_viewed !== undefined) updateData.is_viewed = is_viewed;
    if (is_reschedule_viewed !== undefined) {
      updateData.is_reschedule_viewed = is_reschedule_viewed;
    }

    const normEnd = (v: string | null | undefined) => v ?? null;
    const startChanged =
      start_at !== undefined && start_at !== existingRow.start_at;
    const endChanged =
      end_at !== undefined &&
      normEnd(end_at) !== normEnd(existingRow.end_at);
    const timeChanged = startChanged || endChanged;
    if (timeChanged && nextIsRescheduleStatus) {
      updateData.is_reschedule_viewed = false;
    }

    const { data, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) {
      console.error('Error updating booking:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Booking not found or access denied' }, { status: 404 });
    }

    const finalIsReschedule =
      String(data?.status ?? '').toLowerCase() === 'reschedule';
    const shouldSendRescheduleEmails = timeChanged && finalIsReschedule;

    if (shouldSendRescheduleEmails) {
      try {
        let providerEmail: string | undefined;
        let providerName: string | undefined;
        let departmentName: string | undefined;
        let eventTypeName = 'Appointment';
        let durationMinutes = 30;
        let arriveEarlyMin = 10;
        let arriveEarlyMax = 15;

        const patchNotifyAdmin = getPatchServiceRoleClient();
        const patchNotifyDb = patchNotifyAdmin ?? supabase;

        if (data.event_type_id) {
          const { data: et } = await patchNotifyDb
            .from('event_types')
            .select('title, duration_minutes, buffer_before, buffer_after')
            .eq('id', data.event_type_id)
            .eq('workspace_id', workspaceId)
            .single();
          if (et) {
            eventTypeName = et.title || eventTypeName;
            durationMinutes = et.duration_minutes || durationMinutes;
            arriveEarlyMin = Number(et.buffer_before ?? arriveEarlyMin);
            arriveEarlyMax = Number(et.buffer_after ?? arriveEarlyMax);
          }
        }

        if (data.department_id) {
          const { data: dept } = await patchNotifyDb
            .from('departments')
            .select('name')
            .eq('id', data.department_id)
            .eq('workspace_id', workspaceId)
            .single();
          departmentName = dept?.name || undefined;
        }

        if (!departmentName?.trim()) {
          try {
            const sole = await sole_workspace_department_display_name(
              patchNotifyDb,
              workspaceId
            );
            if (sole) departmentName = sole;
          } catch (soleDeptErr) {
            console.error(
              'Error resolving sole department name (dashboard reschedule):',
              soleDeptErr
            );
          }
        }

        if (patchNotifyAdmin) {
          const resolved = await resolve_provider_notification_contact(
            patchNotifyAdmin,
            patchNotifyAdmin,
            String(workspaceId),
            data.service_provider_id || null
          );
          providerEmail = resolved.email;
          providerName = resolved.provider_name;
        } else {
          console.warn(
            'Service role key not configured, cannot fetch provider details for reschedule notifications'
          );
        }

        const prevStart = existingRow.start_at ?? undefined;
        const prevEnd = existingRow.end_at ?? undefined;
        const newStart = data.start_at ?? prevStart;
        const newEnd = data.end_at ?? prevEnd ?? newStart;

        const { sendBookingRescheduleEmails } = await import('@/lib/email-service');
        await sendBookingRescheduleEmails({
          inviteeName: data.invitee_name || 'Invitee',
          ...(data.invitee_email?.trim()
            ? { inviteeEmail: data.invitee_email.trim() }
            : {}),
          ...(providerName?.trim() ? { providerName: providerName.trim() } : {}),
          ...(providerEmail?.trim() ? { providerEmail: providerEmail.trim() } : {}),
          eventTypeName,
          ...(departmentName?.trim() ? { departmentName: departmentName.trim() } : {}),
          startTime: newStart!,
          endTime: newEnd!,
          duration: durationMinutes,
          ...(prevStart ? { previousStartTime: prevStart } : {}),
          ...(prevEnd ? { previousEndTime: prevEnd } : {}),
        });

        const { data: rescheduleConfig } = await supabase
          .from('configurations')
          .select('settings')
          .eq('workspace_id', workspaceId)
          .single();
        const rescheduleWhatsappEnabled =
          (rescheduleConfig?.settings as { notifications?: { whatsapp?: boolean } } | undefined)
            ?.notifications?.whatsapp === true;

        if (rescheduleWhatsappEnabled && data?.id) {
          let admin_whatsapp_phones: string[] = [];
          if (patchNotifyAdmin) {
            try {
              admin_whatsapp_phones = await admin_whatsapp_phones_for_booking(
                supabase,
                data.id,
                {
                  workspace_id: String(workspaceId),
                  admin_supabase: patchNotifyAdmin,
                }
              );
            } catch (resolveAdminPhoneErr) {
              console.warn(
                'Could not resolve host phone for WhatsApp (dashboard reschedule):',
                resolveAdminPhoneErr
              );
            }
          }

          const inviteePhoneTrimmed = data.invitee_phone?.trim();
          const phoneForApi =
            inviteePhoneTrimmed ||
            (admin_whatsapp_phones[0] ? admin_whatsapp_phones[0].trim() : '');

          if (phoneForApi) {
            const metaRes = data.metadata as Record<string, unknown> | null | undefined;
            const notesFromMetaRes =
              metaRes && typeof metaRes.notes !== 'undefined'
                ? String(metaRes.notes ?? '')
                : '';
            const origin = new URL(req.url).origin;
            const message = `Booking rescheduled - Event: ${eventTypeName}, Client: ${data.invitee_name || 'Invitee'}`;

            await post_booking_whatsapp_notification(origin, {
              name: data.invitee_name?.trim() || 'Invitee',
              email: data.invitee_email?.trim() || null,
              phone: phoneForApi,
              message,
              service: eventTypeName,
              ...(departmentName?.trim() ? { department: departmentName.trim() } : {}),
              ...(providerName?.trim() ? { provider: providerName.trim() } : {}),
              start: newStart!,
              end: newEnd!,
              note: notesFromMetaRes,
              arrive_early_min: arriveEarlyMin,
              arrive_early_max: arriveEarlyMax,
              booking_reference: String(data.public_code || data.id || ''),
              send_to_user: Boolean(inviteePhoneTrimmed),
              send_to_admin: admin_whatsapp_phones.length > 0,
              ...(admin_whatsapp_phones.length > 0
                ? { admin_phone: admin_whatsapp_phones }
                : {}),
              skip_contact_form_email: true,
            });
          }
        }
      } catch (emailErr) {
        console.error('Error sending reschedule emails (dashboard):', emailErr);
      }
    }

    const prevStatusNorm = String(existingRow.status ?? '').toLowerCase();
    const newStatusNorm = String(data.status ?? '').toLowerCase();
    const statusChanged =
      status !== undefined && prevStatusNorm !== newStatusNorm;
    const skipStatusNotifyBecauseReschedule = shouldSendRescheduleEmails;

    if (statusChanged && !skipStatusNotifyBecauseReschedule) {
      try {
        let providerEmail: string | undefined;
        let providerName: string | undefined;
        let departmentName: string | undefined;
        let eventTypeName = 'Appointment';
        let durationMinutes = 30;
        let arriveEarlyMin = 10;
        let arriveEarlyMax = 15;

        const patchAdminClient = getPatchServiceRoleClient();
        const statusNotifyDb = patchAdminClient ?? supabase;

        if (data.event_type_id) {
          const { data: et } = await statusNotifyDb
            .from('event_types')
            .select('title, duration_minutes, buffer_before, buffer_after')
            .eq('id', data.event_type_id)
            .eq('workspace_id', workspaceId)
            .single();
          if (et) {
            eventTypeName = et.title || eventTypeName;
            durationMinutes = et.duration_minutes || durationMinutes;
            arriveEarlyMin = Number(et.buffer_before ?? arriveEarlyMin);
            arriveEarlyMax = Number(et.buffer_after ?? arriveEarlyMax);
          }
        }

        if (data.department_id) {
          const { data: dept } = await statusNotifyDb
            .from('departments')
            .select('name')
            .eq('id', data.department_id)
            .eq('workspace_id', workspaceId)
            .single();
          departmentName = dept?.name || undefined;
        }

        if (!departmentName?.trim()) {
          try {
            const sole = await sole_workspace_department_display_name(
              statusNotifyDb,
              workspaceId
            );
            if (sole) departmentName = sole;
          } catch (soleDeptErr) {
            console.error(
              'Error resolving sole department name (dashboard status):',
              soleDeptErr
            );
          }
        }

        if (patchAdminClient) {
          const resolved = await resolve_provider_notification_contact(
            patchAdminClient,
            patchAdminClient,
            String(workspaceId),
            data.service_provider_id || null
          );
          providerEmail = resolved.email;
          providerName = resolved.provider_name;
        } else {
          console.warn(
            'Service role key not configured, cannot fetch provider details for status notifications'
          );
        }

        const meta = data.metadata as Record<string, unknown> | null | undefined;
        const notesFromMeta =
          meta && typeof meta.notes !== 'undefined'
            ? String(meta.notes ?? '')
            : '';

        const displayPrev =
          existingRow.status != null ? String(existingRow.status) : 'unknown';
        const displayNew =
          data.status != null ? String(data.status) : 'unknown';

        const startT = data.start_at ?? existingRow.start_at ?? '';
        const endT = data.end_at ?? existingRow.end_at ?? startT;

        if (newStatusNorm === 'cancelled') {
          const { sendBookingCancellationEmails } = await import('@/lib/email-service');
          await sendBookingCancellationEmails({
            inviteeName: data.invitee_name || 'Invitee',
            ...(data.invitee_email?.trim()
              ? { inviteeEmail: data.invitee_email.trim() }
              : {}),
            ...(providerName?.trim() ? { providerName: providerName.trim() } : {}),
            ...(providerEmail?.trim() ? { providerEmail: providerEmail.trim() } : {}),
            eventTypeName,
            ...(departmentName?.trim() ? { departmentName: departmentName.trim() } : {}),
            startTime: startT,
            endTime: endT,
            duration: durationMinutes,
          });

          try {
            const gcalEventId = meta?.google_calendar_event_id as string | undefined;
            if (gcalEventId) {
              const { deleteCalendarEvent } = await import('@/lib/google-calendar-service');
              const calResult = await deleteCalendarEvent(
                Number(workspaceId),
                gcalEventId
              );
              if (!calResult.success) {
                console.warn('Google Calendar delete failed (PATCH cancel):', calResult.error);
              }
            }
          } catch (calErr) {
            console.warn('Google Calendar delete failed (PATCH cancel):', calErr);
          }
        } else {
          const { sendBookingStatusChangeEmails } = await import('@/lib/email-service');
          await sendBookingStatusChangeEmails({
            inviteeName: data.invitee_name || 'Invitee',
            ...(data.invitee_email?.trim()
              ? { inviteeEmail: data.invitee_email.trim() }
              : {}),
            ...(providerName?.trim() ? { providerName: providerName.trim() } : {}),
            ...(providerEmail?.trim() ? { providerEmail: providerEmail.trim() } : {}),
            eventTypeName,
            ...(departmentName?.trim() ? { departmentName: departmentName.trim() } : {}),
            startTime: startT,
            endTime: endT,
            duration: durationMinutes,
            ...(notesFromMeta ? { notes: notesFromMeta } : {}),
            previousStatus: displayPrev,
            newStatus: displayNew,
          });
        }

        const { data: configRow } = await supabase
          .from('configurations')
          .select('settings')
          .eq('workspace_id', workspaceId)
          .single();

        const whatsappEnabled =
          (configRow?.settings as { notifications?: { whatsapp?: boolean } } | undefined)
            ?.notifications?.whatsapp === true;

        if (whatsappEnabled && data?.id) {
          let statusChangeAdminPhones: string[] = [];
          if (patchAdminClient) {
            try {
              statusChangeAdminPhones = await admin_whatsapp_phones_for_booking(
                supabase,
                data.id,
                {
                  workspace_id: String(workspaceId),
                  admin_supabase: patchAdminClient,
                }
              );
            } catch (resolveAdminPhoneErr) {
              console.warn(
                'Could not resolve host phone for WhatsApp (dashboard status):',
                resolveAdminPhoneErr
              );
            }
          }

          const inviteePhoneStatus = data.invitee_phone?.trim();
          const isCancelled = newStatusNorm === 'cancelled';
          const phoneForCancelled =
            inviteePhoneStatus ||
            (statusChangeAdminPhones[0] ? statusChangeAdminPhones[0].trim() : '');

          const origin = new URL(req.url).origin;
          const message =
            isCancelled
              ? `Booking cancelled - Event: ${eventTypeName}, Client: ${data.invitee_name || 'Invitee'}`
              : `Booking status updated - Event: ${eventTypeName}, Client: ${data.invitee_name || 'Invitee'}, Status: ${displayPrev} → ${displayNew}`;

          if (isCancelled && phoneForCancelled) {
            await post_booking_whatsapp_notification(origin, {
              name: data.invitee_name?.trim() || 'Invitee',
              email: data.invitee_email?.trim() || null,
              phone: phoneForCancelled,
              message,
              service: eventTypeName,
              ...(departmentName?.trim() ? { department: departmentName.trim() } : {}),
              ...(providerName?.trim() ? { provider: providerName.trim() } : {}),
              start: startT,
              end: endT,
              note: notesFromMeta,
              arrive_early_min: arriveEarlyMin,
              arrive_early_max: arriveEarlyMax,
              booking_reference: String(data.public_code || data.id || ''),
              send_to_user: Boolean(inviteePhoneStatus),
              send_to_admin: statusChangeAdminPhones.length > 0,
              ...(statusChangeAdminPhones.length > 0
                ? { admin_phone: statusChangeAdminPhones }
                : {}),
              skip_contact_form_email: true,
            });
          } else if (!isCancelled && inviteePhoneStatus) {
            await post_booking_whatsapp_notification(origin, {
              name: data.invitee_name?.trim() || 'Invitee',
              email: data.invitee_email?.trim() || null,
              phone: inviteePhoneStatus,
              message,
              service: eventTypeName,
              ...(departmentName?.trim() ? { department: departmentName.trim() } : {}),
              ...(providerName?.trim() ? { provider: providerName.trim() } : {}),
              start: startT,
              end: endT,
              note: notesFromMeta,
              arrive_early_min: arriveEarlyMin,
              arrive_early_max: arriveEarlyMax,
              booking_reference: String(data.public_code || data.id || ''),
              send_to_user: true,
              send_to_admin: false,
              skip_contact_form_email: true,
            });
          }
        }
      } catch (statusNotifyErr) {
        console.error(
          'Error sending status-change notifications (dashboard):',
          statusNotifyErr
        );
      }
    }

    await appendActivityLog(workspaceId, {
      type: 'booking',
      action: 'updated',
      title: timeChanged && finalIsReschedule ? 'Booking rescheduled' : 'Booking updated',
      description: `${data?.invitee_name || 'Someone'} (${data?.status || 'pending'})`,
    });

    return NextResponse.json({ data });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || null;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

    // Create client with user's JWT token - this respects RLS
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    const workspaceId = user.user_metadata?.workspace_id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }
    const { error } = await supabase
      .from('bookings')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('Error deleting booking:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await appendActivityLog(workspaceId, {
      type: 'booking',
      action: 'deleted',
      title: 'Booking deleted',
      description: `Booking ID ${id} was removed`,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

