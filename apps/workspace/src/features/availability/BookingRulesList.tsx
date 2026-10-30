"use client";

import type { ReactNode } from "react";
import {
  LuBell as Bell,
  LuCalendar as Calendar,
  LuChevronRight as ChevronRight,
  LuSquarePen as SquarePen,
  LuCircleX as CircleX,
  LuClock as Clock,
  LuGrid2X2 as Grid,
  LuPencil as Pencil,
  LuSlidersHorizontal as Sliders,
  LuUser as User,
  LuUsers as Users,
} from "react-icons/lu";
import type {
  booking_rules,
  booking_rules_edit_target,
  booking_rules_event_type_row,
} from "@/src/types/booking_rules";
import {
  EVENT_TYPE_OVERRIDE_BADGE_CLASSES,
  format_customer_limit,
  format_deadline_label,
  format_duration_minutes,
  format_notice_short,
  format_on_off,
} from "@/src/features/availability/booking_rules";
import ScreenGate from "@/src/components/ScreenGate";

type BookingRulesListProps = {
  rules: booking_rules;
  eventTypes: booking_rules_event_type_row[];
  loadingEventTypes?: boolean;
  readOnly?: boolean;
  onEdit: (target: booking_rules_edit_target) => void;
};

function RuleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="text-sm font-semibold text-slate-900">{value}</dd>
    </div>
  );
}

function RuleCategoryCard({
  number,
  icon,
  title,
  children,
  onEdit,
  readOnly,
}: {
  number: number;
  icon: ReactNode;
  title: string;
  children: ReactNode;
  onEdit?: () => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:gap-5 sm:p-5">
      <div className="flex min-w-0 flex-1 items-center sm:items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-1">
            <h3 className="text-sm font-bold text-slate-900 sm:text-base">
              <span>{number}.</span> {title}
            </h3>
            {!readOnly && onEdit ? (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex w-fit items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 cursor-pointer"
              >
                <SquarePen className="h-4 w-4" />
                Edit
              </button>
            ) : null}
          </div>

          <ScreenGate minWidth={640}>
          <dl className="mt-3 grid grid-cols-1 min-[400px]:grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-3 lg:grid-cols-4">
            {children}
          </dl>
          </ScreenGate>
        </div>
      </div>

      <ScreenGate maxWidth={639}>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {children}
      </dl>
      </ScreenGate>
    </div>
  );
}

function SummaryChip({
  icon,
  label,
}: {
  icon: ReactNode;
  label: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-4 py-2 text-xs font-semibold text-indigo-600 border border-indigo-200">
      {icon}
      {label}
    </span>
  );
}

export function BookingRulesList({
  rules,
  eventTypes,
  loadingEventTypes = false,
  readOnly = false,
  onEdit,
}: BookingRulesListProps) {
  return (
    <div className="space-y-5 mt-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">
            Booking Rules
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Control global booking behavior and per event-type rules.
          </p>
        </div>
        {!readOnly ? (
          <button
            type="button"
            onClick={() => onEdit({ kind: "global" })}
            className="inline-flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4 text-slate-500" />
            Edit Global Rules
          </button>
        ) : null}
      </div>

      <div className="space-y-3">
        <RuleCategoryCard
          number={1}
          icon={<Clock className="h-5 w-5" />}
          title="Global Slot Defaults"
          readOnly={readOnly}
          onEdit={() => onEdit({ kind: "slot_defaults" })}
        >
          <RuleRow
            label="Default duration"
            value={format_duration_minutes(rules.default_duration_minutes)}
          />
          <RuleRow
            label="Slot interval"
            value={`Every ${rules.slot_interval_minutes} min`}
          />
          <RuleRow
            label="Buffer before"
            value={format_duration_minutes(rules.buffer_before_minutes)}
          />
          <RuleRow
            label="Buffer after"
            value={format_duration_minutes(rules.buffer_after_minutes)}
          />
        </RuleCategoryCard>

        <RuleCategoryCard
          number={2}
          icon={<Calendar className="h-5 w-5" />}
          title="Advance Booking"
          readOnly={readOnly}
          onEdit={() => onEdit({ kind: "advance_booking" })}
        >
          <RuleRow
            label="Minimum notice"
            value={format_duration_minutes(rules.min_notice_minutes)}
          />
          <RuleRow
            label="Booking window"
            value={`${rules.booking_window_days} days ahead`}
          />
          <RuleRow
            label="Prevent same-day bookings"
            value={format_on_off(rules.prevent_same_day_bookings)}
          />
        </RuleCategoryCard>

        <RuleCategoryCard
          number={3}
          icon={<Users className="h-5 w-5" />}
          title="Limits & Capacity"
          readOnly={readOnly}
          onEdit={() => onEdit({ kind: "limits" })}
        >
          <RuleRow
            label="Max bookings per day"
            value={String(rules.max_bookings_per_day)}
          />
          <RuleRow
            label="Max bookings per customer"
            value={format_customer_limit(
              rules.max_bookings_per_customer,
              rules.max_bookings_per_customer_period
            )}
          />
          <RuleRow
            label="Allow back-to-back bookings"
            value={format_on_off(rules.allow_back_to_back)}
          />
        </RuleCategoryCard>

        <RuleCategoryCard
          number={4}
          icon={<User className="h-5 w-5" />}
          title="Customer Actions"
          readOnly={readOnly}
          onEdit={() => onEdit({ kind: "customer_actions" })}
        >
          <RuleRow
            label="Allow cancellation"
            value={format_on_off(rules.allow_cancellation)}
          />
          <RuleRow
            label="Cancellation deadline"
            value={format_deadline_label(rules.cancellation_deadline_minutes)}
          />
          <RuleRow
            label="Allow rescheduling"
            value={format_on_off(rules.allow_reschedule)}
          />
          <RuleRow
            label="Reschedule deadline"
            value={format_deadline_label(rules.reschedule_deadline_minutes)}
          />
          <RuleRow
            label="Require manual approval"
            value={format_on_off(rules.require_manual_approval)}
          />
        </RuleCategoryCard>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start gap-3 border-b border-slate-200 px-4 py-4 sm:px-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
              <Sliders className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 sm:text-base">
                <span>5.</span> Event Type Overrides
              </h3>
              <p className="mt-0.5 text-sm text-slate-500">
                Customize duration, buffers, and notice by event type.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto p-4 min-[1301px]:p-0">
            {/* Mobile view */}
            <ScreenGate maxWidth={1023}>
            <div className="space-y-3">
                {loadingEventTypes ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                    Loading event types…
                  </div>
                ) : eventTypes.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                    No event types yet. Create one to add overrides.
                  </div>
                ) : (
                  eventTypes.map((row, index) => {
                    const badge =
                      EVENT_TYPE_OVERRIDE_BADGE_CLASSES[
                        index % EVENT_TYPE_OVERRIDE_BADGE_CLASSES.length
                      ];

                    const before = row.buffer_before ?? 0;
                    const after = row.buffer_after ?? 0;

                    return (
                      <div
                        key={row.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
                              Event Type
                            </p>

                            <h3 className="mt-1 truncate text-sm font-semibold text-slate-900">
                              {row.title}
                            </h3>
                          </div>
                          
                          {/* desktop */}
                          <ScreenGate minWidth={640}>
                            <div>
                              <div className="text-left">
                                <p className="mt-1 text-sm text-slate-600">Before / After</p>
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badge}`}>
                                  {before} / {after} min
                                </span>
                              </div>

                              <span className="text-sm font-medium text-slate-700">
                                {format_duration_minutes(
                                  row.min_booking_notice_minutes
                                )}
                              </span>

                            </div>
                          </ScreenGate>

                          <span
                            className={`shrink-0 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badge}`}
                          >
                            {format_duration_minutes(row.duration_minutes ?? 0)}
                          </span>
                        </div>
                        
                        {/* Mobile */}
                        <ScreenGate maxWidth={639}>
                          <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                            {/* Buffer */}
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-sm font-medium text-slate-500">Before / After</span>

                              <div className="text-right">
                                <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badge}`}>
                                  {before} / {after} min
                                </span>
                              </div>
                            </div>

                            {/* Minimum Notice */}
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-sm font-medium text-slate-500">Minimum Notice</span>

                              <span className="text-sm font-medium text-slate-700">
                                {format_duration_minutes(
                                  row.min_booking_notice_minutes
                                )}
                              </span>
                            </div>
                          </div>
                        </ScreenGate>

                        {/* Action */}
                        <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
                          {!readOnly ? (
                            <button
                              type="button"
                              onClick={() =>
                                onEdit({
                                  kind: "event_type",
                                  event_type_id: row.id,
                                  title: row.title,
                                  duration_minutes: row.duration_minutes,
                                  buffer_before: row.buffer_before,
                                  buffer_after: row.buffer_after,
                                  min_booking_notice_minutes:
                                    row.min_booking_notice_minutes,
                                })
                              }
                              className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 cursor-pointer"
                            >
                              <SquarePen className="h-4 w-4" />
                              Edit
                            </button>
                          ) : (
                            <div className="text-center text-xs text-slate-400">
                              View only
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </ScreenGate>

            {/* Desktop view */}
            <ScreenGate minWidth={1024}>
              <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                <thead className="bg-slate-100 text-xs font-semibold tracking-wide text-slate-500">
                  <tr className="text-left text-sm text-slate-900">
                    <th className="px-6 py-4 font-semibold">Event Type</th>
                    <th className="px-6 py-4 font-semibold">Duration</th>
                    <th className="px-6 py-4 font-semibold">Buffer (Before / After)</th>
                    <th className="px-6 py-4 font-semibold">Minimum Notice</th>
                    <th className="px-6 py-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loadingEventTypes ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5"
                      >
                        Loading event types…
                      </td>
                    </tr>
                  ) : eventTypes.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5"
                      >
                        No event types yet. Create one to add overrides.
                      </td>
                    </tr>
                  ) : (
                    eventTypes.map((row, index) => {
                      const badge =
                        EVENT_TYPE_OVERRIDE_BADGE_CLASSES[
                          index % EVENT_TYPE_OVERRIDE_BADGE_CLASSES.length
                        ];
                      const before = row.buffer_before ?? 0;
                      const after = row.buffer_after ?? 0;
                      return (
                        <tr key={row.id} className="transition-colors hover:bg-slate-50">
                          <td className="px-6 py-4 font-semibold text-slate-900 sm:px-5 border-b border-slate-100" data-label="Event Type">
                            {row.title}
                          </td>
                          <td className="px-6 py-4 sm:px-5 border-b border-slate-100" data-label="Duration">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badge}`}
                            >
                              {format_duration_minutes(row.duration_minutes ?? 0)}
                            </span>
                          </td>
                          <td className="px-6 py-4 sm:px-5 border-b border-slate-100" data-label="Buffer (Before / After)">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${badge}`}
                            >
                              {before} / {after} min
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-700 sm:px-5 border-b border-slate-100" data-label="Minimum Notice">
                            {format_duration_minutes(row.min_booking_notice_minutes)}
                          </td>
                          <td className="px-6 py-4 text-right sm:px-5 border-b border-slate-100" data-label="Action">
                            {!readOnly ? (
                              <button
                                type="button"
                                onClick={() =>
                                  onEdit({
                                    kind: "event_type",
                                    event_type_id: row.id,
                                    title: row.title,
                                    duration_minutes: row.duration_minutes,
                                    buffer_before: row.buffer_before,
                                    buffer_after: row.buffer_after,
                                    min_booking_notice_minutes:
                                      row.min_booking_notice_minutes,
                                  })
                                }
                                className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 cursor-pointer"
                              >
                                <SquarePen className="h-4 w-4" />
                                Edit
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">View only</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </ScreenGate>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <h3 className="text-sm font-bold text-slate-900">Current Rule Summary</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <SummaryChip
            icon={<Clock className="h-3.5 w-3.5" />}
            label={`Default ${format_duration_minutes(rules.default_duration_minutes)}`}
          />
          <SummaryChip
            icon={<Grid className="h-3.5 w-3.5" />}
            label={`${rules.slot_interval_minutes} min interval`}
          />
          <SummaryChip
            icon={<Bell className="h-3.5 w-3.5" />}
            label={format_notice_short(rules.min_notice_minutes)}
          />
          <SummaryChip
            icon={<Calendar className="h-3.5 w-3.5" />}
            label={`${rules.booking_window_days}-day window`}
          />
          <SummaryChip
            icon={<CircleX className="h-3.5 w-3.5" />}
            label={`${format_duration_minutes(rules.cancellation_deadline_minutes).replace(" hours", "h").replace(" hour", "h")} cancellation`}
          />
          <SummaryChip
            icon={<User className="h-3.5 w-3.5" />}
            label={`Manual approval ${rules.require_manual_approval ? "on" : "off"}`}
          />
        </div>
      </div>
    </div>
  );
}
