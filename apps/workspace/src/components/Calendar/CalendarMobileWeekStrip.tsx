"use client";

import {
  LuChevronLeft as ChevronLeft,
  LuChevronRight as ChevronRight,
} from "react-icons/lu";
import { toDateKey } from "@/src/components/Calendar/calendar_utils";

type CalendarMobileWeekStripProps = {
  selectedDate: Date;
  daysWithBookings: Set<string>;
  onSelectDate: (date: Date) => void;
  onPreviousWeek: () => void;
  onNextWeek: () => void;
};

function startOfWeek(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  const weekday = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - weekday);
  return next;
}

function getWeekDays(selectedDate: Date): Date[] {
  const weekStart = startOfWeek(selectedDate);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + index);
    return date;
  });
}

export function CalendarMobileWeekStrip({
  selectedDate,
  daysWithBookings,
  onSelectDate,
  onPreviousWeek,
  onNextWeek,
}: CalendarMobileWeekStripProps) {
  const days = getWeekDays(selectedDate);
  const selectedKey = toDateKey(selectedDate);

  return (
    <div className="flex w-full items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5">
      <button
        type="button"
        onClick={onPreviousWeek}
        className="inline-flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
        aria-label="Previous week"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>

      <div className="grid min-w-0 flex-1 grid-cols-7 gap-0.5">
        {days.map((day) => {
          const key = toDateKey(day);
          const isSelected = key === selectedKey;
          const hasBookings = daysWithBookings.has(key);
          const dayLabel = day.toLocaleDateString("en-US", { weekday: "short" });
          const dayNumber = day.getDate();

          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelectDate(day)}
              className={`flex flex-col items-center justify-center rounded-lg px-0.5 py-1.5 transition ${
                isSelected
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-50"
              }`}
              aria-pressed={isSelected}
              aria-label={`${dayLabel} ${dayNumber}`}
            >
              <span
                className={`text-[10px] font-medium ${
                  isSelected ? "text-white/90" : "text-slate-400"
                }`}
              >
                {dayLabel}
              </span>
              <span
                className={`mt-0.5 text-sm font-bold leading-none ${
                  isSelected ? "text-white" : "text-slate-900"
                }`}
              >
                {dayNumber}
              </span>
              <span className="mt-1 flex h-1.5 items-center justify-center">
                {isSelected ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
                ) : hasBookings ? (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                ) : (
                  <span className="h-1.5 w-1.5" aria-hidden />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onNextWeek}
        className="inline-flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50"
        aria-label="Next week"
      >
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
