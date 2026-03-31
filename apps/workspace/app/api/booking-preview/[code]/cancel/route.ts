import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@app/db';
import { appendActivityLog } from '@/lib/activity-log';

const NON_CANCELLABLE_STATUSES = ['cancelled', 'completed'];

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
    }

    const supabase = createSupabaseServerClient();

    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('id, workspace_id, status, invitee_name, invitee_email, invitee_phone, start_at, end_at, event_type_id, service_provider_id, department_id, metadata')
      .eq('public_code', code)
      .single();

    if (fetchError || !booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (NON_CANCELLABLE_STATUSES.includes(booking.status?.toLowerCase() ?? '')) {
      return NextResponse.json(
        { error: `Booking is already ${booking.status}` },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking.id);

    if (updateError) {
      console.error('Error cancelling booking:', updateError);
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await appendActivityLog(booking.workspace_id, {
      type: 'booking',
      action: 'updated',
      title: 'Booking cancelled',
      description: `${booking.invitee_name || 'Someone'} cancelled their booking`,
    });

    // Resolve notification context (best-effort)
    let providerEmail: string | undefined;
    let providerName: string | undefined;
    let departmentName: string | undefined;
    let eventTypeName = 'Appointment';
    let durationMinutes = 30;

    try {
      if (booking.event_type_id) {
        const { data: et } = await supabase
          .from('event_types')
          .select('title, duration_minutes')
          .eq('id', booking.event_type_id)
          .single();
        if (et) {
          eventTypeName = et.title || eventTypeName;
          durationMinutes = et.duration_minutes || durationMinutes;
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
      if (booking.service_provider_id) {
        const { data: { user } } = await supabase.auth.admin.getUserById(booking.service_provider_id);
        if (user) {
          providerEmail = user.email || undefined;
          providerName = user.user_metadata?.name || user.email?.split('@')[0] || 'Service Provider';
        }
      }
    } catch { /* non-blocking */ }

    // Send cancellation emails
    try {
      if (booking.invitee_email) {
        const { sendBookingCancellationEmails } = await import('@/lib/email-service');
        await sendBookingCancellationEmails({
          inviteeName: booking.invitee_name || 'Invitee',
          inviteeEmail: booking.invitee_email,
          ...(providerName?.trim() ? { providerName: providerName.trim() } : {}),
          providerEmail,
          eventTypeName,
          ...(departmentName?.trim() ? { departmentName: departmentName.trim() } : {}),
          startTime: booking.start_at || '',
          endTime: booking.end_at || booking.start_at || '',
          duration: durationMinutes,
        });
      }
    } catch (emailErr) {
      console.error('Error sending cancellation emails:', emailErr);
    }

    // Send WhatsApp notification (best-effort)
    try {
      const { data: configData } = await supabase
        .from('configurations')
        .select('settings')
        .eq('workspace_id', booking.workspace_id)
        .single();

      const whatsappEnabled = configData?.settings?.notifications?.whatsapp === true;

      if (booking.invitee_phone && whatsappEnabled) {
        const origin = new URL(_req.url).origin;
        const message = `Booking cancelled - Event: ${eventTypeName}, Client: ${booking.invitee_name || 'Invitee'}`;

        await fetch(`${origin}/api/whatsapp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: booking.invitee_name || 'Invitee',
            email: booking.invitee_email || null,
            phone: booking.invitee_phone,
            message,
            send_to_user: false,
            send_to_admin: true,
          }),
        }).catch((err) => console.error('WhatsApp notification error:', err));
      }
    } catch { /* non-blocking */ }

    // Delete Google Calendar event if one exists for this booking
    try {
      const gcalEventId = (booking.metadata as Record<string, unknown>)?.google_calendar_event_id as string | undefined;
      if (gcalEventId) {
        const { deleteCalendarEvent } = await import('@/lib/google-calendar-service');
        const calResult = await deleteCalendarEvent(booking.workspace_id, gcalEventId);
        if (!calResult.success) {
          console.warn('Google Calendar delete failed (non-blocking):', calResult.error);
        }
      }
    } catch (calErr) {
      console.warn('Google Calendar delete failed (non-blocking):', calErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    console.error('Error cancelling booking:', error);
    return NextResponse.json(
      { error: error?.message || 'Server error' },
      { status: 500 }
    );
  }
}
