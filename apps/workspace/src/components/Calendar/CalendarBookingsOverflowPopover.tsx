"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { LuX as X } from "react-icons/lu";
import type { Booking } from "@/src/types/booking";
import { CalendarMonthBookingChip } from "@/src/components/Calendar/CalendarMonthBookingChip";

const POPOVER_WIDTH = 280;
const POPOVER_MAX_HEIGHT = 320;
const POPOVER_GAP = 6;

type PopoverPosition = {
  top: number;
  left: number;
};

type CalendarBookingsOverflowPopoverProps = {
  heading: string;
  bookings: Booking[];
  hiddenCount: number;
  onBookingClick: (booking: Booking) => void;
  triggerClassName?: string;
  triggerLabel?: ReactNode;
};

export function CalendarBookingsOverflowPopover({
  heading,
  bookings,
  hiddenCount,
  onBookingClick,
  triggerClassName,
  triggerLabel,
}: CalendarBookingsOverflowPopoverProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<PopoverPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) {
      setPosition(null);
      return;
    }

    const measuredHeight = popoverRef.current?.offsetHeight ?? 0;
    const popoverHeight =
      measuredHeight > 0 ? Math.min(measuredHeight, POPOVER_MAX_HEIGHT) : POPOVER_MAX_HEIGHT;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const openBelow =
      spaceBelow >= popoverHeight + POPOVER_GAP || spaceBelow >= spaceAbove;

    let top = openBelow
      ? rect.bottom + POPOVER_GAP
      : rect.top - popoverHeight - POPOVER_GAP;

    let left = rect.left;
    left = Math.min(
      Math.max(POPOVER_GAP, left),
      window.innerWidth - POPOVER_WIDTH - POPOVER_GAP,
    );
    top = Math.min(
      Math.max(POPOVER_GAP, top),
      window.innerHeight - popoverHeight - POPOVER_GAP,
    );

    setPosition({ top, left });
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    updatePosition();
    const frame = requestAnimationFrame(() => updatePosition());

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition, bookings.length]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const stopEvent = (event: ReactMouseEvent) => {
    event.stopPropagation();
  };

  const handleBookingClick = (booking: Booking) => {
    setOpen(false);
    onBookingClick(booking);
  };

  if (hiddenCount <= 0) {
    return null;
  }

  const headingId = `calendar-bookings-overflow-${heading.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={(event) => {
          stopEvent(event);
          setOpen((prev) => !prev);
        }}
        className={
          triggerClassName ??
          "w-full rounded-md px-1 pt-0.5 text-left text-[11px] font-semibold text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-700"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls={open ? headingId : undefined}
      >
        {triggerLabel ?? `+${hiddenCount} more`}
      </button>

      {open && mounted && position
        ? createPortal(
            <div
              ref={popoverRef}
              id={headingId}
              role="dialog"
              aria-modal="false"
              aria-labelledby={`${headingId}-title`}
              className="fixed z-[60] flex w-[280px] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl"
              style={{
                top: position.top,
                left: position.left,
                maxHeight: POPOVER_MAX_HEIGHT,
              }}
              onMouseDown={stopEvent}
            >
              <div className="flex shrink-0 items-start justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
                <h3
                  id={`${headingId}-title`}
                  className="text-sm font-semibold text-slate-900"
                >
                  {heading}
                </h3>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Close bookings list"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
                {bookings.map((booking) => (
                  <CalendarMonthBookingChip
                    key={booking.id}
                    booking={booking}
                    onClick={() => handleBookingClick(booking)}
                  />
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
