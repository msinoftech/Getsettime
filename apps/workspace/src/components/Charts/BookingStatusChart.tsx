"use client";

import dynamic from "next/dynamic";
import { useState, useEffect } from "react";
import { ApexOptions } from "apexcharts";
import { Booking } from "@/src/types/booking";

const ApexCharts = dynamic(() => import("react-apexcharts"), { ssr: false });

// Function to capitalize first letter of status
function capitalizeStatus(status: string): string {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

// Function to get color for status
function getStatusColor(status: string, index: number): string {
    const statusColors: Record<string, string> = {
        'confirmed': '#10b981',    // emerald
        'pending': '#f59e0b',      // amber
        'completed': '#3b82f6',   // blue
        'cancelled': '#ef4444',   // red
        'rescheduled': '#8b5cf6', // purple
    };
    
    const lowerStatus = status.toLowerCase();
    if (statusColors[lowerStatus]) {
        return statusColors[lowerStatus];
    }
    
    // Default color palette for unknown statuses
    const defaultColors = [
        '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6',
        '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#6366f1'
    ];
    return defaultColors[index % defaultColors.length];
}

export default function BookingStatusChart() {
    const [totalBookings, setTotalBookings] = useState<number>(0);
    const [chartData, setChartData] = useState<{
        series: number[];
        options: ApexOptions;
    }>({
        series: [],
        options: {
            chart: {
                type: "donut",
                toolbar: { show: false },
            },
            labels: [],
            colors: [],
            dataLabels: {
                enabled: true,
                formatter: function (val: number) {
                    return val.toFixed(1) + "%";
                },
                style: {
                    fontSize: "14px",
                    fontWeight: "bold",
                },
            },
            legend: {
                position: "bottom",
                fontSize: "14px",
                fontWeight: 500,
            },
            plotOptions: {
                pie: {
                    donut: {
                        size: "70%",
                        labels: {
                            show: true,
                            name: {
                                show: true,
                                fontSize: "16px",
                                fontWeight: "bold",
                                color: "#374151",
                            },
                            value: {
                                show: true,
                                fontSize: "24px",
                                fontWeight: "bold",
                                color: "#111827",
                                formatter: function (val: string) {
                                    return val;
                                },
                            },
                            total: {
                                show: true,
                                label: "Total Bookings",
                                fontSize: "16px",
                                fontWeight: "bold",
                                color: "#374151",
                                formatter: function () {
                                    return totalBookings.toString();
                                },
                            },
                        },
                    },
                },
            },
            title: {
                text: "Booking Status Overview",
                align: "left",
                style: {
                    fontSize: "18px",
                    fontWeight: "bold",
                },
            },
            tooltip: {
                y: {
                    formatter: function (val: number, opts: any) {
                        try {
                            // Try to get total from opts first
                            if (opts && opts.w && opts.w.globals && opts.w.globals.seriesTotals) {
                                const optsTotal = opts.w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
                                const percentage = optsTotal > 0 ? ((val / optsTotal) * 100).toFixed(1) : '0';
                                return `${val} bookings (${percentage}%)`;
                            }
                            // Fallback: just show the value
                            return `${val} bookings`;
                        } catch (error) {
                            return `${val} bookings`;
                        }
                    },
                },
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

                // Fetch all bookings
                const response = await fetch('/api/bookings?page=1&limit=1000', {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                    },
                });

                if (response.ok) {
                    const result = await response.json();
                    const bookings: Booking[] = result.data || [];
                    
                    // Count total bookings
                    const total = bookings.length;
                    setTotalBookings(total);

                    // Dynamically group bookings by status
                    const statusCounts = new Map<string, number>();

                    bookings.forEach((booking) => {
                        const status = booking.status || 'pending';
                        const count = statusCounts.get(status) || 0;
                        statusCounts.set(status, count + 1);
                    });

                    // Convert map to arrays for chart
                    const statuses = Array.from(statusCounts.keys());
                    const counts = Array.from(statusCounts.values());
                    const labels = statuses.map(status => capitalizeStatus(status));
                    const colors = statuses.map((status, index) => getStatusColor(status, index));
                    
                    // Calculate total from counts for tooltip
                    const seriesTotal = counts.reduce((a: number, b: number) => a + b, 0);

                    // Update chart data
                    setChartData({
                        series: counts,
                        options: {
                            chart: {
                                type: "donut",
                                toolbar: { show: false },
                            },
                            labels: labels,
                            colors: colors,
                            dataLabels: {
                                enabled: true,
                                formatter: function (val: number) {
                                    return val.toFixed(1) + "%";
                                },
                                style: {
                                    fontSize: "14px",
                                    fontWeight: "bold",
                                },
                            },
                            legend: {
                                position: "bottom",
                                fontSize: "14px",
                                fontWeight: 500,
                            },
                            plotOptions: {
                                pie: {
                                    donut: {
                                        size: "70%",
                                        labels: {
                                            show: true,
                                            name: {
                                                show: true,
                                                fontSize: "16px",
                                                fontWeight: "bold",
                                                color: "#374151",
                                            },
                                            value: {
                                                show: true,
                                                fontSize: "24px",
                                                fontWeight: "bold",
                                                color: "#111827",
                                                formatter: function (val: string) {
                                                    return val;
                                                },
                                            },
                                            total: {
                                                show: true,
                                                label: "Total Bookings",
                                                fontSize: "16px",
                                                fontWeight: "bold",
                                                color: "#374151",
                                                formatter: function () {
                                                    return total.toString();
                                                },
                                            },
                                        },
                                    },
                                },
                            },
                            title: {
                                text: "Booking Status Overview",
                                align: "left",
                                style: {
                                    fontSize: "18px",
                                    fontWeight: "bold",
                                },
                            },
                            tooltip: {
                                y: {
                                    formatter: function (val: number, opts: any) {
                                        try {
                                            // Use the seriesTotal from closure if available
                                            const calculatedTotal = seriesTotal || total;
                                            if (calculatedTotal > 0) {
                                                const percentage = ((val / calculatedTotal) * 100).toFixed(1);
                                                return `${val} bookings (${percentage}%)`;
                                            }
                                            // Fallback: try to get from opts if available
                                            if (opts && opts.w && opts.w.globals && opts.w.globals.seriesTotals) {
                                                const optsTotal = opts.w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
                                                const percentage = optsTotal > 0 ? ((val / optsTotal) * 100).toFixed(1) : '0';
                                                return `${val} bookings (${percentage}%)`;
                                            }
                                            // Final fallback
                                            return `${val} bookings`;
                                        } catch (error) {
                                            return `${val} bookings`;
                                        }
                                    },
                                },
                            },
                        },
                    });
                }
            } catch (error) {
                console.error('Error fetching bookings for status chart:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchBookings();
    }, []);


    if (loading) {
        return (
            <div className="w-full mx-auto flex items-center justify-center h-[400px]">
                <div className="text-gray-500">Loading chart data...</div>
            </div>
        );
    }

    return (
        <div className="w-full mx-auto">
            <ApexCharts 
                options={chartData.options} 
                series={chartData.series} 
                type="donut" 
                height={400}
            />
        </div>
    );
}

