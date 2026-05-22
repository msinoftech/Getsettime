"use client";

import { useState } from "react";
import Link from "next/link";
import DashboardIcon from "./DashboardIcon";

const FAB_ITEMS: { label: string; href: string }[] = [
  { label: "Create Booking", href: "/bookings" },
  { label: "Add Client", href: "/contacts" },
  { label: "Block Time", href: "/availability" },
];

export default function DashboardFab() {
  const [open, set_open] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3">
      {open ? (
        <div className="w-56 rounded-[24px] border border-slate-200 bg-white p-3 shadow-2xl shadow-slate-300/80">
          {FAB_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => set_open(false)}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-sm font-black text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-600"
            >
              <DashboardIcon name="plus" size={16} /> {item.label}
            </Link>
          ))}
        </div>
      ) : null}
      <button
        type="button"
        aria-expanded={open}
        aria-label={open ? "Close quick actions" : "Open quick actions"}
        onClick={() => set_open((prev) => !prev)}
        className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-2xl shadow-indigo-500/40 transition duration-300 hover:scale-110"
      >
        <DashboardIcon name="plus" size={26} />
      </button>
    </div>
  );
}
