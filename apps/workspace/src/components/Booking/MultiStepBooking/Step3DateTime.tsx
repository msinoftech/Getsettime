'use client';

import React, { useRef, useCallback, useEffect } from 'react';
import type { AvailabilitySettings, Booking, EventType, Timeslot } from '@/src/types/bookingForm';
import {
  BOOKING_BUTTON_LABELS,
  BOOKING_EMPTY_MESSAGES,
  BOOKING_LOADING_MESSAGES,
  BOOKING_STEP_TITLES,
  DAY_NAMES,
  DEFAULT_ACCENT_COLOR,
  DEFAULT_PRIMARY_COLOR,
  SCROLL_LOAD_DISTANCE,
} from '@/src/constants/booking';
import { getCalendarDays, isToday, normalizeDate } from '@/src/utils/bookingTime';
import { isDateAvailable } from '@/src/utils/bookingAvailability';

interface Step3DateTimeProps {
  selectedDate: Date | null;
  selectedTime: string;
  timeslots: Timeslot[];
  days: Date[];
  currentMonth: Date;
  showCalendar: boolean;
  loadingAvailability: boolean;
  loadingBookings: boolean;
  availabilitySettings: AvailabilitySettings | null;
  existingBookings: Booking[];
  selectedType: EventType | null;
  departmentsCount: number;
  workspacePrimaryColor: string;
  workspaceAccentColor: string | null;
  onSelectDate: (date: Date) => void;
  onSelectTime: (time: string) => void;
  onToggleCalendar: () => void;
  onNavigateMonth: (dir: 'prev' | 'next') => void;
  onSetCurrentMonth?: (date: Date) => void;
  onBack: () => void;
  onContinue: () => void;
  onDaysChange: (updater: (prev: Date[]) => Date[]) => void;
}

export function Step3DateTime({
  selectedDate,
  selectedTime,
  timeslots,
  days,
  currentMonth,
  showCalendar,
  loadingAvailability,
  loadingBookings,
  availabilitySettings,
  existingBookings,
  selectedType,
  departmentsCount,
  workspacePrimaryColor,
  workspaceAccentColor,
  onSelectDate,
  onSelectTime,
  onToggleCalendar,
  onNavigateMonth,
  onSetCurrentMonth,
  onBack,
  onContinue,
  onDaysChange,
}: Step3DateTimeProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const selectedDateRef = useRef<HTMLButtonElement | null>(null);
  const isLoadingMoreRef = useRef(false);

  const loadMoreDates = useCallback(() => {
    if (isLoadingMoreRef.current) return;
    isLoadingMoreRef.current = true;
    onDaysChange((prevDays) => {
      const lastDate = prevDays[prevDays.length - 1];
      const newDates: Date[] = [];
      for (let i = 1; i <= 10; i++) {
        const d = new Date(lastDate);
        d.setDate(d.getDate() + i);
        newDates.push(normalizeDate(d));
      }
      return [...prevDays, ...newDates];
    });
    setTimeout(() => { isLoadingMoreRef.current = false; }, 300);
  }, [onDaysChange]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || showCalendar) return;
    const checkAndLoadMore = () => {
      if (isLoadingMoreRef.current) return;
      const { scrollLeft, scrollWidth, clientWidth } = container;
      if (scrollWidth <= clientWidth) return;
      if (scrollWidth - (scrollLeft + clientWidth) < SCROLL_LOAD_DISTANCE) {
        loadMoreDates();
      }
    };
    const rafId = requestAnimationFrame(checkAndLoadMore);
    container.addEventListener('scroll', checkAndLoadMore, { passive: true });
    return () => {
      cancelAnimationFrame(rafId);
      container.removeEventListener('scroll', checkAndLoadMore);
    };
  }, [loadMoreDates, showCalendar]);

  useEffect(() => {
    if (selectedDate && selectedDateRef.current && scrollContainerRef.current && !showCalendar) {
      const timer = setTimeout(() => {
        const container = scrollContainerRef.current;
        const button = selectedDateRef.current;
        if (container && button) {
          const scrollLeft = button.offsetLeft - container.getBoundingClientRect().width / 2 + button.getBoundingClientRect().width / 2;
          container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [selectedDate, showCalendar]);

  const checkDateAvailable = (date: Date) =>
    isDateAvailable(date, availabilitySettings, selectedType, existingBookings);

  return (
    <div className="space-y-4 sm:space-y-6 lg:space-y-8 animate-fadeIn">
      <div className="text-center lg:text-left">
        <h2 className="text-2xl font-bold text-gray-900">{BOOKING_STEP_TITLES.step3}</h2>
        <p className="text-xs sm:text-sm text-gray-500">{BOOKING_STEP_TITLES.step3Subtitle}</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-purple-100 to-purple-200 flex items-center justify-center flex-shrink-0">
              <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wide">{BOOKING_BUTTON_LABELS.pickDay}</div>
          </div>
          <button
            onClick={onToggleCalendar}
            className="text-xs sm:text-sm text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
          >
            {showCalendar ? BOOKING_BUTTON_LABELS.hideCalendar : BOOKING_BUTTON_LABELS.showCalendar}
            <svg className={`w-4 h-4 transition-transform ${showCalendar ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {showCalendar ? (
          <div className="bg-white rounded-xl sm:rounded-2xl border-2 border-gray-200 p-4 sm:p-6 mb-4 shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => onNavigateMonth('prev')} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <h3 className="text-base sm:text-lg font-bold text-gray-900">
                {currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </h3>
              <button onClick={() => onNavigateMonth('next')} className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 sm:gap-2">
              {DAY_NAMES.map((day) => (
                <div key={day} className="text-center text-xs sm:text-sm font-bold text-gray-500 py-2">{day}</div>
              ))}
              {getCalendarDays(currentMonth).map((date, index) => {
                const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
                const isSelected = selectedDate?.toDateString() === date.toDateString();
                const isTodayDate = isToday(date);
                const isAvailable = checkDateAvailable(date);
                const isPast = date < new Date() && !isTodayDate;
                const isDisabled = !isAvailable || isPast;
                return (
                  <button
                    key={index}
                    onClick={() => {
                      if (!isDisabled && isCurrentMonth) {
                        const nd = normalizeDate(date);
                        onSelectDate(nd);
                        onSelectTime('');
                        if (onSetCurrentMonth && (date.getMonth() !== currentMonth.getMonth() || date.getFullYear() !== currentMonth.getFullYear())) {
                          onSetCurrentMonth(new Date(date.getFullYear(), date.getMonth(), 1));
                        }
                        onToggleCalendar();
                        onDaysChange((prev) => {
                          const exists = prev.some((d) => d.toDateString() === nd.toDateString());
                          if (!exists) {
                            const newDays: Date[] = [];
                            for (let i = -5; i <= 5; i++) {
                              const d = new Date(nd);
                              d.setDate(nd.getDate() + i);
                              newDays.push(normalizeDate(d));
                            }
                            return newDays.sort((a, b) => a.getTime() - b.getTime());
                          }
                          return prev;
                        });
                      }
                    }}
                    disabled={isDisabled || !isCurrentMonth}
                    className={`aspect-square p-1 sm:p-2 rounded-lg sm:rounded-xl text-xs sm:text-sm font-medium transition-all duration-200 ${
                      !isCurrentMonth
                        ? 'text-gray-300 cursor-not-allowed'
                        : isDisabled
                          ? 'bg-gray-50 border-2 border-gray-200 text-gray-300 cursor-not-allowed opacity-60'
                          : isSelected
                            ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-lg scale-110 ring-2 ring-purple-200'
                            : 'text-gray-900 bg-white hover:bg-purple-50 hover:border-2 hover:border-purple-300 border-2 border-transparent'
                    } ${isTodayDate && !isSelected && !isDisabled ? 'ring-2 ring-purple-400' : ''}`}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <span>{date.getDate()}</span>
                      {isTodayDate && !isSelected && !isDisabled && (
                        <div className="w-1 h-1 rounded-full bg-purple-600 mt-0.5" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="w-full min-w-0 overflow-hidden">
            <div
              ref={scrollContainerRef}
              className="flex flex-nowrap gap-2 sm:gap-3 overflow-x-auto overflow-y-hidden py-2 sm:pb-3 -mx-1 px-1 scroll-smooth [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300"
          >
            {days
              .filter((d) => {
                const past = d < new Date() && !isToday(d);
                if (past) return false;
                if (!availabilitySettings?.timesheet) return true;
                return checkDateAvailable(d);
              })
              .map((d) => {
                const isSelected = selectedDate?.toDateString() === d.toDateString();
                const isTodayDate = isToday(d);
                const primary = workspacePrimaryColor || DEFAULT_PRIMARY_COLOR;
                const accent = workspaceAccentColor || primary || DEFAULT_ACCENT_COLOR;
                return (
                  <button
                    key={d.toISOString()}
                    ref={(el) => { if (isSelected) selectedDateRef.current = el; }}
                    onClick={() => { onSelectDate(normalizeDate(d)); onSelectTime(''); }}
                    className={`group flex-none min-w-[70px] p-2 rounded-xl sm:rounded-2xl transition-all duration-300 relative overflow-hidden ${
                      isSelected
                        ? 'text-white shadow-xl scale-105 ring-2 sm:ring-4 ring-purple-200 z-10'
                        : 'bg-white border-2 border-gray-200 hover:border-purple-400 hover:shadow-lg hover:scale-105'
                    }`}
                    style={
                      isSelected
                        ? { background: `linear-gradient(to bottom right, ${primary}, ${accent})` }
                        : undefined
                    }
                  >
                    {isSelected && <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />}
                    <div className="relative z-10 text-center">
                      <div className={`text-[10px] sm:text-xs font-bold ${isSelected ? 'text-purple-100' : 'text-gray-500'}`}>
                        {d.toLocaleDateString(undefined, { weekday: 'short' })}
                      </div>
                      <div className={`font-bold text-base sm:text-lg lg:text-xl ${isSelected ? 'text-white' : 'text-gray-900'}`}>
                        {d.toLocaleDateString(undefined, { day: 'numeric' })}
                      </div>
                      <div className={`text-[10px] sm:text-xs ${isSelected ? 'text-purple-100' : 'text-gray-500'}`}>
                        {d.toLocaleDateString(undefined, { month: 'short' })}
                      </div>
                      {isTodayDate && !isSelected && (
                        <div className="absolute top-0 right-0 w-2 h-2 rounded-full" style={{ background: primary }} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-3 sm:mb-4">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center flex-shrink-0">
            <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="text-xs sm:text-sm font-bold text-gray-700 uppercase tracking-wide">
            {BOOKING_BUTTON_LABELS.availableTimes}
            <span className="text-xs text-gray-500 ml-2 normal-case font-normal">
              ({Intl.DateTimeFormat().resolvedOptions().timeZone})
            </span>
          </div>
        </div>
        {loadingAvailability || loadingBookings ? (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-3 text-gray-500">
              <div className="w-6 h-6 border-[3px] border-purple-600 border-t-transparent rounded-full animate-spin" />
              <span>{BOOKING_LOADING_MESSAGES.availability}</span>
            </div>
          </div>
        ) : timeslots.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
            <p className="text-gray-500 font-medium">
              {!selectedType
                ? BOOKING_EMPTY_MESSAGES.selectEventFirst
                : !selectedDate
                  ? BOOKING_EMPTY_MESSAGES.selectDateFirst
                  : BOOKING_EMPTY_MESSAGES.noTimeSlots}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
            {timeslots
              .filter((s) => !s.disabled)
              .map((slot) => {
                const isSelected = selectedTime === slot.time;
                return (
                  <button
                    key={slot.time}
                    onClick={() => onSelectTime(slot.time)}
                    disabled={!selectedDate}
                    className={`group relative p-2.5 sm:p-3 lg:p-4 rounded-lg sm:rounded-xl transition-all duration-300 text-xs sm:text-sm font-bold overflow-hidden ${
                      isSelected
                        ? 'bg-gradient-to-br from-purple-600 to-purple-700 text-white shadow-xl scale-105 ring-2 sm:ring-4 ring-purple-200'
                        : 'bg-white border-2 border-gray-200 hover:border-purple-400 hover:shadow-lg hover:scale-105 hover:bg-purple-50'
                    } ${!selectedDate ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {isSelected && <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />}
                    <span className="relative z-10">{slot.time}</span>
                  </button>
                );
              })}
          </div>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8 lg:mt-10 pt-6 sm:pt-8 border-t border-gray-200">
        <button
          onClick={onBack}
          className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-3.5 rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all font-semibold text-gray-700 hover:shadow-md"
        >
          {BOOKING_BUTTON_LABELS.back}
        </button>
        <button
          disabled={!selectedDate || !selectedTime}
          onClick={onContinue}
          className={`w-full sm:w-auto sm:ml-auto px-6 sm:px-10 py-3 sm:py-3.5 rounded-xl text-white transition-all font-semibold ${
            !selectedDate || !selectedTime
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-xl hover:shadow-2xl hover:scale-105'
          }`}
        >
          {BOOKING_BUTTON_LABELS.continue}
        </button>
      </div>
    </div>
  );
}
