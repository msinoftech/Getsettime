"use client";
import { useState } from "react";
import { LuMonitor, LuUser, LuUsers } from "react-icons/lu";
import { parse_event_type_format } from "@/src/features/event-types/event_type_format";
import type { event_type_format, event_type_status } from "@/src/types/event_types";
import { EventTypeAssignedProviders } from "@/src/features/event-types/EventTypeAssignedProviders";
import { useServiceProviders } from "@/src/hooks/useBookingLookups";
import ScreenGate from "@/src/components/ScreenGate";
import type { event_type_assignment_fields } from "@/src/utils/bookingFormUtils";

export type event_type_list_item = event_type_assignment_fields & {
  id: number;
  title: string;
  slug: string;
  duration_minutes: number | null;
  location_type: string | null;
  settings: unknown;
  status?: string | null;
  event_type_format?: string | null;
};

type EventTypeListMobileCardsProps = {
  items: event_type_list_item[];
  format_duration_label: (minutes: number | null) => string;
  get_status: (status: unknown) => event_type_status;
  get_status_label: (status: event_type_status) => string;
  owner_names_by_id?: Record<string, string>;
  show_owner_labels?: boolean;
  on_row_click: (item: event_type_list_item) => void;
};

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function format_short_label(format: event_type_format): string {
  if (format === "group_class") return "Group";
  if (format === "recurring") return "Recurring";
  return "One-on-one";
}

function format_icon_wrap_class(
  format: event_type_format,
  status: event_type_status
): string {
  if (status === "draft" && format === "group_class") {
    return "bg-orange-50 text-orange-600";
  }
  if (format === "group_class") return "bg-sky-50 text-sky-600";
  if (format === "recurring") return "bg-emerald-50 text-emerald-600";
  return "bg-indigo-50 text-indigo-600";
}

function FormatIcon({ format }: { format: event_type_format }) {
  if (format === "group_class") {
    return <LuUsers className="h-5 w-5" aria-hidden />;
  }
  if (format === "recurring") {
    return <LuMonitor className="h-5 w-5" aria-hidden />;
  }
  return <LuUser className="h-5 w-5" aria-hidden />;
}

export function EventTypeListMobileCards({
  items,
  format_duration_label,
  get_status,
  get_status_label,
  owner_names_by_id,
  show_owner_labels = false,
  on_row_click,
}: EventTypeListMobileCardsProps) {
  const { data: serviceProviders } = useServiceProviders();

  const provider_row = (item: event_type_list_item) => (
    <EventTypeAssignedProviders
      eventType={item}
      serviceProviders={serviceProviders}
      owner_names_by_id={owner_names_by_id}
      show_owner_labels={show_owner_labels}
      size="sm"
      compact
    />
  );

  return (
    <>
    <div className="space-y-3 ">
        {items.map((item) => {
          const status = get_status(item.status);
          const status_label = get_status_label(status);
          const format = parse_event_type_format(item.event_type_format);
          const duration_label = format_duration_label(item.duration_minutes);

          return (
            <div
              key={item.id}
              onClick={() => on_row_click(item)}
              className="w-full space-y-2 rounded-2xl border border-slate-200 bg-white px-2 py-3 text-left shadow-sm transition active:bg-slate-50"
            >
              <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex gap-2">
                      <div
                        className={cn(
                          "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                          format_icon_wrap_class(format, status)
                        )}
                      >
                        <FormatIcon format={format} />
                      </div>
                      <div>
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {item.title}
                        </p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1 text-sm text-slate-600">
                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5 text-indigo-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                            {duration_label}
                          </span>
                        </p>
                      </div>
                    </div>                
                  </div>
                  
                  <ScreenGate minWidth={576}>
                  <div className="flex flex-col gap-1">
                    <div className="flex">
                      <span className="text-xs text-indigo-600 border border-indigo-200 bg-indigo-100 px-3 py-1 rounded-full">
                        {format_short_label(format)}
                      </span>
                    </div>
                    <p>{provider_row(item)}</p>
                  </div>
                  </ScreenGate>

                  <div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold border",
                        status === "active"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-amber-200"
                      )}
                    >
                      {status_label}
                    </span>
                  </div>
              </div>

              <ScreenGate maxWidth={575}>
                <div className="flex flex-row gap-1">
                  <div className="flex">
                    <span className="text-xs text-indigo-600 border border-indigo-200 bg-indigo-100 px-3 py-1 rounded-full">
                      {format_short_label(format)}
                    </span>
                  </div>
                  <p>{provider_row(item)}</p>
                </div>
              </ScreenGate> 
            </div>
          );
        })}
      </div>
    </>
  );
}
