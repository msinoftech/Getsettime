"use client";

import { useState } from "react";
import Link from "next/link";
import { useCreateBookingModal } from "@/src/providers/CreateBookingModalProvider";
import DashboardIcon from "./DashboardIcon";

const FAB_ITEM_CLASS =
  "flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-black text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-600";

type FabItem =
  | { key: string; label: string; href: string }
  | { key: string; label: string; open_create_booking: true };

const FAB_ITEMS: FabItem[] = [
  { key: "create-booking", label: "Create Booking", open_create_booking: true },
  { key: "add-client", label: "Add Client", href: "/contacts" },
  { key: "block-time", label: "Block Time", href: "/availability" },
];

export default function DashboardFab() {
  const [menu_open, set_menu_open] = useState(false);
  const { open: open_create_booking } = useCreateBookingModal();

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {menu_open ? (
        <div className="w-56 rounded-[24px] border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-300/80">
          {FAB_ITEMS.map((item) =>
            "href" in item ? (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => set_menu_open(false)}
                className={FAB_ITEM_CLASS}
              >
                <DashboardIcon name="plus" size={16} /> {item.label}
              </Link>
            ) : (
              <button
                key={item.key}
                type="button"
                className={FAB_ITEM_CLASS}
                onClick={() => {
                  open_create_booking();
                  set_menu_open(false);
                }}
              >
                <DashboardIcon name="plus" size={16} /> {item.label}
              </button>
            ),
          )}
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={menu_open}
        aria-label={menu_open ? "Close quick actions" : "Open quick actions"}
        onClick={() => set_menu_open((prev) => !prev)}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-2xl shadow-indigo-500/40 transition duration-300 hover:scale-110"
      >
        <DashboardIcon name="plus" size={26} />
      </button>
    </div>
  );
}
