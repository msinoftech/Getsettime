'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  LuLoader as LoaderIcon,
  LuPlus as Plus,
  LuSquarePen as SquarePen,
  LuTrash2 as Trash2,
} from 'react-icons/lu';
import { supabase } from '@/lib/supabaseClient';
import { useCreateBookingModal } from '@/src/providers/CreateBookingModalProvider';
import { useWorkspaceSettings } from '@/src/hooks/useWorkspaceSettings';
import {
  useDepartments,
  useServices,
  useServiceProviders,
} from '@/src/hooks/useBookingLookups';
import { normalizeIntakeForm } from '@/src/utils/intakeForm';
import { BookingDetailsWithActions } from '@/src/components/Booking/BookingDetailsWithActions';
import { AlertModal } from '@/src/components/ui/AlertModal';
import { ConfirmModal } from '@/src/components/ui/ConfirmModal';
import type { Booking } from '@/src/types/booking';

type FetchState =
  | { status: 'loading' }
  | { status: 'ready'; booking: Booking }
  | { status: 'error'; message: string }
  | { status: 'not_found' };

/**
 * Unresolved Meta WhatsApp template placeholder ("{{1}}") as it arrives in the
 * route param — usually URL-encoded (`%7B%7B1%7D%7D`), occasionally decoded.
 * Happens when the template URL-button base is misconfigured with a literal {{n}}.
 */
const BOOKING_ID_PLACEHOLDER = '%7B%7B1%7D%7D';
const DECODED_PLACEHOLDER_PATTERN = /\{\{\s*\d+\s*\}\}/g;

/** Remove any encoded/decoded template placeholder from the raw id segment. */
function strip_booking_id_placeholder(rawId: string): string {
  return rawId
    .replaceAll(BOOKING_ID_PLACEHOLDER, '')
    .replace(DECODED_PLACEHOLDER_PATTERN, '')
    .trim();
}

export default function BookingDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const bookingId = params?.id ?? '';

  const [fetch_state, set_fetch_state] = useState<FetchState>({ status: 'loading' });
  const [inline_edit_signal, set_inline_edit_signal] = useState(0);
  const [inline_save_signal, set_inline_save_signal] = useState(0);
  const [toolbar_edit_session, set_toolbar_edit_session] = useState(false);
  const [is_inline_editing, set_is_inline_editing] = useState(false);
  const [inline_save_pending, set_inline_save_pending] = useState(false);
  const [delete_confirm_open, set_delete_confirm_open] = useState(false);
  const [deleting, set_deleting] = useState(false);
  const [alert_message, set_alert_message] = useState<string | null>(null);

  const { open: open_create_booking } = useCreateBookingModal();
  const { settings } = useWorkspaceSettings();
  const { data: departments } = useDepartments();
  const {
    data: serviceProviders,
    workspaceOwner,
    workspaceOwnerUserId,
  } = useServiceProviders();
  const { data: services } = useServices();

  const intakeFormSettings = useMemo(
    () => normalizeIntakeForm(settings?.intake_form),
    [settings?.intake_form]
  );

  const load_booking = useCallback(async () => {
    if (!bookingId) {
      set_fetch_state({ status: 'not_found' });
      return;
    }
    /**
     * Recover from a malformed link produced by a misconfigured WhatsApp template
     * URL button, e.g. "/bookings/%7B%7B1%7D%7D311" → redirect to "/bookings/311".
     */
    const cleanId = strip_booking_id_placeholder(bookingId);
    if (cleanId !== bookingId) {
      if (cleanId) {
        router.replace(`/bookings/${cleanId}`);
        return;
      }
      set_fetch_state({ status: 'not_found' });
      return;
    }
    set_fetch_state({ status: 'loading' });

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      set_fetch_state({ status: 'error', message: 'Not authenticated' });
      return;
    }

    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.status === 404) {
        set_fetch_state({ status: 'not_found' });
        return;
      }

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        set_fetch_state({
          status: 'error',
          message: payload?.error || 'Failed to load booking',
        });
        return;
      }

      const result = await response.json();
      if (!result?.data) {
        set_fetch_state({ status: 'not_found' });
        return;
      }
      set_fetch_state({ status: 'ready', booking: result.data as Booking });
    } catch (error) {
      console.error('Error loading booking:', error);
      set_fetch_state({
        status: 'error',
        message: 'An unexpected error occurred while loading the booking.',
      });
    }
  }, [bookingId, router]);

  useEffect(() => {
    void load_booking();
  }, [load_booking]);

  useEffect(() => {
    if (
      toolbar_edit_session &&
      !is_inline_editing &&
      !inline_save_pending
    ) {
      set_toolbar_edit_session(false);
    }
  }, [toolbar_edit_session, is_inline_editing, inline_save_pending]);

  const is_booking_cancelled =
    fetch_state.status === 'ready' &&
    (fetch_state.booking.status || '').trim().toLowerCase() === 'cancelled';

  const show_toolbar_save =
    !is_booking_cancelled &&
    toolbar_edit_session &&
    (is_inline_editing || inline_save_pending);

  const handle_delete_confirm = useCallback(async () => {
    if (fetch_state.status !== 'ready') return;

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      set_delete_confirm_open(false);
      set_alert_message('Not authenticated');
      return;
    }

    set_deleting(true);
    try {
      const response = await fetch(
        `/api/bookings?id=${encodeURIComponent(fetch_state.booking.id)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (response.ok) {
        set_delete_confirm_open(false);
        router.push('/bookings');
        return;
      }

      const error_data = await response.json().catch(() => null);
      set_delete_confirm_open(false);
      set_alert_message(error_data?.error || 'Failed to delete booking');
    } catch (error) {
      console.error('Error deleting booking:', error);
      set_delete_confirm_open(false);
      set_alert_message('An error occurred while deleting the booking');
    } finally {
      set_deleting(false);
    }
  }, [fetch_state, router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <div className="flex items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <Link
              href="/bookings"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Bookings
            </Link>
            
            <Link
              href="/bookings"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
            >
              All Bookings
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={open_create_booking}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-md shadow-indigo-500/20 transition hover:from-indigo-700 hover:to-violet-700"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add New Booking
            </button>
            {fetch_state.status === 'ready' && (
              <>
                {!is_booking_cancelled && !show_toolbar_save && (
                  <button
                    type="button"
                    onClick={() => {
                      set_toolbar_edit_session(true);
                      set_inline_edit_signal((signal) => signal + 1);
                    }}
                    className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700 transition hover:bg-indigo-100"
                  >
                    <SquarePen className="h-4 w-4" aria-hidden />
                    Edit
                  </button>
                )}
                {show_toolbar_save && (
                  <button
                    type="button"
                    disabled={inline_save_pending}
                    onClick={() =>
                      set_inline_save_signal((signal) => signal + 1)
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {inline_save_pending && (
                      <LoaderIcon
                        aria-hidden
                        className="h-4 w-4 animate-spin"
                      />
                    )}
                    Save
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => set_delete_confirm_open(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-100"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        {fetch_state.status === 'loading' && (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            Loading booking details…
          </div>
        )}

        {fetch_state.status === 'not_found' && (
          <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h1 className="text-xl font-semibold text-slate-800">
              Booking not found
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              The booking you&apos;re looking for doesn&apos;t exist or you
              don&apos;t have access to it.
            </p>
            <Link
              href="/bookings"
              className="mt-6 inline-flex items-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Go to Bookings
            </Link>
          </div>
        )}

        {fetch_state.status === 'error' && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-10 text-center shadow-sm">
            <h1 className="text-xl font-semibold text-red-800">
              Unable to load booking
            </h1>
            <p className="mt-2 text-sm text-red-700">{fetch_state.message}</p>
            <button
              type="button"
              onClick={load_booking}
              className="mt-6 inline-flex items-center rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Try Again
            </button>
          </div>
        )}

        {fetch_state.status === 'ready' && (
          <BookingDetailsWithActions
            booking={fetch_state.booking}
            intakeFormSettings={intakeFormSettings}
            services={services}
            departments={departments}
            serviceProviders={serviceProviders}
            workspace_owner={workspaceOwner}
            workspace_owner_user_id={workspaceOwnerUserId}
            inlineEditSignal={inline_edit_signal}
            inlineSaveSignal={inline_save_signal}
            onInlineEditStateChange={set_is_inline_editing}
            onInlineSavePendingChange={set_inline_save_pending}
            onBookingUpdated={(booking) =>
              set_fetch_state({ status: 'ready', booking })
            }
          />
        )}
      </div>

      {delete_confirm_open && (
        <ConfirmModal
          title="Delete Booking"
          message="Are you sure you want to delete this booking? This action cannot be undone."
          confirmLabel="Delete"
          variant="danger"
          loading={deleting}
          onConfirm={() => void handle_delete_confirm()}
          onCancel={() => set_delete_confirm_open(false)}
        />
      )}

      {alert_message && (
        <AlertModal
          message={alert_message}
          onClose={() => set_alert_message(null)}
        />
      )}
    </div>
  );
}
