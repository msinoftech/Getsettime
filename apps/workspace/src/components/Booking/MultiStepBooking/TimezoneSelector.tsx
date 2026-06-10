'use client';

import React from 'react';
import { getCustomerTimezoneOptions } from '@/src/constants/timezone';
import { needsTimezoneConversion } from '@/src/utils/timezone';

interface TimezoneSelectorProps {
  customerTimezone: string;
  providerTimezone: string;
  workspaceTimezoneConfigured: boolean;
  onTimezoneChange: (timezone: string) => void;
  disabled?: boolean;
}

export function TimezoneSelector({
  customerTimezone,
  providerTimezone,
  workspaceTimezoneConfigured,
  onTimezoneChange,
  disabled = false,
}: TimezoneSelectorProps) {
  const options = getCustomerTimezoneOptions(customerTimezone);
  const showDual = needsTimezoneConversion(providerTimezone, customerTimezone);

  return (
    <div className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <label className="text-xs sm:text-sm font-semibold text-gray-700">
          Viewing availability in
        </label>
        <select
          value={customerTimezone}
          onChange={(e) => onTimezoneChange(e.target.value)}
          disabled={disabled}
          className="h-10 w-full sm:w-auto min-w-[200px] rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
        >
          {options.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </div>
      {workspaceTimezoneConfigured && showDual ? (
        <p className="text-xs text-gray-500">
          Host timezone: <span className="font-medium text-gray-700">{providerTimezone}</span>
        </p>
      ) : null}
      {!workspaceTimezoneConfigured ? (
        <p className="text-xs text-gray-500">
          Host timezone: <span className="font-medium text-gray-700">Same as yours</span>
        </p>
      ) : null}
    </div>
  );
}
