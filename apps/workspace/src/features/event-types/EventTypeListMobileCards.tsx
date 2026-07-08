"use client";

import {  LuCalendarDays,
  LuClock,
  LuPencil,
  LuUsers,
} from "react-icons/lu";
import { EventTypeActionsMenu } from "@/src/features/event-types/EventTypeActionsMenu";
import { EventTypeLocationCell } from "@/src/features/event-types/EventTypeLocationDisplay";
import type { event_type_status } from "@/src/types/event_types";

export type event_type_list_item = {
  id: number;
  title: string;
  slug: string;
  duration_minutes: number | null;
  location_type: string | null;
  settings: unknown;
  status?: string | null;
  owner_id?: string | null;
};

type EventTypeListMobileCardProps = {
  item: event_type_list_item;
  status: event_type_status;
  status_label: string;
  provider_label: string;
  card_gradient: string;
  duration_label: string;
  short_description: string;
  menu_open: boolean;
  loading_slug: boolean;
  copy_copied: boolean;
  on_edit: () => void;
  on_toggle_menu: () => void;
  on_copy_link: () => void;
  on_duplicate: () => void;
  on_delete: () => void;
};

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

function MetaDivider() {
  return <span className="text-slate-300" aria-hidden>|</span>;
}

function EventTypeListMobileCard({
  item,
  status,
  status_label,
  provider_label,
  card_gradient,
  duration_label,
  short_description,
  menu_open,
  loading_slug,
  copy_copied,
  on_edit,
  on_toggle_menu,
  on_copy_link,
  on_duplicate,
  on_delete,
}: EventTypeListMobileCardProps) {
  return (
    <article className="overflow-visible border-b border-slate-100 p-4 last:border-b-0">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white",
            card_gradient
          )}
        >
          <LuCalendarDays className="h-4 w-4" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                status === "active"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-amber-50 text-amber-700"
              )}
            >
              {status_label}
            </span>
          </div>

          {short_description ? (
            <p className="mt-1 line-clamp-2 text-sm text-slate-500">{short_description}</p>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1">
          <LuClock className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          {duration_label}
        </span>
        <MetaDivider />
        <div className="min-w-0 [&_span]:text-xs">
          <EventTypeLocationCell location_type={item.location_type} />
        </div>
        <MetaDivider />
        <span className="inline-flex min-w-0 items-center gap-1">
          <LuUsers className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          <span className="truncate">{provider_label}</span>
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        {item.slug ? (
          <span className="truncate text-sm font-medium text-violet-600">/{item.slug}</span>
        ) : (
          <span className="text-sm text-slate-400">—</span>
        )}

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={on_edit}
            className="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <LuPencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Edit
          </button>
          <EventTypeActionsMenu
            open={menu_open}
            copy_disabled={loading_slug || !item.slug}
            copy_copied={copy_copied}
            on_toggle={on_toggle_menu}
            on_copy_link={on_copy_link}
            on_duplicate={on_duplicate}
            on_delete={on_delete}
          />
        </div>
      </div>
    </article>
  );
}

type EventTypeListMobileCardsProps = {
  items: event_type_list_item[];
  open_menu_id: number | null;
  copied_id: number | null;
  loading_slug: boolean;
  get_card_gradient: (id: number) => string;
  format_duration_label: (minutes: number | null) => string;
  get_provider_label: (owner_id?: string | null) => string;
  get_short_description: (settings: unknown) => string;
  get_status: (status: unknown) => event_type_status;
  get_status_label: (status: event_type_status) => string;
  on_edit: (item: event_type_list_item) => void;
  on_toggle_menu: (id: number) => void;
  on_copy_link: (item: event_type_list_item) => void;
  on_duplicate: (item: event_type_list_item) => void;
  on_delete: (id: number) => void;
};

export function EventTypeListMobileCards({
  items,
  open_menu_id,
  copied_id,
  loading_slug,
  get_card_gradient,
  format_duration_label,
  get_provider_label,
  get_short_description,
  get_status,
  get_status_label,
  on_edit,
  on_toggle_menu,
  on_copy_link,
  on_duplicate,
  on_delete,
}: EventTypeListMobileCardsProps) {
  return (
    <div className="overflow-visible min-[1211px]:hidden">
      {items.map((item) => {
        const status = get_status(item);
        return (
          <EventTypeListMobileCard
            key={item.id}
            item={item}
            status={status}
            status_label={get_status_label(status)}
            provider_label={get_provider_label(item.owner_id)}
            card_gradient={get_card_gradient(item.id)}
            duration_label={format_duration_label(item.duration_minutes)}
            short_description={get_short_description(item.settings)}
            menu_open={open_menu_id === item.id}
            loading_slug={loading_slug}
            copy_copied={copied_id === item.id && open_menu_id === item.id}
            on_edit={() => on_edit(item)}
            on_toggle_menu={() => on_toggle_menu(item.id)}
            on_copy_link={() => on_copy_link(item)}
            on_duplicate={() => on_duplicate(item)}
            on_delete={() => on_delete(item.id)}
          />
        );
      })}
    </div>
  );
}
