import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';
import { getLocalTimePartsInTimezone } from '@/lib/date-timezone';
import { appendActivityLog } from '@/lib/activity-log';
import {
  admin_whatsapp_phones_for_booking,
  resolve_provider_notification_contact,
} from '@/lib/booking_service_provider_phone';
import { post_booking_whatsapp_notification } from '@/lib/post_booking_whatsapp_notification';

type DayName = 'Sun' | 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat';

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

const NON_RESCHEDULABLE_STATUSES = ['cancelled', 'completed'];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { public_code, start_at, end_at, timezone: clientTimezone } = body;

    if (!public_code) {
      return NextResponse.json({ error: 'Booking code is required' }, { status: 400 });
    }
    if (!start_at) {
      return NextResponse.json({ error: 'Start time is required' }, { status: 400 });
    }

    const startDate = new Date(start_at);
    if (startDate < new Date()) {
      return NextResponse.json({ error: 'Cannot reschedule to a time in the past.' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, workspace_id, status, invitee_name, invitee_email, invitee_phone, start_at, end_at, event_type_id, service_provider_id, department_id, metadata, public_code')
      .eq('public_code', public_code)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (NON_RESCHEDULABLE_STATUSES.includes(booking.status?.toLowerCase() ?? '')) {
      return NextResponse.json(
        { error: `Cannot reschedule a ${booking.status} booking` },
        { status: 400 }
      );
    }

    const previousStartAt = booking.start_at;
    const previousEndAt = booking.end_at;
    const endDate = end_at ? new Date(end_at) : new Date(startDate);

    // --- Availability validation (mirrors embed booking creation) ---
    const { data: configData } = await supabase
      .from('configurations')
      .select('settings')
      .eq('workspace_id', booking.workspace_id)
      .single();

    const availabilityData: AvailabilitySettings = configData?.settings?.availability || {};

    let availability: AvailabilitySettings = availabilityData;
    if (booking.service_provider_id && availabilityData) {
      const providers = (availabilityData as Record<string, unknown>).providers as Record<string, Record<string, unknown>> | undefined;
      const providerOverrides = providers?.[booking.service_provider_id] || {};
      const generalTimesheet = availabilityData.timesheet;
      const generalIndividual = availabilityData.individual;
      const finalTimesheet = generalTimesheet
        ? { ...generalTimesheet, ...((providerOverrides.timesheet as Record<string, DaySchedule>) || {}) }
        : (providerOverrides.timesheet as Record<DayName, DaySchedule> | undefined);
      const finalIndividual = { ...(generalIndividual || {}), ...((providerOverrides.individual as Record<string, boolean>) || {}) };
      availability = { timesheet: finalTimesheet, individual: finalIndividual };
    }

    const tz = typeof clientTimezone === 'string' && clientTimezone.trim() ? clientTimezone.trim() : null;
    const startParts = tz ? getLocalTimePartsInTimezone(start_at, tz) : null;
    const endParts = tz && end_at ? getLocalTimePartsInTimezone(end_at, tz) : null;

    const dayName: DayName = startParts
      ? (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][startParts.dayOfWeek] as DayName)
      : (['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][startDate.getDay()] as DayName);

    const daySchedule = availability.timesheet?.[dayName];
    if (!daySchedule || !daySchedule.enabled) {
      return NextResponse.json({ error: 'The selected day is not available.' }, { status: 400 });
    }

    const startMinutes = startParts ? startParts.startMinutes : startDate.getHours() * 60 + startDate.getMinutes();
    const endMinutes = endParts ? endParts.startMinutes : endDate.getHours() * 60 + endDate.getMinutes();
    const scheduleStart = parseInt(daySchedule.startTime.split(':')[0]) * 60 + parseInt(daySchedule.startTime.split(':')[1]);
    const scheduleEnd = parseInt(daySchedule.endTime.split(':')[0]) * 60 + parseInt(daySchedule.endTime.split(':')[1]);

    if (startMinutes < scheduleStart || endMinutes > scheduleEnd) {
      return NextResponse.json({ error: 'This time slot is outside available hours.' }, { status: 400 });
    }

    if (daySchedule.breaks?.length) {
      const conflictsWithBreak = daySchedule.breaks.some((b) => {
        const bStart = parseInt(b.start.split(':')[0]) * 60 + parseInt(b.start.split(':')[1]);
        const bEnd = parseInt(b.end.split(':')[0]) * 60 + parseInt(b.end.split(':')[1]);
        return startMinutes < bEnd && endMinutes > bStart;
      });
      if (conflictsWithBreak) {
        return NextResponse.json({ error: 'This time slot conflicts with a break time.' }, { status: 400 });
      }
    }

    const dateStr = startParts ? startParts.dateStr : startDate.toISOString().split('T')[0];
    const slotHour = startParts ? startParts.hours : startDate.getHours();
    const individualKey = `${dateStr}-${slotHour}`;
    if (availability.individual?.[individualKey] === false) {
      return NextResponse.json({ error: 'This time slot has been marked as unavailable.' }, { status: 400 });
    }

    // Google Calendar busy check
    try {
      const { isSlotBusyInCalendar } = await import('@/lib/google-calendar-service');
      const isBusy = await isSlotBusyInCalendar(booking.workspace_id, start_at, end_at || start_at);
      if (isBusy) {
        return NextResponse.json({ error: 'This time slot is already blocked in calendar.' }, { status: 400 });
      }
    } catch { /* non-blocking */ }

    // Check booking conflicts (exclude the current booking being rescheduled)
    let conflictQuery = supabase
      .from('bookings')
      .select('id, start_at, end_at')
      .eq('workspace_id', booking.workspace_id)
      .neq('status', 'cancelled')
      .neq('id', booking.id)
      .gte('start_at', new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).toISOString())
      .lte('start_at', new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + 1).toISOString());

    if (booking.service_provider_id) {
      conflictQuery = conflictQuery.eq('service_provider_id', booking.service_provider_id);
    }

    const { data: existingBookings } = await conflictQuery;
    if (existingBookings?.length) {
      const hasConflict = existingBookings.some((b) => {
        const bStart = new Date(b.start_at);
        const bEnd = b.end_at ? new Date(b.end_at) : new Date(bStart);
        return startDate < bEnd && endDate > bStart;
      });
      if (hasConflict) {
        return NextResponse.json({ error: 'This time slot is already booked. Please select another time.' }, { status: 400 });
      }
    }

    // --- Update booking ---
    const { data: updated, error: updateError } = await supabase
      .from('bookings')
      .update({
        start_at,
        end_at: end_at || null,
        status: 'reschedule',
        is_reschedule_viewed: false,
      })
      .eq('id', booking.id)
      .select()
      .single();

    if (updateError) {
      console.error('Error rescheduling booking:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await appendActivityLog(booking.workspace_id, {
      type: 'booking',
      action: 'updated',
      title: 'Booking rescheduled',
      description: `${booking.invitee_name || 'Someone'} rescheduled their booking`,
    });

    // --- Notifications ---
    let providerEmail: string | undefined;
    let providerName: string | undefined;
    let departmentName: string | undefined;
    let eventTypeName = 'Appointment';
    let durationMinutes = 30;
    let arriveEarlyMin = 10;
    let arriveEarlyMax = 15;

    try {
      if (booking.event_type_id) {
        const { data: et } = await supabase
          .from('event_types')
          .select('title, duration_minutes, buffer_before, buffer_after')
          .eq('id', booking.event_type_id)
          .single();
        if (et) {
          eventTypeName = et.title || eventTypeName;
          durationMinutes = et.duration_minutes || durationMinutes;
          arriveEarlyMin = Number(et.buffer_before ?? arriveEarlyMin);
          arriveEarlyMax = Number(et.buffer_after ?? arriveEarlyMax);
        }
      }
    } catch { /* non-blocking */ }

    try {
      if (booking.department_id) {
        const { data: dept } = await supabase
          .from('departments')
          .select('name')
          .eq('id', booking.department_id)
          .single();
        departmentName = dept?.name || undefined;
      }
    } catch { /* non-blocking */ }

    try {
      const resolved = await resolve_provider_notification_contact(
        supabase,
        supabase,
        String(booking.workspace_id),
        booking.service_provider_id || null
      );
      providerEmail = resolved.email;
      providerName = resolved.provider_name;
    } catch { /* non-blocking */ }

    try {
      const inviteeEmailTrimmed = booking.invitee_email?.trim();
      if (inviteeEmailTrimmed || providerEmail?.trim()) {
        const { sendBookingRescheduleEmails } = await import('@/lib/email-service');
        await sendBookingRescheduleEmails({
          inviteeName: booking.invitee_name || 'Invitee',
          ...(inviteeEmailTrimmed ? { inviteeEmail: inviteeEmailTrimmed } : {}),
          ...(providerName?.trim() ? { providerName: providerName.trim() } : {}),
          ...(providerEmail?.trim() ? { providerEmail: providerEmail.trim() } : {}),
          eventTypeName,
          ...(departmentName?.trim() ? { departmentName: departmentName.trim() } : {}),
          startTime: start_at,
          endTime: end_at || start_at,
          duration: durationMinutes,
          previousStartTime: previousStartAt || undefined,
          previousEndTime: previousEndAt || undefined,
          ...(clientTimezone ? { timezone: clientTimezone } : {}),
        });
      }
    } catch (emailErr) {
      console.error('Error sending reschedule emails:', emailErr);
    }

    // WhatsApp notification
    try {
      const whatsappEnabled = configData?.settings?.notifications?.whatsapp === true;
      if (booking.invitee_phone && whatsappEnabled) {
        let admin_whatsapp_phones: string[] = [];
        try {
          admin_whatsapp_phones = await admin_whatsapp_phones_for_booking(
            supabase,
            booking.id,
            { workspace_id: String(booking.workspace_id) }
          );
        } catch (resolveAdminPhoneErr) {
          console.warn(
            'Could not resolve host phone for WhatsApp admin notification (reschedule):',
            resolveAdminPhoneErr
          );
        }

        const origin = new URL(req.url).origin;
        const message = `Booking rescheduled - Event: ${eventTypeName}, Client: ${booking.invitee_name || 'Invitee'}`;
        const metaNotes = (booking.metadata as Record<string, unknown> | null)?.notes;
        const noteStr =
          metaNotes !== undefined && metaNotes !== null ? String(metaNotes) : '';
        await post_booking_whatsapp_notification(origin, {
          name: booking.invitee_name || 'Invitee',
          email: booking.invitee_email || null,
          phone: String(booking.invitee_phone).trim(),
          message,
          service: eventTypeName,
          ...(departmentName?.trim() ? { department: departmentName.trim() } : {}),
          ...(providerName?.trim() ? { provider: providerName.trim() } : {}),
          start: start_at,
          end: end_at || start_at,
          note: noteStr,
          arrive_early_min: arriveEarlyMin,
          arrive_early_max: arriveEarlyMax,
          booking_reference: String(booking.public_code || booking.id || ''),
          send_to_user: false,
          send_to_admin: true,
          admin_phone: admin_whatsapp_phones,
          skip_contact_form_email: true,
        });
      }
    } catch { /* non-blocking */ }

    // Update Google Calendar event if one exists for this booking
    try {
      const gcalEventId = (booking.metadata as Record<string, unknown>)?.google_calendar_event_id as string | undefined;
      if (gcalEventId) {
        const { updateCalendarEvent } = await import('@/lib/google-calendar-service');
        const calResult = await updateCalendarEvent(booking.workspace_id, gcalEventId, {
          startAt: start_at,
          endAt: end_at || start_at,
        });
        if (!calResult.success) {
          console.warn('Google Calendar update failed (non-blocking):', calResult.error);
        }
      }
    } catch (calErr) {
      console.warn('Google Calendar update failed (non-blocking):', calErr);
    }

    return NextResponse.json({
      data: updated,
      preview_url: `/booking-preview/${booking.public_code}`,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error rescheduling booking:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
