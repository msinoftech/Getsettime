'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { useWorkspaceSettings } from '@/src/hooks/useWorkspaceSettings';
import {
  useDepartments,
  useServices,
  useServiceProviders,
} from '@/src/hooks/useBookingLookups';
import { normalizeIntakeForm } from '@/src/utils/intakeForm';
import { BookingDetailsWithActions } from '@/src/components/Booking/BookingDetailsWithActions';
import type { Booking } from '@/src/types/booking';

type FetchState =
  | { status: 'loading' }
  | { status: 'ready'; booking: Booking }
  | { status: 'error'; message: string }
  | { status: 'not_found' };

export default function BookingDetailsPage() {
  const params = useParams<{ id: string }>();
  const bookingId = params?.id ?? '';

  const [fetch_state, set_fetch_state] = useState<FetchState>({ status: 'loading' });

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
  }, [bookingId]);

  useEffect(() => {
    void load_booking();
  }, [load_booking]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-5">
        <div className="flex items-center justify-between gap-3 print:hidden">
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
            onBookingUpdated={(booking) =>
              set_fetch_state({ status: 'ready', booking })
            }
          />
        )}
      </div>
    </div>
  );
}
