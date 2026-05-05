'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useWorkspaceSettings } from '@/src/hooks/useWorkspaceSettings';
import { useEventTypes } from '@/src/hooks/useBookingLookups';
import {
  BookingDetailsCard,
  type BookingDetailsCardProps,
  type BookingDetailsSavePayload,
  type BookingQuickActionFeedback,
} from '@/src/components/Booking/BookingDetailsCard';
import { BookingDetailDatetimeModal } from '@/src/components/Booking/BookingDetailDatetimeModal';
import { AlertModal } from '@/src/components/ui/AlertModal';
import { ConfirmModal } from '@/src/components/ui/ConfirmModal';
import type { Booking } from '@/src/types/booking';
import type {
  Department,
  ServiceProvider,
  Service,
} from '@/src/types/booking-entities';
import type { NormalizedIntakeForm } from '@/src/utils/intakeForm';
import type { service_provider_display_source } from '@/src/utils/service_provider_display';
import {
  type workspace_notifications_settings,
  is_whatsapp_admin_enabled,
  is_whatsapp_user_enabled,
} from '@/lib/workspace-notification-flags';
import type { EventType } from '@/src/types/bookingForm';
import {
  LuCircleCheck as CircleCheck,
  LuLoader as LoaderIcon,
} from 'react-icons/lu';

type ReminderSendFeedback =
  | null
  | { channel: 'email' | 'whatsapp'; phase: 'loading' | 'success' };

export function BookingDetailsWithActions({
  booking: initialBooking,
  intakeFormSettings,
  services,
  departments,
  serviceProviders,
  workspace_owner,
  workspace_owner_user_id,
  onBookingUpdated,
}: {
  booking: Booking;
  intakeFormSettings: NormalizedIntakeForm | null;
  services: Service[];
  departments: Department[];
  serviceProviders: ServiceProvider[];
  workspace_owner?: service_provider_display_source | null;
  workspace_owner_user_id?: string | null;
  onBookingUpdated: (booking: Booking) => void;
}) {
  const router = useRouter();
  const { settings } = useWorkspaceSettings();
  const general = settings?.general as Record<string, unknown> | undefined;
  const timezone =
    typeof general?.timezone === 'string' && general.timezone.trim()
      ? general.timezone.trim()
      : null;

  const notif_flat = (
    settings as Record<string, unknown> | undefined
  )?.notifications as Record<string, unknown> | undefined;
  const notifications = notif_flat as workspace_notifications_settings | undefined;

  const wa_admin_ok = is_whatsapp_admin_enabled(notifications ?? null);
  const wa_user_ok = is_whatsapp_user_enabled(notifications ?? null);
  const email_reminder_on =
    typeof notif_flat?.['email-reminder'] === 'boolean'
      ? (notif_flat['email-reminder'] as boolean)
      : true;

  const primary =
    typeof general?.primary_color === 'string'
      ? String(general.primary_color)
      : '#4f46e5';
  const accent =
    typeof general?.accent_color === 'string' ? String(general.accent_color) : null;

  const { data: eventTypesEntities, loading: loadingEventTypes } = useEventTypes();
  const eventTypesBookingForm = useMemo<EventType[]>(() => {
    return (eventTypesEntities || []).map((e) => ({
      id: e.id,
      title: e.title,
      duration_minutes: e.duration_minutes ?? 30,
    }));
  }, [eventTypesEntities]);

  const [booking, setBooking] = useState(initialBooking);
  React.useEffect(() => setBooking(initialBooking), [initialBooking]);

  const [reminder_open, set_reminder_open] = useState(false);
  const [dt_mode, set_dt_mode] = useState<
    'follow_up' | 'reschedule' | null
  >(null);
  const [saving_patch, set_saving_patch] = useState(false);
  const [saving_follow, set_saving_follow] = useState(false);

  const [alert_message, set_alert_message] = useState<string | null>(null);
  const [delete_confirm_open, set_delete_confirm_open] = useState(false);
  const [quick_action_feedback, set_quick_action_feedback] =
    useState<BookingQuickActionFeedback>(null);
  const quick_action_success_clear_ref =
    React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const reminder_success_clear_ref =
    React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reminder_send_feedback, set_reminder_send_feedback] =
    useState<ReminderSendFeedback>(null);

  React.useEffect(() => {
    return () => {
      if (quick_action_success_clear_ref.current) {
        clearTimeout(quick_action_success_clear_ref.current);
      }
      if (reminder_success_clear_ref.current) {
        clearTimeout(reminder_success_clear_ref.current);
      }
    };
  }, []);

  const patch_booking_json = useCallback(
    async (body: Record<string, unknown>) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: booking.id, ...body }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Update failed');
      if (json?.data) onBookingUpdated(json.data as Booking);
      return json?.data as Booking | undefined;
    },
    [booking.id, onBookingUpdated]
  );

  const onSaveAdminNotice: NonNullable<BookingDetailsCardProps['onSaveAdminNotice']> =
    async (notice) => {
      const meta =
        booking.metadata &&
        typeof booking.metadata === 'object' &&
        !Array.isArray(booking.metadata)
          ? { ...(booking.metadata as Record<string, unknown>) }
          : {};
      meta.admin_notice = notice;
      const updated = await patch_booking_json({ metadata: meta });
      if (updated) setBooking(updated);
    };

  const close_reminder_modal = useCallback(() => {
    if (reminder_success_clear_ref.current) {
      clearTimeout(reminder_success_clear_ref.current);
      reminder_success_clear_ref.current = null;
    }
    set_reminder_send_feedback(null);
    set_reminder_open(false);
  }, []);

  const onSendReminder: NonNullable<BookingDetailsCardProps['onSendReminder']> =
    () => {
      if (reminder_success_clear_ref.current) {
        clearTimeout(reminder_success_clear_ref.current);
        reminder_success_clear_ref.current = null;
      }
      set_reminder_send_feedback(null);
      set_reminder_open(true);
    };

  const submit_reminder_email = async () => {
    if (!email_reminder_on) {
      set_alert_message('Email reminders are turned off in workspace notifications.');
      return;
    }
    if (reminder_success_clear_ref.current) {
      clearTimeout(reminder_success_clear_ref.current);
      reminder_success_clear_ref.current = null;
    }
    set_reminder_send_feedback({ channel: 'email', phase: 'loading' });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch(`/api/bookings/${booking.id}/send-reminder`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel: 'email' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        set_reminder_send_feedback(null);
        set_alert_message(json?.error || 'Could not send email reminder.');
        return;
      }
      set_reminder_send_feedback({ channel: 'email', phase: 'success' });
      reminder_success_clear_ref.current = setTimeout(() => {
        close_reminder_modal();
      }, 2000);
    } catch (e: unknown) {
      set_reminder_send_feedback(null);
      set_alert_message(
        e instanceof Error ? e.message : 'Could not send email reminder.'
      );
    }
  };

  const submit_reminder_whatsapp = async () => {
    if (reminder_success_clear_ref.current) {
      clearTimeout(reminder_success_clear_ref.current);
      reminder_success_clear_ref.current = null;
    }
    set_reminder_send_feedback({ channel: 'whatsapp', phase: 'loading' });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');
      const res = await fetch(`/api/bookings/${booking.id}/send-reminder`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ channel: 'whatsapp' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        set_reminder_send_feedback(null);
        set_alert_message(json?.error || 'Could not send WhatsApp reminder.');
        return;
      }
      set_reminder_send_feedback({ channel: 'whatsapp', phase: 'success' });
      reminder_success_clear_ref.current = setTimeout(() => {
        close_reminder_modal();
      }, 2000);
    } catch (e: unknown) {
      set_reminder_send_feedback(null);
      set_alert_message(
        e instanceof Error ? e.message : 'Could not send WhatsApp reminder.'
      );
    }
  };

  const onScheduleFollowUp: NonNullable<BookingDetailsCardProps['onScheduleFollowUp']> =
    () => set_dt_mode('follow_up');

  const onReschedule: NonNullable<BookingDetailsCardProps['onReschedule']> =
    () => set_dt_mode('reschedule');

  const handle_datetime_confirm = useCallback(
    async (payload: { start_at: string; end_at: string; status?: string }) => {
      const mode_now = dt_mode;
      if (!mode_now) return;
      try {
        if (mode_now === 'follow_up') {
          set_saving_follow(true);
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) throw new Error('Not authenticated');

          const baseMeta =
            booking.metadata &&
            typeof booking.metadata === 'object' &&
            !Array.isArray(booking.metadata)
              ? ({ ...(booking.metadata as Record<string, unknown>) } as Record<string, unknown>)
              : {};

          baseMeta.follow_up_from_booking_id = booking.id;

          let booking_status: string = 'pending';
          try {
            const { data: cfg } = await supabase
              .from('configurations')
              .select('settings')
              .eq('workspace_id', booking.workspace_id)
              .maybeSingle();
            if (cfg?.settings?.notifications?.['auto-confirm-booking'] === true) {
              booking_status = 'confirmed';
            }
          } catch {
            /* keep pending */
          }

          const body = {
            event_type_id: booking.event_type_id,
            service_provider_id: booking.service_provider_id,
            department_id: booking.department_id,
            invitee_name: booking.invitee_name?.trim() || 'Invitee',
            invitee_email: booking.invitee_email,
            invitee_phone: booking.invitee_phone,
            start_at: payload.start_at,
            end_at: payload.end_at,
            status: booking_status,
            metadata: Object.keys(baseMeta).length ? baseMeta : null,
            ...(timezone ? { timezone } : {}),
          };

          const res = await fetch('/api/bookings', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
          });
          const json = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(json?.error || 'Failed to schedule follow-up');
          set_dt_mode(null);
          set_alert_message('Follow-up booking created.');
        } else {
          set_saving_patch(true);
          const updated = await patch_booking_json({ ...payload });
          if (updated) setBooking(updated);
          set_dt_mode(null);
          set_alert_message('Booking rescheduled.');
        }
      } catch (e: unknown) {
        set_alert_message(e instanceof Error ? e.message : 'Save failed.');
      } finally {
        set_saving_patch(false);
        set_saving_follow(false);
      }
    },
    [
      booking,
      dt_mode,
      patch_booking_json,
      timezone,
    ]
  );

  const handleSaveBookingDetails = useCallback<
    NonNullable<BookingDetailsCardProps['onSaveBookingDetails']>
  >(
    async (payload: BookingDetailsSavePayload) => {
      try {
        set_saving_patch(true);

        const meta: Record<string, unknown> =
          booking.metadata &&
          typeof booking.metadata === 'object' &&
          !Array.isArray(booking.metadata)
            ? { ...(booking.metadata as Record<string, unknown>) }
            : {};

        const intakeRaw = meta.intake_form;
        const existingIntake: Record<string, unknown> =
          intakeRaw &&
          typeof intakeRaw === 'object' &&
          !Array.isArray(intakeRaw)
            ? { ...(intakeRaw as Record<string, unknown>) }
            : {};

        if (payload.intake_form_services.length > 0) {
          existingIntake.services = payload.intake_form_services;
        } else {
          delete existingIntake.services;
        }

        if (Object.keys(existingIntake).length > 0) {
          meta.intake_form = existingIntake;
        } else {
          delete meta.intake_form;
        }

        const updated = await patch_booking_json({
          department_id: payload.department_id,
          service_provider_id: payload.service_provider_id,
          status: payload.status,
          metadata: meta,
        });
        if (updated) setBooking(updated);
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : 'Could not save booking details.';
        set_alert_message(message);
        throw e instanceof Error ? e : new Error(message);
      } finally {
        set_saving_patch(false);
      }
    },
    [booking.metadata, patch_booking_json]
  );

  const handleSaveInvitee = useCallback<
    NonNullable<BookingDetailsCardProps['onSaveInvitee']>
  >(
    async (payload) => {
      try {
        set_saving_patch(true);
        const updated = await patch_booking_json({
          invitee_name:
            payload.invitee_name.trim() || booking.invitee_name,
          invitee_email: payload.invitee_email.trim() || null,
          invitee_phone: payload.invitee_phone.trim() || null,
        });
        if (updated) setBooking(updated);
      } catch (e: unknown) {
        const message =
          e instanceof Error ? e.message : 'Could not save invitee.';
        set_alert_message(message);
        throw e instanceof Error ? e : new Error(message);
      } finally {
        set_saving_patch(false);
      }
    },
    [booking.invitee_name, patch_booking_json]
  );

  const quick_status = async (
    status: string,
    action: NonNullable<BookingQuickActionFeedback>['action']
  ): Promise<boolean> => {
    if (quick_action_success_clear_ref.current) {
      clearTimeout(quick_action_success_clear_ref.current);
      quick_action_success_clear_ref.current = null;
    }
    try {
      set_quick_action_feedback({ action, phase: 'loading' });
      set_saving_patch(true);
      const updated = await patch_booking_json({ status });
      if (updated) setBooking(updated);
      if (!updated) {
        set_quick_action_feedback(null);
        return false;
      }
      set_quick_action_feedback({ action, phase: 'success' });
      quick_action_success_clear_ref.current = setTimeout(() => {
        set_quick_action_feedback(null);
        quick_action_success_clear_ref.current = null;
      }, 2000);
      return true;
    } catch (e: unknown) {
      set_quick_action_feedback(null);
      set_alert_message(e instanceof Error ? e.message : 'Update failed.');
      return false;
    } finally {
      set_saving_patch(false);
    }
  };

  const handle_soft_delete_confirm = useCallback(async () => {
    try {
      set_saving_patch(true);
      await patch_booking_json({ status: 'deleted' });
      set_delete_confirm_open(false);
      router.push('/bookings');
    } catch (e: unknown) {
      set_delete_confirm_open(false);
      set_alert_message(e instanceof Error ? e.message : 'Could not delete booking.');
    } finally {
      set_saving_patch(false);
    }
  }, [patch_booking_json, router]);

  return (
    <>
      <BookingDetailsCard
        booking={booking}
        variant="page"
        intakeFormSettings={intakeFormSettings}
        services={services}
        departments={departments}
        serviceProviders={serviceProviders}
        workspace_owner={workspace_owner ?? undefined}
        workspace_owner_user_id={workspace_owner_user_id ?? undefined}
        onSaveAdminNotice={onSaveAdminNotice}
        onSendReminder={onSendReminder}
        onScheduleFollowUp={onScheduleFollowUp}
        onShareSummary={undefined}
        onSaveInvitee={handleSaveInvitee}
        onSaveBookingDetails={handleSaveBookingDetails}
        onReschedule={onReschedule}
        onViewActivityLog={() => router.push('/notifications/all')}
        onMarkCompleted={() => void quick_status('completed', 'completed')}
        onMarkNoShow={() => void quick_status('no-show', 'no-show')}
        onCancelBooking={() => void quick_status('cancelled', 'cancelled')}
        quickActionFeedback={quick_action_feedback}
        onDeleteBooking={() => set_delete_confirm_open(true)}
      />

      {reminder_open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-black/40 p-4"
          role="dialog"
          aria-modal
          onClick={() => close_reminder_modal()}
        >
          <div
            className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-slate-900">Send reminder</h3>
            <p className="mt-1 text-sm text-slate-500">
              Uses notification settings for your workspace ({' '}
              <Link href="/notifications" className="text-indigo-600 underline">
                customize
              </Link>
              ).
            </p>
            <div className="mt-5 space-y-3">
              <button
                type="button"
                disabled={
                  !email_reminder_on || reminder_send_feedback !== null
                }
                aria-busy={
                  reminder_send_feedback?.channel === 'email' &&
                  reminder_send_feedback.phase === 'loading'
                }
                onClick={() => void submit_reminder_email()}
                className="flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>Send by Email</span>
                {reminder_send_feedback?.channel === 'email' &&
                  reminder_send_feedback.phase === 'loading' && (
                    <LoaderIcon
                      aria-hidden
                      className="h-5 w-5 shrink-0 animate-spin text-indigo-600"
                    />
                  )}
                {reminder_send_feedback?.channel === 'email' &&
                  reminder_send_feedback.phase === 'success' && (
                    <CircleCheck
                      aria-hidden
                      className="h-5 w-5 shrink-0 text-emerald-600"
                    />
                  )}
              </button>
              <div className="flex flex-wrap items-center gap-2">
                {(wa_admin_ok || wa_user_ok) && (
                  <button
                    type="button"
                    disabled={reminder_send_feedback !== null}
                    aria-busy={
                      reminder_send_feedback?.channel === 'whatsapp' &&
                      reminder_send_feedback.phase === 'loading'
                    }
                    onClick={() => void submit_reminder_whatsapp()}
                    className="flex min-h-[40px] min-w-[160px] items-center justify-between gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span>Send via WhatsApp</span>
                    {reminder_send_feedback?.channel === 'whatsapp' &&
                      reminder_send_feedback.phase === 'loading' && (
                        <LoaderIcon
                          aria-hidden
                          className="h-5 w-5 shrink-0 animate-spin text-white"
                        />
                      )}
                    {reminder_send_feedback?.channel === 'whatsapp' &&
                      reminder_send_feedback.phase === 'success' && (
                        <CircleCheck
                          aria-hidden
                          className="h-5 w-5 shrink-0 text-white"
                        />
                      )}
                  </button>
                )}
                {!(wa_admin_ok || wa_user_ok) && (
                  <button
                    type="button"
                    disabled
                    className="cursor-not-allowed rounded-xl bg-slate-200 px-3 py-2 text-slate-500"
                  >
                    WhatsApp (disabled)
                  </button>
                )}
                {!(wa_admin_ok || wa_user_ok) && (
                  <button
                    type="button"
                    className="text-xs text-indigo-600 underline"
                    onClick={() =>
                      set_alert_message(
                        'Enable WhatsApp for admin or invitees on the Notifications page.'
                      )
                    }
                  >
                    Why disabled?
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              className="mt-6 w-full rounded-lg border border-slate-200 py-2 text-sm text-slate-600 hover:bg-slate-50"
              onClick={() => close_reminder_modal()}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {dt_mode && loadingEventTypes && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-black/40 text-white">
          Loading event types…
        </div>
      )}

      {dt_mode && (
        <BookingDetailDatetimeModal
          open={Boolean(dt_mode)}
          mode={dt_mode === 'follow_up' ? 'follow_up' : 'reschedule'}
          booking={booking}
          departments={departments as unknown[]}
          eventTypes={eventTypesBookingForm}
          intakeForm={intakeFormSettings}
          workspacePrimaryColor={primary}
          workspaceAccentColor={accent}
          clientTimezone={timezone}
          onClose={() => set_dt_mode(null)}
          onConfirm={handle_datetime_confirm}
          saving={
            dt_mode === 'follow_up' ? saving_follow : saving_patch
          }
        />
      )}

      {delete_confirm_open && (
        <ConfirmModal
          title="Delete booking"
          message="Do you want to delete this booking?"
          confirmLabel="Delete"
          cancelLabel="Cancel"
          variant="danger"
          loading={saving_patch}
          onCancel={() => set_delete_confirm_open(false)}
          onConfirm={() => void handle_soft_delete_confirm()}
        />
      )}

      {alert_message !== null && alert_message !== '' && (
        <AlertModal
          message={alert_message}
          onClose={() => set_alert_message(null)}
        />
      )}
    </>
  );
}
