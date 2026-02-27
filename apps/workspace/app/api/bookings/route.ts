import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
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
    
    const orderColumn = sortBy === 'latest' ? 'created_at' : 'start_at';
    
    // Build query with search filter, event_types and contacts join
    let query = supabase
      .from('bookings')
      .select('*, event_types(title), contacts(name, phone, email)', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order(orderColumn, { ascending: false });

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
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating booking:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
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

        // const message = [
        //   'Booking confirmed',
        //   `Event: ${eventTypeName}`,
        //   `Department: ${departmentLabel}`,
        //   `Service Provider: ${providerLabel}`,
        //   `When: ${when}`,
        //   metadata?.notes ? `Notes: ${String(metadata.notes)}` : '',
        // ]

        const message = [
          'Booking confirmed' + ' ' + `Event: ${eventTypeName}` + ' ' + `Department: ${departmentLabel}` + ' ' + `Service Provider: ${providerLabel}` + ' ' + `When: ${when}` + ' ' + (metadata?.notes ? `Notes: ${String(metadata.notes)}` : ''),
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

    return NextResponse.json({ data });
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
    } = body;

    if (!id) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    const workspaceId = user.user_metadata?.workspace_id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

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

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

