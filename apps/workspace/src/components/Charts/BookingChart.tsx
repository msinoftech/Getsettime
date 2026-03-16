"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { ApexOptions } from "apexcharts";
import { Booking } from "@/src/types/booking";

const ApexCharts = dynamic(() => import("react-apexcharts"), { ssr: false });

// Function to get the current week (last 7 days) with dates
function getCurrentWeekDates(): { date: Date; label: string; dateString: string }[] {
    const dates: { date: Date; label: string; dateString: string }[] = [];
    const today = new Date();
  
    // Use correct weekday names based on JS getDay()
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      date.setHours(0, 0, 0, 0);
  
      const dayName = dayNames[date.getDay()]; // Correct mapping
      const day = date.getDate();
  
      // Format: "Fri 12"
      const label = `${dayName} ${day}`;
  
      // Correct date format (YYYY-MM-DD)
      const dateString = date.toISOString().split("T")[0];
  
      dates.push({ date, label, dateString });
    }
  
    return dates;
  }
  

// Function to check if a date is in the current week
function isDateInCurrentWeek(bookingDate: Date, weekDates: { date: Date; label: string; dateString: string }[]): number {
    const bookingDateString = bookingDate.toISOString().split('T')[0];
    
    for (let i = 0; i < weekDates.length; i++) {
        if (weekDates[i].dateString === bookingDateString) {
            return i;
        }
    }
    
    return -1; // Not in current week
}

export default function Chart() {
    const weekDates = getCurrentWeekDates();
    const [chartData, setChartData] = useState<{
        series: { name: string; data: number[] }[];
        options: ApexOptions;
    }>({
        series: [
            {
                name: "Bookings",
                data: [0, 0, 0, 0, 0, 0, 0],
            },
        ],
        options: {
            chart: {
                type: "area",
                toolbar: { show: false },
            },
            stroke: {
                curve: "smooth",
            },
            xaxis: {
                categories: weekDates.map(d => d.label),
            },
            title: {
                text: "Bookings by Day",
                align: "left",
                style: {
                    fontSize: "18px",
                    fontWeight: "bold",
                },
            },
            fill: {
                type: "gradient",
                gradient: {
                    shadeIntensity: 1,
                    opacityFrom: 0.7,
                    opacityTo: 0.3,
                    stops: [0, 90, 100],
                },
            },
            dataLabels: {
                enabled: false,
            },
            legend: {
                position: "top",
            },
        },
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchBookings = async () => {
            try {
                setLoading(true);
                const { supabase } = await import('@/lib/supabaseClient');
                const { data: { session } } = await supabase.auth.getSession();

                if (!session?.access_token) {
                    setLoading(false);
                    return;
                }

                // Fetch all bookings (or a large limit for charting purposes)
                const response = await fetch('/api/bookings?page=1&limit=1000', {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                });

                if (response.ok) {
                    const result = await response.json();
                    const bookings: Booking[] = result.data || [];

                    // Get current week dates
                    const currentWeekDates = getCurrentWeekDates();
                    
                    // Initialize counts for each day in current week
                    const dayCounts = new Array(7).fill(0);

                    bookings.forEach((booking) => {
                        if (booking.start_at) {
                            const bookingDate = new Date(booking.start_at);
                            bookingDate.setHours(0, 0, 0, 0); // Reset time to start of day
                            
                            // Check if booking is in current week and get index
                            const index = isDateInCurrentWeek(bookingDate, currentWeekDates);
                            if (index !== -1) {
                                dayCounts[index]++;
                            }
                        }
                    });

                    setChartData((prev) => ({
                        ...prev,
                        options: {
                            ...prev.options,
                            xaxis: {
                                ...prev.options.xaxis,
                                categories: currentWeekDates.map(d => d.label),
                            },
                        },
                        series: [
                            {
                                name: "Bookings",
                                data: dayCounts,
                            },
                        ],
                    }));
                }
            } catch (error) {
                console.error('Error fetching bookings for chart:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchBookings();
    }, []);

    if (loading) {
        return (
            <div className="w-full mx-auto flex items-center justify-center h-[350px]">
                <div className="text-gray-500">Loading chart data...</div>
            </div>
        );
    }

    return (
        <div className="w-full mx-auto">
            <ApexCharts options={chartData.options} series={chartData.series} type="area" height={350}/>
        </div>
    );
}
