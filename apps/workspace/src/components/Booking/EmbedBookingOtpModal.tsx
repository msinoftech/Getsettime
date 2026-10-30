'use client';

import React, { useEffect, useState } from 'react';

interface EmbedBookingOtpModalProps {
  open: boolean;
  workspaceId: number | string;
  name: string;
  email: string;
  phone: string;
  onClose: () => void;
  onVerified: (verificationToken: string) => void;
}

export function EmbedBookingOtpModal({
  open,
  workspaceId,
  name,
  email,
  phone,
  onClose,
  onVerified,
}: EmbedBookingOtpModalProps) {
  const [otpCode, setOtpCode] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockedOut, setLockedOut] = useState(false);

  useEffect(() => {
    if (!open) {
      setOtpCode('');
      setSent(false);
      setLoading(false);
      setError('');
      setLockedOut(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSend = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/embed/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          phone,
          email,
          name,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to send verification code');
        if (res.status === 429 || data.lockout) setLockedOut(true);
        return;
      }
      setSent(true);
    } catch {
      setError('Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (otpCode.length !== 6) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/embed/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          phone,
          email,
          code: otpCode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid verification code');
        if (res.status === 429 || data.lockout) setLockedOut(true);
        return;
      }
      if (typeof data.verification_token === 'string') {
        onVerified(data.verification_token);
      } else {
        setError('Verification failed. Please try again.');
      }
    } catch {
      setError('Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="embed-otp-title"
      >
        <h2 id="embed-otp-title" className="text-lg font-semibold text-gray-900">
          Verify your booking
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          We will send a 6-digit code to your WhatsApp number and email. Enter the code to confirm
          your booking.
        </p>

        {error && (
          <div
            className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
              lockedOut
                ? 'border-amber-300 bg-amber-50 text-amber-900'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {error}
          </div>
        )}

        <div className="mt-4 space-y-3 text-sm text-gray-700">
          <p>
            <span className="font-medium">Email:</span> {email}
          </p>
          <p>
            <span className="font-medium">Phone:</span> {phone}
          </p>
        </div>

        {!sent ? (
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={loading || lockedOut}
              onClick={() => void handleSend()}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send verification code'}
            </button>
          </div>
        ) : (
          <div className="mt-6">
            <label htmlFor="embed-otp-code" className="mb-1 block text-sm font-medium text-gray-700">
              6-digit code
            </label>
            <input
              id="embed-otp-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={lockedOut}
              className="mb-4 block w-full rounded-lg border border-gray-300 px-4 py-2.5 text-center text-xl tracking-[0.3em] focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-gray-100"
              autoFocus
            />
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                disabled={loading || lockedOut}
                onClick={() => void handleSend()}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
              >
                Resend code
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={loading || lockedOut || otpCode.length !== 6}
                  onClick={() => void handleVerify()}
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {loading ? 'Verifying…' : 'Verify & continue'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
