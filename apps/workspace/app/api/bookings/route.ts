import crypto from 'crypto';
import { after } from 'next/server';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { findOrCreateContact, resolveContactForInviteeUpdate } from '@/lib/contact-linking';
import { getLocalTimePartsInTimezone } from '@/lib/date-timezone';
import {
  emailTimezoneFields,
  formatDualTimeBlock,
  resolveBookingTimezonesForInsert,
  resolveValidationTimezone,
  whatsapp_timezone_payload,
} from '@/lib/booking-timezone-api';
import { appendActivityLog } from '@/lib/activity-log';
import {
  admin_whatsapp_phones_for_booking,
  notification_provider_name,
  resolve_booking_service_provider_name_snapshot,
  resolve_provider_notification_contact,
  sole_workspace_department_display_name,
} from '@/lib/booking_service_provider_phone';
import { post_booking_whatsapp_notification } from '@/lib/post_booking_whatsapp_notification';
import { run_post_booking_processing } from '@/lib/post_booking_processing';
import {
  is_whatsapp_admin_enabled,
  is_whatsapp_user_enabled,
} from '@/lib/workspace-notification-flags';
import { resolveAvailabilityForServiceProvider } from '@/src/utils/availabilityResolution';
import {
  parse_location_meeting_option,
  resolve_meeting_join_url_from_booking,
} from '@/src/utils/google_meet';
import { list_bookable_meeting_option_keys } from '@/src/utils/meeting_options';
import { normalizeInviteePhoneForStorage } from '@/src/utils/phone';
import {
  resolveMeetingOptionsForServiceProvider,
  resolveNotificationsForServiceProvider,
} from '@/src/utils/providerSettingsResolution';
import { merge_reschedule_metadata } from '@/src/utils/booking_reschedule';
import {
  resolveEffectiveDurationForBookingRequest,
  validateBookingEndAt,
} from '@/lib/booking-effective-duration';

type DayName = "Sun" | "Mon" | "Tue" | "Wed" | "Thu" | "Fri" | "Sat";

/** Parse YYYY-MM-DD from calendar filters as local calendar dates (not UTC midnight). */
function parse_calendar_date_key(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return null;
  }
  return new Date(year, month, day);
}

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
    const serviceProviderIdParam = searchParams.get('service_provider_id') || '';
    const departmentId = searchParams.get('department_id') || '';
    const sortBy = searchParams.get('sort') || 'start_at';
    const offset = (page - 1) * limit;

    const userRole =
      typeof user.user_metadata?.role === 'string'
        ? user.user_metadata.role
        : '';
    const isServiceProvider = userRole === 'service_provider';
    const serviceProviderId = isServiceProvider
      ? user.id
      : serviceProviderIdParam.trim();
    
    const now = new Date().toISOString();

    // Build query with search filter, event_types and contacts join
    let query = supabase
      .from('bookings')
      .select('*, event_types(title, duration_minutes, location_type), contacts(name, phone, email)', { count: 'exact' })
      .eq('workspace_id', workspaceId);

    if (sortBy === 'service_provider') {
      query = query
        .order('service_provider_id', { ascending: true, nullsFirst: false })
        .order('start_at', { ascending: true });
    } else {
      const orderColumn = sortBy === 'latest' || sortBy === 'new' ? 'created_at' : 'start_at';
      const ascending = sortBy === 'upcoming';
      query = query.order(orderColumn, { ascending });

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
    }

    // Apply search filter if provided
    if (search.trim()) {
      query = query.ilike('invitee_name', `%${search.trim()}%`);
    }

    // Apply date filter if provided (fetch bookings for a specific date)
    if (date) {
      const dateObj = parse_calendar_date_key(date) ?? new Date(date);
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
      const startDateObj = parse_calendar_date_key(startDate) ?? new Date(startDate);
      const startOfRange = new Date(startDateObj);
      startOfRange.setHours(0, 0, 0, 0);
      
      const endDateObj = parse_calendar_date_key(endDate) ?? new Date(endDate);
      const endOfRange = new Date(endDateObj);
      endOfRange.setHours(23, 59, 59, 999);
      
      query = query
        .gte('start_at', startOfRange.toISOString())
        .lte('start_at', endOfRange.toISOString());
    }

    // Hide soft-deleted bookings unless explicitly filtering by deleted
    const statusTrim = status.trim();
    const showingDeletedOnly = statusTrim.toLowerCase() === 'deleted';
    if (!showingDeletedOnly) {
      query = query.neq('status', 'deleted');
    }

    // Apply status filter if provided
    if (statusTrim) {
      query = query.eq('status', statusTrim);
    }

    // Apply event type filter if provided
    if (eventTypeId.trim()) {
      query = query.eq('event_type_id', eventTypeId.trim());
    }

    // Apply service provider filter if provided (SP role is always scoped to self)
    if (serviceProviderId) {
      query = query.eq('service_provider_id', serviceProviderId);
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

    // Enrich each booking with creator info resolved from host_user_id so the
    // UI can show who created the record. Public embed bookings have
    // host_user_id = null and remain null creators (rendered as guests client-side).
    const rawRows = (data || []) as Array<Record<string, unknown>>;
    const uniqueHostUserIds = Array.from(
      new Set(
        rawRows
          .map((r) => r.host_user_id)
          .filter(
            (id): id is string => typeof id === 'string' && id.length > 0
          )
      )
    );

    type BookingCreator = {
      id: string;
      name: string;
      email: string | null;
    };
    const creatorById = new Map<string, BookingCreator>();

    if (uniqueHostUserIds.length > 0) {
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (serviceKey) {
        const adminClient = createClient(supabaseUrl, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const lookups = await Promise.all(
          uniqueHostUserIds.map(async (id) => {
            try {
              const { data: userResult } =
                await adminClient.auth.admin.getUserById(id);
              return { id, user: userResult?.user ?? null };
            } catch {
              return { id, user: null };
            }
          })
        );
        for (const entry of lookups) {
          if (!entry.user) continue;
          const meta = (entry.user.user_metadata || {}) as Record<
            string,
            unknown
          >;
          const rawName =
            typeof meta.name === 'string' ? meta.name.trim() : '';
          const rawFullName =
            typeof meta.full_name === 'string' ? meta.full_name.trim() : '';
          const emailPrefix =
            typeof entry.user.email === 'string' && entry.user.email.includes('@')
              ? entry.user.email.split('@')[0]
              : '';
          const resolvedName =
            rawName || rawFullName || emailPrefix || 'Unknown';
          creatorById.set(entry.id, {
            id: entry.id,
            name: resolvedName,
            email: entry.user.email ?? null,
          });
        }
      }
    }

    const enrichedData = rawRows.map((row) => {
      const hostUserId =
        typeof row.host_user_id === 'string' ? row.host_user_id : null;
      const creator =
        hostUserId && creatorById.has(hostUserId)
          ? creatorById.get(hostUserId) ?? null
          : null;
      return { ...row, creator };
    });

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
          endOfRange.toISOString(),
          serviceProviderId || undefined
        );
      } catch {
        // Non-blocking
      }
    }

    return NextResponse.json({
      data: enrichedData,
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
    } = body;

    if (!invitee_name || !invitee_name.trim()) {
      return NextResponse.json({ error: 'Invitee name is required' }, { status: 400 });
    }

    if (!start_at) {
      return NextResponse.json({ error: 'Start time is required' }, { status: 400 });
    }

    const inviteePhoneNorm = normalizeInviteePhoneForStorage(invitee_phone);
    if (inviteePhoneNorm.invalid) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }
    const invitee_phone_e164 = inviteePhoneNorm.value;

    const workspaceId = user.user_metadata?.workspace_id;
    const hostUserId = user.id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID not found' }, { status: 400 });
    }

    const serviceRoleClient = getServiceRoleClient();
    if (serviceRoleClient) {
      try {
        const { assertBookingAllowed } = await import('@app/db/subscription');
        await assertBookingAllowed(serviceRoleClient, Number(workspaceId));
      } catch (planErr) {
        const { planLimitErrorResponse } = await import('@/lib/plan-limit-response');
        const planResp = planLimitErrorResponse(planErr);
        if (planResp) return planResp;
        throw planErr;
      }
    }

    // Validate availability before creating booking
    const startDate = new Date(start_at);

    const effectiveDurationMinutes = await resolveEffectiveDurationForBookingRequest(
      supabase,
      workspaceId,
      event_type_id,
      metadata
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

    // Use timezone-aware parsing in provider/visitor timezone (fixes Vercel UTC vs local mismatch)
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
      const isBusy = await isSlotBusyInCalendar(
        Number(workspaceId),
        start_at,
        resolvedEndAt,
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
      invitee_phone_e164
    );

    const publicCode = crypto.randomUUID();

    let eventTypeLocationTypeForBooking: string | null = null;
    if (event_type_id) {
      const { data: etloc } = await supabase
        .from('event_types')
        .select('location_type')
        .eq('id', event_type_id)
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      eventTypeLocationTypeForBooking =
        typeof etloc?.location_type === 'string' ? etloc.location_type : null;
    }
    const bookableMeetingKeys = list_bookable_meeting_option_keys(
      eventTypeLocationTypeForBooking,
      resolvedMeetingOptions
    );

    let normalizedBookingLocation: Record<string, unknown> | null = null;
    if (location !== undefined && location !== null) {
      if (typeof location !== 'object' || Array.isArray(location)) {
        return NextResponse.json({ error: 'Invalid location' }, { status: 400 });
      }
      const mo = parse_location_meeting_option(location);
      if (mo !== null) {
        if (!bookableMeetingKeys.includes(mo)) {
          return NextResponse.json(
            { error: 'Meeting option is not available for this event type' },
            { status: 400 }
          );
        }
        normalizedBookingLocation = { meeting_option: mo };
      } else {
        normalizedBookingLocation = { ...(location as Record<string, unknown>) };
      }
    }

    const serviceProviderNameSnapshot =
      await resolve_booking_service_provider_name_snapshot(
        supabase,
        getServiceRoleClient(),
        workspaceId,
        bookingServiceProviderId
      );

    let { data, error } = await supabase
      .from('bookings')
      .insert({
        workspace_id: workspaceId,
        event_type_id: event_type_id || null,
        service_provider_id: service_provider_id || null,
        service_provider_name: serviceProviderNameSnapshot,
        department_id: department_id || null,
        host_user_id: hostUserId,
        invitee_name: invitee_name.trim(),
        invitee_email: invitee_email?.trim() || null,
        invitee_phone: invitee_phone_e164,
        contact_id: contactId ?? null,
        start_at: start_at,
        end_at: resolvedEndAt || null,
        customer_timezone: tzFields.customer_timezone,
        provider_timezone: tzFields.provider_timezone,
        status: status || 'pending',
        location: normalizedBookingLocation,
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

    const origin = new URL(req.url).origin;
    const bookingMetadata =
      metadata && typeof metadata === 'object'
        ? (metadata as Record<string, unknown>)
        : null;

    after(async () => {
      try {
        await run_post_booking_processing({
          origin,
          booking: data,
          workspace_id: workspaceId,
          event_type_id: event_type_id || null,
          service_provider_id: service_provider_id || null,
          department_id: department_id || null,
          invitee_name: invitee_name.trim(),
          invitee_email: invitee_email?.trim() || null,
          invitee_phone_e164,
          start_at,
          resolved_end_at: resolvedEndAt,
          duration_minutes: effectiveDurationMinutes,
          booking_location: normalizedBookingLocation,
          calendar_location: location,
          metadata: bookingMetadata,
          notes: bookingMetadata?.notes ? String(bookingMetadata.notes) : undefined,
          whatsapp_opt_in: Boolean(bookingMetadata?.whatsapp_opt_in),
          tz_fields: tzFields,
          resolved_notifications: resolvedNotifications,
          activity_log: {
            actor_user_id: user.id,
            status: status || 'pending',
          },
          supabase_client: supabase,
        });
      } catch (postBookingErr) {
        console.error('Post-booking processing failed:', postBookingErr);
      }
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
      customer_timezone,
      provider_timezone,
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
        'start_at, end_at, status, invitee_name, invitee_email, invitee_phone, event_type_id, service_provider_id, department_id, metadata, public_code, contact_id, customer_timezone, provider_timezone'
      )
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single();

    if (existingError || !existingRow) {
      return NextResponse.json({ error: 'Booking not found or access denied' }, { status: 404 });
    }

    if (String(existingRow.status ?? '').toLowerCase() === 'deleted') {
      return NextResponse.json({ error: 'Booking no longer exists' }, { status: 404 });
    }

    const nextStatusRaw = status !== undefined ? status : existingRow.status;
    const nextIsRescheduleStatus =
      String(nextStatusRaw ?? '').toLowerCase() === 'reschedule';

    const updateData: Record<string, unknown> = {};
    if (event_type_id !== undefined) updateData.event_type_id = event_type_id || null;
    if (service_provider_id !== undefined) {
      const nextProviderId = service_provider_id || null;
      updateData.service_provider_id = nextProviderId;
      const prevProviderId = existingRow.service_provider_id || null;
      if (nextProviderId !== prevProviderId) {
        updateData.service_provider_name =
          await resolve_booking_service_provider_name_snapshot(
            supabase,
            getPatchServiceRoleClient(),
            workspaceId,
            nextProviderId
          );
      }
    }
    if (department_id !== undefined) updateData.department_id = department_id || null;
    if (invitee_name !== undefined) updateData.invitee_name = invitee_name?.trim() || null;
    if (invitee_email !== undefined) updateData.invitee_email = invitee_email?.trim() || null;
    if (invitee_phone !== undefined) {
      const patchPhoneNorm = normalizeInviteePhoneForStorage(invitee_phone);
      if (patchPhoneNorm.invalid) {
        return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
      }
      updateData.invitee_phone = patchPhoneNorm.value;
    }
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
      const mergedBase = (metadata !== undefined ? metadata : existingRow.metadata) as
        | Record<string, unknown>
        | null
        | undefined;
      updateData.metadata = merge_reschedule_metadata(
        mergedBase,
        existingRow.start_at,
        existingRow.end_at ?? null
      );
    }

    if (timeChanged && start_at) {
      const effectiveDurationMinutes = await resolveEffectiveDurationForBookingRequest(
        supabase,
        workspaceId,
        (event_type_id !== undefined ? event_type_id : existingRow.event_type_id) as string | null,
        (metadata !== undefined ? metadata : existingRow.metadata) as Record<string, unknown> | null
      );
      const durationValidation = validateBookingEndAt(
        start_at,
        end_at ?? existingRow.end_at,
        effectiveDurationMinutes
      );
      if (!durationValidation.ok) {
        return NextResponse.json({ error: durationValidation.message }, { status: 400 });
      }
      if (end_at === undefined) {
        updateData.end_at = durationValidation.resolvedEndAt;
      }

      const { data: patchConfig } = await supabase
        .from('configurations')
        .select('settings')
        .eq('workspace_id', workspaceId)
        .single();

      const patchServiceProviderId =
        service_provider_id !== undefined
          ? (typeof service_provider_id === 'string' && service_provider_id.trim()
              ? service_provider_id.trim()
              : null)
          : typeof existingRow.service_provider_id === 'string' &&
              existingRow.service_provider_id.trim()
            ? existingRow.service_provider_id.trim()
            : null;

      const patchAvailabilityData: AvailabilitySettings =
        patchConfig?.settings?.availability || {};
      const patchAvailability = resolveAvailabilityForServiceProvider(
        patchAvailabilityData,
        patchServiceProviderId
      );

      const workspaceTimezone =
        (patchConfig?.settings as { general?: { timezone?: string } } | undefined)?.general
          ?.timezone ?? null;
      const tzFields = resolveBookingTimezonesForInsert(
        body as Record<string, unknown>,
        workspaceTimezone
      );
      const patchCustomerTz =
        tzFields.customer_timezone ??
        (typeof existingRow.customer_timezone === 'string'
          ? existingRow.customer_timezone.trim() || null
          : null);
      const patchProviderTz =
        tzFields.provider_timezone ??
        (typeof existingRow.provider_timezone === 'string'
          ? existingRow.provider_timezone.trim() || null
          : null);

      if (customer_timezone !== undefined || provider_timezone !== undefined || timeChanged) {
        updateData.customer_timezone = patchCustomerTz;
        updateData.provider_timezone = patchProviderTz;
      }

      const tz = resolveValidationTimezone(
        workspaceTimezone,
        patchCustomerTz,
        patchProviderTz
      );
      const startDate = new Date(start_at);
      const resolvedEndAt =
        (updateData.end_at as string | undefined) ??
        end_at ??
        existingRow.end_at ??
        start_at;
      const endDate = new Date(resolvedEndAt);
      const startParts = tz ? getLocalTimePartsInTimezone(start_at, tz) : null;
      const endParts = tz ? getLocalTimePartsInTimezone(resolvedEndAt, tz) : null;

      const dayName: DayName = startParts
        ? (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][startParts.dayOfWeek] as DayName)
        : (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][startDate.getDay()] as DayName);
      const daySchedule = patchAvailability.timesheet?.[dayName];

      if (!daySchedule || !daySchedule.enabled) {
        return NextResponse.json(
          { error: 'The selected day is not available.' },
          { status: 400 }
        );
      }

      const startMinutes = startParts
        ? startParts.startMinutes
        : startDate.getHours() * 60 + startDate.getMinutes();
      const endMinutes = endParts
        ? endParts.startMinutes
        : endDate.getHours() * 60 + endDate.getMinutes();
      const scheduleStart =
        parseInt(daySchedule.startTime.split(':')[0]) * 60 +
        parseInt(daySchedule.startTime.split(':')[1]);
      const scheduleEnd =
        parseInt(daySchedule.endTime.split(':')[0]) * 60 +
        parseInt(daySchedule.endTime.split(':')[1]);

      if (startMinutes < scheduleStart || endMinutes > scheduleEnd) {
        return NextResponse.json(
          { error: 'This time slot is outside available hours.' },
          { status: 400 }
        );
      }

      if (daySchedule.breaks?.length) {
        const conflictsWithBreak = daySchedule.breaks.some((breakTime) => {
          const breakStart =
            parseInt(breakTime.start.split(':')[0]) * 60 +
            parseInt(breakTime.start.split(':')[1]);
          const breakEnd =
            parseInt(breakTime.end.split(':')[0]) * 60 +
            parseInt(breakTime.end.split(':')[1]);
          return startMinutes < breakEnd && endMinutes > breakStart;
        });
        if (conflictsWithBreak) {
          return NextResponse.json(
            { error: 'This time slot conflicts with a break time.' },
            { status: 400 }
          );
        }
      }

      const dateStr = startParts ? startParts.dateStr : startDate.toISOString().split('T')[0];
      const slotHour = startParts ? startParts.hours : startDate.getHours();
      const individualKey = `${dateStr}-${slotHour}`;
      if (patchAvailability.individual?.[individualKey] === false) {
        return NextResponse.json(
          { error: 'This time slot has been marked as unavailable.' },
          { status: 400 }
        );
      }
    } else if (customer_timezone !== undefined || provider_timezone !== undefined) {
      const { data: tzConfig } = await supabase
        .from('configurations')
        .select('settings')
        .eq('workspace_id', workspaceId)
        .maybeSingle();
      const workspaceTimezone =
        (tzConfig?.settings as { general?: { timezone?: string } } | undefined)?.general
          ?.timezone ?? null;
      const tzFields = resolveBookingTimezonesForInsert(
        body as Record<string, unknown>,
        workspaceTimezone
      );
      if (customer_timezone !== undefined) {
        updateData.customer_timezone = tzFields.customer_timezone;
      }
      if (provider_timezone !== undefined) {
        updateData.provider_timezone = tzFields.provider_timezone;
      }
    }

    const next_invitee_name =
      invitee_name !== undefined ? invitee_name?.trim() || null : existingRow.invitee_name;
    const next_invitee_email =
      invitee_email !== undefined ? invitee_email?.trim() || null : existingRow.invitee_email;
    const next_invitee_phone =
      invitee_phone !== undefined ? invitee_phone?.trim() || null : existingRow.invitee_phone;

    if (
      invitee_name !== undefined ||
      invitee_email !== undefined ||
      invitee_phone !== undefined
    ) {
      try {
        const resolved = await resolveContactForInviteeUpdate(
          supabase,
          workspaceId,
          {
            invitee_name: existingRow.invitee_name,
            invitee_email: existingRow.invitee_email,
            invitee_phone: existingRow.invitee_phone,
            contact_id:
              typeof existingRow.contact_id === 'number'
                ? existingRow.contact_id
                : existingRow.contact_id != null
                  ? Number(existingRow.contact_id)
                  : null,
          },
          {
            invitee_name: next_invitee_name,
            invitee_email: next_invitee_email,
            invitee_phone: next_invitee_phone,
          }
        );

        if (resolved.contact_id != null) {
          updateData.contact_id = resolved.contact_id;
        }
        if (resolved.metadata_patch) {
          const mergedBase = (updateData.metadata !== undefined
            ? updateData.metadata
            : metadata !== undefined
              ? metadata
              : existingRow.metadata) as Record<string, unknown> | null | undefined;
          updateData.metadata = {
            ...(typeof mergedBase === 'object' && mergedBase !== null ? mergedBase : {}),
            invitee_change: resolved.metadata_patch,
          };
        }
      } catch (e) {
        console.error('resolveContactForInviteeUpdate:', e);
      }
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
    const shouldSendDatetimeChangeNotifications = timeChanged;

    if (shouldSendDatetimeChangeNotifications) {
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
          providerName = notification_provider_name(data, resolved);
        } else {
          console.warn(
            'Service role key not configured, cannot fetch provider details for reschedule notifications'
          );
        }

        const prevStart = existingRow.start_at ?? undefined;
        const prevEnd = existingRow.end_at ?? undefined;
        const newStart = data.start_at ?? prevStart;
        const newEnd = data.end_at ?? prevEnd ?? newStart;

        const rescheduleMeetUrl = resolve_meeting_join_url_from_booking(
          data.location,
          data.metadata
        )?.trim();

        const patchTzEmail = emailTimezoneFields(
          (data as { customer_timezone?: string | null }).customer_timezone,
          (data as { provider_timezone?: string | null }).provider_timezone,
          newStart!
        );
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
          ...patchTzEmail,
          ...(prevStart ? { previousStartTime: prevStart } : {}),
          ...(prevEnd ? { previousEndTime: prevEnd } : {}),
          ...(rescheduleMeetUrl
            ? { meetingUrl: rescheduleMeetUrl, meetingLabel: 'Google Meet' }
            : {}),
        });

        const { data: rescheduleConfig } = await supabase
          .from('configurations')
          .select('settings')
          .eq('workspace_id', workspaceId)
          .single();
        const rescheduleSpId =
          typeof data.service_provider_id === 'string' && data.service_provider_id.trim()
            ? data.service_provider_id.trim()
            : null;
        const reschedule_notifications = resolveNotificationsForServiceProvider(
          rescheduleConfig?.settings?.notifications as Record<string, unknown> | undefined,
          rescheduleSpId
        );
        const reschedule_whatsapp_admin =
          is_whatsapp_admin_enabled(reschedule_notifications);
        const reschedule_whatsapp_user =
          is_whatsapp_user_enabled(reschedule_notifications);

        if (
          (reschedule_whatsapp_admin || reschedule_whatsapp_user) &&
          data?.id
        ) {
          let admin_whatsapp_phones: string[] = [];
          if (reschedule_whatsapp_admin && patchNotifyAdmin) {
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

          const should_send_whatsapp_reschedule =
            phoneForApi &&
            (
              (reschedule_whatsapp_user && Boolean(inviteePhoneTrimmed)) ||
              (reschedule_whatsapp_admin && admin_whatsapp_phones.length > 0)
            );

          if (should_send_whatsapp_reschedule) {
            const metaRes = data.metadata as Record<string, unknown> | null | undefined;
            const notesFromMetaRes =
              metaRes && typeof metaRes.notes !== 'undefined'
                ? String(metaRes.notes ?? '')
                : '';
            const origin = new URL(req.url).origin;
            let message = finalIsReschedule
              ? `Booking rescheduled - Event: ${eventTypeName}, Client: ${data.invitee_name || 'Invitee'}`
              : `Booking time updated - Event: ${eventTypeName}, Client: ${data.invitee_name || 'Invitee'}`;
            if (rescheduleMeetUrl) {
              message = `${message} Meet: ${rescheduleMeetUrl}`;
            }

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
              previous_start: prevStart,
              note: notesFromMetaRes,
              arrive_early_min: arriveEarlyMin,
              arrive_early_max: arriveEarlyMax,
              booking_reference: String(data.public_code || data.id || ''),
              booking_id: data?.id ? String(data.id) : undefined,
              send_to_user:
                reschedule_whatsapp_user && Boolean(inviteePhoneTrimmed),
              send_to_admin:
                reschedule_whatsapp_admin &&
                admin_whatsapp_phones.length > 0,
              ...(admin_whatsapp_phones.length > 0
                ? { admin_phone: admin_whatsapp_phones }
                : {}),
              skip_contact_form_email: true,
              notification_kind: 'reschedule',
              ...whatsapp_timezone_payload(
                (data as { customer_timezone?: string | null }).customer_timezone,
                (data as { provider_timezone?: string | null }).provider_timezone
              ),
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
    const skipStatusNotifyBecauseDatetimeChange = shouldSendDatetimeChangeNotifications;
    /** Admin/dashboard status updates: no outbound email/WhatsApp to invitees */
    const silentAdminStatusNotify =
      newStatusNorm === 'completed' ||
      newStatusNorm === 'no-show' ||
      newStatusNorm === 'deleted';

    if (
      statusChanged &&
      !skipStatusNotifyBecauseDatetimeChange &&
      !silentAdminStatusNotify
    ) {
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
          providerName = notification_provider_name(data, resolved);
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

        const statusTzEmail = emailTimezoneFields(
          (data as { customer_timezone?: string | null }).customer_timezone,
          (data as { provider_timezone?: string | null }).provider_timezone,
          startT
        );

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
            ...statusTzEmail,
          });

          try {
            const gcalEventId = meta?.google_calendar_event_id as string | undefined;
            if (gcalEventId) {
              const { deleteCalendarEvent } = await import('@/lib/google-calendar-service');
              const calResult = await deleteCalendarEvent(
                Number(workspaceId),
                gcalEventId,
                (data.service_provider_id ?? existingRow.service_provider_id) as
                  | string
                  | null
                  | undefined
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
            ...statusTzEmail,
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

        const statusSpId =
          typeof data.service_provider_id === 'string' && data.service_provider_id.trim()
            ? data.service_provider_id.trim()
            : typeof existingRow.service_provider_id === 'string' &&
                existingRow.service_provider_id.trim()
              ? existingRow.service_provider_id.trim()
              : null;
        const status_notifications = resolveNotificationsForServiceProvider(
          configRow?.settings?.notifications as Record<string, unknown> | undefined,
          statusSpId
        );
        const whatsapp_admin = is_whatsapp_admin_enabled(status_notifications);
        const whatsapp_user = is_whatsapp_user_enabled(status_notifications);

        let workspaceSlug = '';
        try {
          const { data: ws } = await statusNotifyDb
            .from('workspaces')
            .select('slug')
            .eq('id', workspaceId)
            .single();
          workspaceSlug = ws?.slug || '';
        } catch { /* non-blocking */ }

        if ((whatsapp_admin || whatsapp_user) && data?.id) {
          let statusChangeAdminPhones: string[] = [];
          if (whatsapp_admin && patchAdminClient) {
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

          const origin = new URL(req.url).origin;
          const message =
            isCancelled
              ? `Booking cancelled - Event: ${eventTypeName}, Client: ${data.invitee_name || 'Invitee'}`
              : `Booking status updated - Event: ${eventTypeName}, Client: ${data.invitee_name || 'Invitee'}, Status: ${displayPrev} → ${displayNew}`;

          if (isCancelled && whatsapp_user && inviteePhoneStatus) {
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
              booking_reference: workspaceSlug,
              booking_id: data?.id ? String(data.id) : undefined,
              cancelled_by: providerName?.trim() || 'Admin',
              send_to_user:
                whatsapp_user && Boolean(inviteePhoneStatus),
              send_to_admin: false,
              ...(statusChangeAdminPhones.length > 0
                ? { admin_phone: statusChangeAdminPhones }
                : {}),
              skip_contact_form_email: true,
              notification_kind: 'cancel',
              ...whatsapp_timezone_payload(
                (data as { customer_timezone?: string | null }).customer_timezone,
                (data as { provider_timezone?: string | null }).provider_timezone
              ),
            });
          } else if (!isCancelled && inviteePhoneStatus && whatsapp_user) {
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
              booking_reference: workspaceSlug,
              send_to_user: true,
              send_to_admin: false,
              skip_contact_form_email: true,
              ...whatsapp_timezone_payload(
                (data as { customer_timezone?: string | null }).customer_timezone,
                (data as { provider_timezone?: string | null }).provider_timezone
              ),
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
      entity_id: data?.id ?? id,
      actor_user_id: user.id,
      title:
        timeChanged && finalIsReschedule
          ? 'Booking rescheduled'
          : timeChanged && !finalIsReschedule
            ? 'Booking time updated'
            : 'Booking updated',
      description: `${data?.invitee_name || 'Someone'} (${data?.status || 'pending'})`,
      before_data: {
        invitee_name: existingRow.invitee_name,
        status: existingRow.status,
        start_at: existingRow.start_at,
        end_at: existingRow.end_at,
        service_provider_id: existingRow.service_provider_id,
        event_type_id: existingRow.event_type_id,
      },
      after_data: {
        invitee_name: data?.invitee_name,
        status: data?.status,
        start_at: data?.start_at,
        end_at: data?.end_at,
        service_provider_id: data?.service_provider_id,
        event_type_id: data?.event_type_id,
      },
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
    const { data: beforeBooking } = await supabase
      .from('bookings')
      .select('id,invitee_name,status,start_at,end_at')
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .single();

    const { error: updErr } = await supabase
      .from('bookings')
      .update({ status: 'deleted' })
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (updErr) {
      console.error('Error soft-deleting booking:', updErr);
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    await appendActivityLog(workspaceId, {
      type: 'booking',
      action: 'deleted',
      entity_id: id,
      actor_user_id: user.id,
      title: 'Booking marked deleted',
      description: `Booking ID ${id} was hidden from the bookings list but kept for audit (superadmin can restore).`,
      before_data: {
        invitee_name: beforeBooking?.invitee_name,
        status: beforeBooking?.status,
        start_at: beforeBooking?.start_at,
        end_at: beforeBooking?.end_at,
      },
      after_data: {
        status: 'deleted',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Booking deleted successfully',
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error:', error);
    return NextResponse.json({ error: error?.message || 'Server error' }, { status: 500 });
  }
}

