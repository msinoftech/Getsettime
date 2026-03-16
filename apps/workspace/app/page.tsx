"use client";
import React from 'react'
import Link from "next/link";
import { useAuth } from "@/src/providers/AuthProvider";
import { useDashboardCounts } from "@/src/hooks/useDashboardCounts";
import BookingChart from "@/src/components/Charts/BookingChart";
import BookingStatusChart from "@/src/components/Charts/BookingStatusChart";

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { counts, loading } = useDashboardCounts(user);
  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <section aria-label="welcome-note" className="bg-indigo-600 rounded-xl p-8 shadow-lg backdrop-blur-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-white">Welcome back, {userName}</h1>
              <span className="animate-wave text-2xl inline-block">👋</span>
            </div>
            <p className="text-white text-sm">Here's what's happening with your account today.</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link href="/event-type" className="px-4 py-2 rounded-lg text-sm font-medium bg-white text-indigo-600 hover:bg-transparent hover:border-white hover:text-white border border-white transition">Create Event</Link>
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
            <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center shadow-inner">
              <svg className="w-6 h-6 text-sky-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
              <p className="mt-1 text-4xl font-extrabold text-orange-500">5</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center shadow-inner">
              <svg className="w-6 h-6 text-orange-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center shadow-inner">
              <svg className="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
            <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center shadow-inner">
              <svg className="w-6 h-6 text-purple-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinejoin="round" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </div>
          </div>
          <div className="mt-4 text-xs text-slate-500">Available services</div>
        </div>
      </section>

      {/* Chart Section */}
      <section aria-label="chart-section" className="relative">
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          <div className="xl:col-span-2 rounded-xl bg-white border border-[#e6ebff] p-4 sm:p-5 shadow-sm">
            <BookingChart />
          </div>
          <div className="rounded-xl bg-white border border-[#e6ebff] p-4 sm:p-5 shadow-sm">
            <BookingStatusChart />
          </div>
        </div>
      </section>
    </div>
  )
}

export default Dashboard