'use client';

import React from 'react';
import {
  capitalize_booking_display_label,
  getEventTypeDurationInner,
} from '@/src/utils/booking';
import {
  get_service_provider_display_name,
  type service_provider_display_source,
} from '@/src/utils/service_provider_display';
import { StatusBadge } from './StatusBadge';

export interface DisplayBooking {
  id: string;
  name: string;
  date: string;
  time: string;
  type: string;
  /** Event type duration when provided by API */
  event_type_duration_minutes?: number | null;
  status: string;
  service_provider_id: string | null;
  service_provider_name: string;
  created_at: string;
  is_viewed: boolean;
  is_reschedule_viewed: boolean;
}

interface BookingTableRowProps {
  displayBooking: DisplayBooking;
  workspace_owner?: service_provider_display_source | null;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function BookingTableRow({
  displayBooking,
  workspace_owner,
  onView,
  onEdit,
  onDelete,
}: BookingTableRowProps) {
  const eventDurationInner = getEventTypeDurationInner(
    displayBooking.event_type_duration_minutes
  );
  const service_provider_display = capitalize_booking_display_label(
    displayBooking.service_provider_id != null &&
      displayBooking.service_provider_id !== ''
      ? displayBooking.service_provider_name
      : get_service_provider_display_name(null, workspace_owner ?? undefined)
  );

  return (
    <tr className="bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
      <td
        className="px-6 py-4 whitespace-nowrap align-middle text-sm"
        data-label="Name"
      >
        <span className="font-medium text-slate-900">
          {displayBooking.name}
          {!displayBooking.is_viewed && (
            <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
              New
            </span>
          )}
          {!displayBooking.is_reschedule_viewed &&
            displayBooking.status.toLowerCase() === 'reschedule' && (
            <span className="ml-2 inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
              Reschedule
            </span>
          )}
        </span>
      </td>
      <td
        className="px-6 py-4 whitespace-nowrap align-middle text-sm"
        data-label="Date-Time"
      >
        <span className="text-slate-700">{displayBooking.date} - {displayBooking.time}</span>
      </td>
      <td
        className="px-6 py-4 whitespace-nowrap align-middle text-sm"
        data-label="Type"
      >
        <span className="text-sm text-slate-500">
          {displayBooking.type}
          {eventDurationInner != null && (
            <span className="text-slate-400"> ({eventDurationInner})</span>
          )}
        </span>
      </td>
      <td
        className="px-6 py-4 whitespace-nowrap align-middle text-sm"
        data-label="Service Provider"
      >
        <span className="text-sm text-slate-500">
          {service_provider_display}
        </span>
      </td>
      <td
        className="px-6 py-4 whitespace-nowrap align-middle text-sm"
        data-label="Status"
      >
        <StatusBadge status={displayBooking.status} />
      </td>
      <td
        className="px-6 py-4 whitespace-nowrap align-middle text-sm"
        data-label="Created At"
      >
        <span className="text-slate-600">{displayBooking.created_at}</span>
      </td>
      <td
        className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium align-middle"
        data-label="Action"
      >
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onView}
            className="inline-flex items-center rounded-md bg-green-50 px-2 py-1 text-xs font-medium text-green-700 inset-ring inset-ring-green-600/20 hover:bg-green-100 cursor-pointer"
          >
            View
          </button>
          <button
            onClick={onEdit}
            className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-700 inset-ring inset-ring-indigo-700/10 hover:bg-indigo-100 cursor-pointer"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 inset-ring inset-ring-red-600/10 hover:bg-red-100 cursor-pointer"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
