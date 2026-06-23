"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import MultiStepBookingForm from "@/src/components/Booking/MultiStepBookingForm";

type create_booking_modal_context_value = {
  open: () => void;
  close: () => void;
  isOpen: boolean;
};

const CreateBookingModalContext =
  createContext<create_booking_modal_context_value | null>(null);

export function useCreateBookingModal(): create_booking_modal_context_value {
  const ctx = useContext(CreateBookingModalContext);
  if (!ctx) {
    throw new Error(
      "useCreateBookingModal must be used within CreateBookingModalProvider",
    );
  }
  return ctx;
}

export function CreateBookingModalProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isOpen, set_is_open] = useState(false);
  /** Previous pathname segment for closing on SPA navigation */
  const prev_pathname_ref = useRef<string | null>(null);

  const open = useCallback(() => set_is_open(true), []);
  const close = useCallback(() => set_is_open(false), []);

  useEffect(() => {
    const prev = prev_pathname_ref.current;
    prev_pathname_ref.current = pathname;
    if (prev === null) return;
    if (prev === pathname) return;

    /**
     * Deep link: `/bookings/new` opens the modal then replaces to `/bookings`.
     * Do not dismiss when that handoff runs (modal stays open).
     */
    const is_bookings_new_bridge =
      prev === "/bookings/new" && pathname === "/bookings";
    if (is_bookings_new_bridge) return;

    set_is_open(false);
  }, [pathname]);

  const value = useMemo(
    () => ({ open, close, isOpen }),
    [open, close, isOpen],
  );

  return (
    <CreateBookingModalContext.Provider value={value}>
      {children}
    </CreateBookingModalContext.Provider>
  );
}

/** Viewport-anchored overlay positioned to the shell content area (below the 64px topbar, right of the 256px sidebar) so the modal stays contained and only its content scrolls. */
export function CreateBookingModalHost() {
  const { isOpen, close } = useCreateBookingModal();

  useEffect(() => {
    if (!isOpen) return;
    const on_key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", on_key);
    return () => window.removeEventListener("keydown", on_key);
  }, [isOpen, close]);

  // Lock the real scrolling element (document) so the page behind cannot scroll
  // while the modal is open, then restore it on close.
  useEffect(() => {
    if (!isOpen) return;
    const scrolling_el = (document.scrollingElement ||
      document.documentElement) as HTMLElement;
    const previous_scroll_top = scrolling_el.scrollTop;
    const previous_html_overflow = document.documentElement.style.overflow;
    const previous_body_overflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous_html_overflow;
      document.body.style.overflow = previous_body_overflow;
      scrolling_el.scrollTop = previous_scroll_top;
    };
  }, [isOpen]);

  const handle_save = useCallback(() => {
    close();
  }, [close]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 top-16 z-50 flex flex-col items-center overflow-hidden bg-white px-3 pb-6 pt-3 sm:px-6 sm:pb-8 sm:pt-4 lg:left-64 lg:px-8 lg:pb-10"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        id="admin-create-booking-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-create-booking-dialog-title"
        className="relative flex min-h-0 w-full max-w-7xl flex-1 flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex shrink-0 items-start justify-between gap-3 rounded-[20px] border border-slate-200/80 bg-white/95 px-4 py-4 shadow-lg backdrop-blur-sm sm:items-center sm:px-5">
          <div className="min-w-0">
            <h2
              id="admin-create-booking-dialog-title"
              className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl md:text-2xl"
            >
              Create booking
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Set up a new appointment with the guided steps below.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            aria-label="Close create booking"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <MultiStepBookingForm
            variant="embedded"
            hide_embedded_toolbar
            onSave={handle_save}
            onCancel={close}
          />
        </div>
      </div>
    </div>
  );
}
