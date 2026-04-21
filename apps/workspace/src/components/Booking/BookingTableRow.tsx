'use client';

import React from 'react';
import Link from 'next/link';
import {
  LuEye as Eye,
  LuSquarePen as SquarePen,
  LuTrash2 as Trash2,
  LuUserRound as UserRound,
  LuBriefcaseMedical as BriefcaseMedical,
} from 'react-icons/lu';
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
  /**
   * Human-readable creator of the booking. `admin` = a workspace user created
   * it (name resolved from auth metadata). `guest` = created through the
   * public embed form (we fall back to the invitee's name).
   */
  created_by: {
    name: string;
    type: 'admin' | 'guest';
  };
  is_viewed: boolean;
  is_reschedule_viewed: boolean;
}

interface BookingTableRowProps {
  displayBooking: DisplayBooking;
  workspace_owner?: service_provider_display_source | null;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isLast?: boolean;
}

export function BookingTableRow({
  displayBooking,
  workspace_owner,
  onView,
  onEdit,
  onDelete,
  isLast = false,
}: BookingTableRowProps) {
  const eventDurationInner = getEventTypeDurationInner(
    displayBooking.event_type_duration_minutes
  );
  const service_provider_display =
    displayBooking.service_provider_id != null &&
    displayBooking.service_provider_id !== ''
      ? capitalize_booking_display_label(displayBooking.service_provider_name)
      : get_service_provider_display_name(null, workspace_owner ?? undefined);

  return (
    <tr
      className={`transition hover:bg-slate-50/70 ${
        isLast ? '' : 'border-b border-slate-100'
      }`}
    >
      <td className="px-6 py-5 align-middle" data-label="Name">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600">
            <UserRound className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900">
                {capitalize_booking_display_label(displayBooking.name)}
              </span>
              {!displayBooking.is_viewed && (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700">
                  New
                </span>
              )}
              {!displayBooking.is_reschedule_viewed &&
                displayBooking.status.toLowerCase() === 'reschedule' && (
                  <span className="inline-flex items-center rounded-full bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-800">
                    Reschedule
                  </span>
                )}
            </div>
          </div>
        </div>
      </td>

      <td
        className="px-6 py-5 align-middle text-sm"
        data-label="Date-Time"
      >
        <div className="flex flex-col">
          <span className="whitespace-nowrap font-medium text-slate-800">
            {displayBooking.date} - {displayBooking.time}
          </span>
          <span className="text-xs text-slate-500">
            {displayBooking.type}
            {eventDurationInner != null && (
              <span className="text-slate-400"> ({eventDurationInner})</span>
            )}
          </span>
        </div>
      </td>

      <td className="px-6 py-5 align-middle" data-label="Service Provider">
        <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700">
          <BriefcaseMedical className="h-3.5 w-3.5" />
          {service_provider_display}
        </span>
      </td>

      <td
        className="px-6 py-5 align-middle text-sm"
        data-label="Created At / Status"
      >
        <div className="flex flex-col gap-1">
          <span className="whitespace-nowrap font-medium text-slate-800">
            {displayBooking.created_at}
          </span>
          <StatusBadge status={displayBooking.status} className="w-fit" />
        </div>
      </td>

      <td
        className="px-6 py-5 whitespace-nowrap text-right text-sm font-medium align-middle"
        data-label="Action"
      >
        <div className="flex items-center justify-end gap-2">
          <Link
            href={`/bookings/${displayBooking.id}`}
            onClick={onView}
            className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 cursor-pointer"
            aria-label="View booking"
          >
            <Eye className="h-4 w-4" />
            View
          </Link>
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 cursor-pointer"
            aria-label="Edit booking"
          >
            <SquarePen className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 transition hover:bg-rose-100 cursor-pointer"
            aria-label="Delete booking"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
