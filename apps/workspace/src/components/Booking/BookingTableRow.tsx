'use client';

import React from 'react';
import { StatusBadge } from './StatusBadge';

export interface DisplayBooking {
  id: string;
  name: string;
  date: string;
  time: string;
  type: string;
  status: string;
  service_provider_name: string;
  created_at: string;
}

interface BookingTableRowProps {
  displayBooking: DisplayBooking;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function BookingTableRow({
  displayBooking,
  onView,
  onEdit,
  onDelete,
}: BookingTableRowProps) {
  return (
    <tr className="bg-white border border-slate-200 hover:bg-slate-50 transition-colors">
      <td
        className="px-6 py-4 whitespace-nowrap align-middle text-sm"
        data-label="Name"
      >
        <span className="font-medium text-slate-900">{displayBooking.name}</span>
      </td>
      <td
        className="px-6 py-4 whitespace-nowrap align-middle text-sm"
        data-label="Date-Time"
      >
        <span className="text-slate-700">{displayBooking.date} - {displayBooking.time}</span>
        <span className="text-slate-700"></span>
      </td>
      <td
        className="px-6 py-4 whitespace-nowrap align-middle text-sm"
        data-label="Type"
      >
        <span className="text-sm text-slate-500">{displayBooking.type}</span>
      </td>
      <td
        className="px-6 py-4 whitespace-nowrap align-middle text-sm"
        data-label="Service Provider"
      >
        <span className="text-sm text-slate-500">
          {displayBooking.service_provider_name}
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
