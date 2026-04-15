"use client";
import React, { useState, useMemo } from 'react'
import Link from "next/link";
import { useAuth } from "@/src/providers/AuthProvider";
import { useDashboardCounts } from "@/src/hooks/useDashboardCounts";
import BookingChart from "@/src/components/Charts/BookingChart";
import BookingStatusChart from "@/src/components/Charts/BookingStatusChart";


const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const {
    counts,
    loading,
    weekDayLabels,
    bookingsByDay,
    bookingsByStatus,
    bookingsTotal,
  } = useDashboardCounts(user);
  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';

  // Calendar Section
  type CalendarCell = {
    date: Date;
    dayNumber: number;
    isCurrentMonth: boolean;
  };

  const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function buildCalendarCells(viewDate: Date): CalendarCell[] {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
  
    const firstDayOfMonth = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    const startWeekday = firstDayOfMonth.getDay();
  
    const cells: CalendarCell[] = [];
  
    for (let i = startWeekday - 1; i >= 0; i -= 1) {
      const dayNumber = daysInPrevMonth - i;
      cells.push({
        date: new Date(year, month - 1, dayNumber),
        dayNumber,
        isCurrentMonth: false,
      });
    }
  
    for (let dayNumber = 1; dayNumber <= daysInMonth; dayNumber += 1) {
      cells.push({
        date: new Date(year, month, dayNumber),
        dayNumber,
        isCurrentMonth: true,
      });
    }
  
    let nextMonthDay = 1;
    // Always render 6 rows (42 cells) so every month keeps equal height.
    while (cells.length < 42) {
      cells.push({
        date: new Date(year, month + 1, nextMonthDay),
        dayNumber: nextMonthDay,
        isCurrentMonth: false,
      });
      nextMonthDay += 1;
    }
  
    return cells;
  }

  function isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }

  const today = new Date();
  const [viewDate, setViewDate] = useState(
    new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(today);

  const cells = useMemo(() => buildCalendarCells(viewDate), [viewDate]);
  const weeks = useMemo(() => {
    const rows: CalendarCell[][] = [];
    for (let i = 0; i < cells.length; i += 7) {
      rows.push(cells.slice(i, i + 7));
    }
    return rows;
  }, [cells]);

  const monthLabel = viewDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const goToPrevMonth = () => {
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1),
    );
  };

  const goToNextMonth = () => {
    setViewDate(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1),
    );
  };

  const handleDateSelect = (cell: CalendarCell) => {
    setSelectedDate(cell.date);
    if (!cell.isCurrentMonth) {
      setViewDate(new Date(cell.date.getFullYear(), cell.date.getMonth(), 1));
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <section aria-label="welcome-note" className="bg-indigo-600 rounded-xl px-7 py-6 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">Welcome back, {userName}</h1>
              <span className="animate-wave text-2xl inline-block">👋</span>
            </div>
            <p className="text-white text-sm">Here's what's happening with your account today.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/event-type" prefetch={false} className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-indigo-600 hover:bg-transparent hover:border-white hover:text-white border border-white transition">Create Event</Link>
            <Link href="/bookings" className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-indigo-600 hover:bg-transparent hover:border-white hover:text-white border border-white transition">View Bookings</Link>
          </div>
        </div>
      </section>

      {/* Box Section */}
      <section aria-label="box-section" className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">

        {/* Total Bookings Card */}
        <div className="group relative bg-gradient-to-br from-white to-[#f0f7ff] border border-[#dbe9ff] rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-sky-400/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="m-0 text-base font-semibold text-slate-700">Total Bookings</h2>
              <p className="mt-1 text-4xl font-extrabold text-sky-500">
                {loading ? '...' : counts.bookings}
              </p>
            </div>
            <div className="w-16 h-16 rounded-xl bg-sky-100 flex items-center justify-center shadow-md">
              <svg className="w-10 h-10 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-500">+12% from last month</div>
        </div>

        {/* Upcoming Events Card */}
        <div className="group relative bg-gradient-to-br from-white to-[#fff8f0] border border-[#ffe6d1] rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-orange-400/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="m-0 text-base font-semibold text-slate-700">Upcoming Events</h2>
              <p className="mt-1 text-4xl font-extrabold text-orange-500">
                {loading ? '...' : counts.upcomingBookings}
              </p>
            </div>
            <div className="w-16 h-16 rounded-xl bg-orange-100 flex items-center justify-center shadow-md">
              <svg className="w-10 h-10 text-orange-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-500">Next event in 2 days</div>
        </div>

        {/* Employees Card */}
        <div className="group relative bg-gradient-to-br from-white to-[#f0fff4] border border-[#d1ffe0] rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-emerald-400/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="m-0 text-base font-semibold text-slate-700">Employees</h2>
              <p className="mt-1 text-4xl font-extrabold text-emerald-500">
                {loading ? '...' : counts.teamMembers}
              </p>
            </div>
            <div className="w-16 h-16 rounded-xl bg-emerald-100 flex items-center justify-center shadow-md">
              <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-500">Active staff members</div>
        </div>

        {/* Total Services Card */}
        <div className="group relative bg-gradient-to-br from-white to-[#fef0ff] border border-[#f0d1ff] rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-purple-400/10 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="m-0 text-base font-semibold text-slate-700">Total Services</h2>
              <p className="mt-1 text-4xl font-extrabold text-purple-500">
                {loading ? '...' : counts.services}
              </p>
            </div>
            <div className="w-16 h-16 rounded-xl bg-purple-100 flex items-center justify-center shadow-md">
              <svg className="w-10 h-10 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-500">Available services</div>
        </div>
      </section>

      {/* Chart Section */}
      <section aria-label="chart-section" className="relative">
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4 sm:gap-6">
          
          <div className="rounded-xl bg-white border border-[#e6ebff] p-4 shadow-sm">
            <div className="mb-4 sm:mb-5">
              <h3 className="text-xl font-semibold text-slate-900">Bookings by Day</h3>
              <p className="mt-1 text-sm text-slate-500">Track your booking distribution</p>
            </div>

            <div className="rounded-xl border border-[#dce1ec] bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.15),_transparent_30%),linear-gradient(180deg,#f8faff_0%,#eef2ff_100%)] p-4 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]">
              <BookingChart
                loading={loading}
                weekDayLabels={weekDayLabels}
                bookingsByDay={bookingsByDay}
              />
            </div>
          </div>
          
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-4 sm:mb-5">
              <h3 className="text-xl font-semibold text-slate-900">Booking Status</h3>
              <p className="mt-1 text-sm text-slate-500">Track your booking distribution</p>
            </div>
            <div className="rounded-xl border border-[#dce1ec] bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.15),_transparent_30%),linear-gradient(180deg,#f8faff_0%,#eef2ff_100%)] p-4 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]">
              <BookingStatusChart
                loading={loading}
                bookingsByStatus={bookingsByStatus}
                bookingsTotal={bookingsTotal}
              />
            </div>
          </div>

          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-3 sm:mb-5">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">Calendar</h3>
                <p className="mt-1 text-sm text-slate-500">Manage your schedule quickly</p>
              </div>
              <button type="button" onClick={() => { setSelectedDate(today); setViewDate(new Date(today.getFullYear(), today.getMonth(), 1)); }} className="rounded-full bg-[#dfe3ef] px-4 py-1.5 text-sm font-medium text-indigo-700 transition-colors hover:bg-[#d6dced]">
                Today
              </button>
            </div>

            <div className="rounded-xl border border-[#dce1ec] bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.15),_transparent_30%),linear-gradient(180deg,#f8faff_0%,#eef2ff_100%)] p-3 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)] sm:p-5">
              <div className="mb-4 flex items-center justify-between text-neutral-900">
                <button type="button" onClick={goToPrevMonth} className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-white" aria-label="Show previous month">
                  <svg className="h-4 w-4 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <div className="px-2 text-center text-base font-semibold text-slate-700">{monthLabel}</div>
                <button type="button" onClick={goToNextMonth} className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-indigo-600 text-white" aria-label="Show next month">
                  <svg className="h-4 w-4 transition-all duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500 sm:text-sm">
                {WEEK_DAYS.map((day) => (
                  <div key={day}>{day}</div>
                ))}
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                {weeks.map((row, rowIndex) => (
                  <div key={`${monthLabel}-${rowIndex}`} className="grid grid-cols-7 gap-1 sm:gap-2">
                    {row.map((cell) => {
                      const isSelected = isSameDay(cell.date, selectedDate);
                      const isMuted = !cell.isCurrentMonth;

                      return (
                        <button
                          key={cell.date.toISOString()}
                          type="button"
                          onClick={() => handleDateSelect(cell)}
                          className={`flex h-8 w-full items-center justify-center rounded-md text-xs font-medium transition-all cursor-pointer sm:h-9 sm:rounded-lg ${
                            isSelected
                              ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/20"
                              : isMuted
                                ? "text-slate-400 hover:bg-[#edf1f8]"
                                : "text-slate-700 hover:bg-[#e9edf6]"
                          }`}
                        >
                          {cell.dayNumber}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </section>

    </div>
  )
}

export default Dashboard