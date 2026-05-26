'use client';

import React from 'react';
import { formatDate, formatTime } from '@/src/utils/date';
import type { previous_appointment_times } from '@/src/utils/booking_reschedule';

function format_slot(iso: string): string {
  return `${formatDate(iso)}, ${formatTime(iso)}`;
}

export function PreviousAppointmentTimes({
  times,
  className = '',
}: {
  times: previous_appointment_times;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-amber-200 bg-amber-50 p-4 ${className}`.trim()}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-amber-100">
          <svg
            className="h-4 w-4 text-amber-600"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-sm font-semibold text-amber-800">Previous appointment</p>
          <div className="flex flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-amber-700">Start:</span>
              <span className="text-sm text-amber-900 line-through opacity-80">
                {format_slot(times.previous_start_at)}
              </span>
            </div>
            {times.previous_end_at && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-amber-700">End:</span>
                <span className="text-sm text-amber-900 line-through opacity-80">
                  {format_slot(times.previous_end_at)}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
