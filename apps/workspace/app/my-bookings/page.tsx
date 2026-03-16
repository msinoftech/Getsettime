'use client';

import React, { useState, useCallback } from 'react';
import { type public_booking } from '@/src/types/public_booking';

type Step = 'phone_input' | 'otp_verify' | 'bookings_list';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
  emergency: 'bg-orange-100 text-orange-800',
  reschedule: 'bg-purple-100 text-purple-800',
};

function formatDate(dateString: string | null): string {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(dateString: string | null): string {
  if (!dateString) return '';
  return new Date(dateString).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

const ITEMS_PER_PAGE = 10;

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function MyBookingsPage() {
  const [step, setStep] = useState<Step>('phone_input');
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [token, setToken] = useState('');
  const [bookings, setBookings] = useState<public_booking[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 0,
  });
  const [selectedBooking, setSelectedBooking] = useState<public_booking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  const startCooldown = useCallback(() => {
    setCooldown(30);
    const interval = setInterval(() => {
      setCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim() || loading) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/my-bookings/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to send OTP');
        return;
      }

      setStep('otp_verify');
      startCooldown();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || loading) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/my-bookings/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim(), code: otpCode.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Verification failed');
        return;
      }

      setToken(data.token);
      await fetchBookings(data.token);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBookings = async (sessionToken: string, page = 1) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch(
        `/api/my-bookings?page=${page}&limit=${ITEMS_PER_PAGE}`,
        { headers: { Authorization: `Bearer ${sessionToken}` } }
      );
      const data = await res.json();

      if (res.status === 401) {
        setError('Session expired. Please verify your phone again.');
        setStep('phone_input');
        setToken('');
        setOtpCode('');
        return;
      }

      if (!res.ok) {
        setError(data.error || 'Failed to load bookings');
        return;
      }

      setBookings(data.data || []);
      if (data.pagination) setPagination(data.pagination);
      setStep('bookings_list');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const goToPage = (page: number) => {
    if (!token || page < 1 || page > pagination.totalPages) return;
    fetchBookings(token, page);
  };

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/my-bookings/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to resend code');
        return;
      }
      startCooldown();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartOver = () => {
    setStep('phone_input');
    setPhone('');
    setOtpCode('');
    setToken('');
    setBookings([]);
    setPagination({ page: 1, limit: ITEMS_PER_PAGE, total: 0, totalPages: 0 });
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">GetSetTime</h1>
          <p className="mt-2 text-gray-600">
            Verify your phone number to view your bookings
          </p>
        </div>

        {error && (
          <div className="mx-auto mb-6 max-w-md rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === 'phone_input' && (
          <div className="mx-auto max-w-md">
            <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
              <h2 className="mb-1 text-lg font-semibold text-gray-900">
                Enter your phone number
              </h2>
              <p className="mb-6 text-sm text-gray-500">
                We&apos;ll send a verification code via SMS
              </p>
              <form onSubmit={handleSendOtp}>
                <label
                  htmlFor="phone"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Phone number
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="mb-4 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                  required
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading || !phone.trim()}
                  className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Send Verification Code'}
                </button>
              </form>
            </div>
          </div>
        )}

        {step === 'otp_verify' && (
          <div className="mx-auto max-w-md">
            <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
              <h2 className="mb-1 text-lg font-semibold text-gray-900">
                Enter verification code
              </h2>
              <p className="mb-6 text-sm text-gray-500">
                Code sent to <span className="font-medium">{phone}</span>
              </p>
              <form onSubmit={handleVerifyOtp}>
                <label
                  htmlFor="otp"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  6-digit code
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) =>
                    setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  placeholder="000000"
                  className="mb-4 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-center text-2xl tracking-[0.3em] text-gray-900 placeholder-gray-400 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 focus:outline-none"
                  required
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={loading || otpCode.length < 6}
                  className="w-full rounded-lg bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? 'Verifying...' : 'Verify & View Bookings'}
                </button>
              </form>
              <div className="mt-4 flex items-center justify-between text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setStep('phone_input');
                    setOtpCode('');
                    setError('');
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  Change number
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || loading}
                  className="text-purple-600 hover:text-purple-700 disabled:text-gray-400"
                >
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'bookings_list' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Showing bookings for{' '}
                <span className="font-medium">{phone}</span>
              </p>
              <button
                type="button"
                onClick={handleStartOver}
                className="text-sm text-purple-600 hover:text-purple-700"
              >
                Verify another number
              </button>
            </div>

            {loading ? (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 font-medium text-gray-600">Booking ID</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Date &amp; Time</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Event Type</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Business</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Status</th>
                        <th className="px-4 py-3 font-medium text-gray-600">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          <td className="px-4 py-3"><div className="h-4 w-16 animate-pulse rounded bg-gray-200" /></td>
                          <td className="px-4 py-3"><div className="h-4 w-28 animate-pulse rounded bg-gray-200" /></td>
                          <td className="px-4 py-3">
                            <div className="mb-1.5 h-4 w-24 animate-pulse rounded bg-gray-200" />
                            <div className="h-3 w-20 animate-pulse rounded bg-gray-200" />
                          </td>
                          <td className="px-4 py-3"><div className="h-4 w-20 animate-pulse rounded bg-gray-200" /></td>
                          <td className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-gray-200" /></td>
                          <td className="px-4 py-3"><div className="h-5 w-16 animate-pulse rounded-full bg-gray-200" /></td>
                          <td className="px-4 py-3"><div className="h-6 w-12 animate-pulse rounded bg-gray-200" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : bookings.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
                <p className="text-lg font-medium text-gray-700">
                  No bookings found
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  No bookings are associated with this phone number.
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-gray-200 bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 font-medium text-gray-600">
                          Booking ID
                        </th>
                        <th className="px-4 py-3 font-medium text-gray-600">
                          Name
                        </th>
                        <th className="px-4 py-3 font-medium text-gray-600">
                          Date &amp; Time
                        </th>
                        <th className="px-4 py-3 font-medium text-gray-600">
                          Event Type
                        </th>
                        <th className="px-4 py-3 font-medium text-gray-600">
                          Business
                        </th>
                        <th className="px-4 py-3 font-medium text-gray-600">
                          Status
                        </th>
                        <th className="px-4 py-3 font-medium text-gray-600">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {bookings.map((booking) => (
                        <tr key={booking.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">
                            {String(booking.id).slice(0, 8)}
                          </td>
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {booking.invitee_name || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            <div>{formatDate(booking.start_at)}</div>
                            <div className="text-xs text-gray-500">
                              {formatTime(booking.start_at)}
                              {booking.end_at &&
                                ` - ${formatTime(booking.end_at)}`}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {booking.event_type_title || 'N/A'}
                          </td>
                          <td className="px-4 py-3 text-gray-700">
                            {booking.workspace_name || 'N/A'}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                                STATUS_COLORS[booking.status || ''] ||
                                'bg-gray-100 text-gray-700'
                              }`}
                            >
                              {booking.status || 'Pending'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setSelectedBooking(booking)}
                              className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 hover:bg-green-100"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500">
                  <span>
                    {pagination.total} booking
                    {pagination.total !== 1 ? 's' : ''} found
                  </span>
                  <button
                    type="button"
                    onClick={() => token && fetchBookings(token, pagination.page)}
                    disabled={loading}
                    className="text-purple-600 hover:text-purple-700 disabled:text-gray-400"
                  >
                    {loading ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
              </div>
            )}

            {pagination.totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => goToPage(pagination.page - 1)}
                  disabled={pagination.page <= 1 || loading}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    const current = pagination.page;
                    return p === 1 || p === pagination.totalPages || Math.abs(p - current) <= 1;
                  })
                  .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === 'ellipsis' ? (
                      <span key={`e-${idx}`} className="px-1 text-sm text-gray-400">
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        onClick={() => goToPage(item)}
                        disabled={loading}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                          item === pagination.page
                            ? 'bg-purple-600 text-white'
                            : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
                <button
                  type="button"
                  onClick={() => goToPage(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages || loading}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {selectedBooking && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40"
            onClick={() => setSelectedBooking(null)}
          >
            <div
              className="relative mx-4 my-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="sticky top-0 flex items-center justify-between rounded-t-xl border-b border-slate-200 bg-white px-6 py-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-800">
                    Booking Details
                  </h3>
                  {selectedBooking.created_at && (
                    <p className="mt-0.5 text-xs text-slate-500">
                      Created on {formatDate(selectedBooking.created_at)} at{' '}
                      {formatTime(selectedBooking.created_at)}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedBooking(null)}
                  className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close dialog"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6 p-6">
                <div>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Invitee Information
                  </h4>
                  <div className="space-y-3">
                    <DetailRow label="Name" value={selectedBooking.invitee_name || 'N/A'} />
                    <DetailRow label="Email" value={selectedBooking.invitee_email || 'N/A'} />
                    <DetailRow label="Phone" value={selectedBooking.invitee_phone || 'N/A'} />
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Booking Details
                  </h4>
                  <div className="space-y-3">
                    <DetailRow label="Booking ID" value={String(selectedBooking.id)} mono />
                    <DetailRow label="Event Type" value={selectedBooking.event_type_title || 'N/A'} />
                    <div className="flex flex-col sm:flex-row sm:items-center">
                      <span className="w-32 text-sm font-medium text-slate-600">Status:</span>
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-medium capitalize ${
                          STATUS_COLORS[selectedBooking.status || ''] || 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {selectedBooking.status || 'Pending'}
                      </span>
                    </div>
                    <DetailRow label="Business" value={selectedBooking.workspace_name || 'N/A'} />
                  </div>
                </div>

                <div>
                  <h4 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Date &amp; Time
                  </h4>
                  <div className="space-y-3">
                    <DetailRow
                      label="Start"
                      value={`${formatDate(selectedBooking.start_at)}, ${formatTime(selectedBooking.start_at)}`}
                    />
                    {selectedBooking.end_at && (
                      <DetailRow
                        label="End"
                        value={`${formatDate(selectedBooking.end_at)}, ${formatTime(selectedBooking.end_at)}`}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center">
      <span className="w-32 text-sm font-medium text-slate-600">{label}:</span>
      <span className={`text-slate-800 ${mono ? 'font-mono text-sm' : ''}`}>{value}</span>
    </div>
  );
}
