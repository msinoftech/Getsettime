"use client";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { ApexOptions } from "apexcharts";

const ApexCharts = dynamic(() => import("react-apexcharts"), { ssr: false });

function capitalizeStatus(status: string): string {
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function getStatusColor(status: string, index: number): string {
  const statusColors: Record<string, string> = {
    confirmed: "#10b981",
    pending: "#f59e0b",
    completed: "#3b82f6",
    cancelled: "#ef4444",
    rescheduled: "#8b5cf6",
    reschedule: "#8b5cf6",
    emergency: "#f97316",
  };

  const lowerStatus = status.toLowerCase();
  if (statusColors[lowerStatus]) {
    return statusColors[lowerStatus];
  }

  const defaultColors = [
    "#10b981",
    "#f59e0b",
    "#3b82f6",
    "#ef4444",
    "#8b5cf6",
    "#06b6d4",
    "#f97316",
    "#84cc16",
    "#ec4899",
    "#6366f1",
  ];
  return defaultColors[index % defaultColors.length];
}

export type BookingStatusChartProps = {
  loading: boolean;
  bookingsByStatus: Record<string, number>;
  bookingsTotal: number;
};

export default function BookingStatusChart({
  loading,
  bookingsByStatus,
  bookingsTotal,
}: BookingStatusChartProps) {
  const chartData = useMemo(() => {
    const entries = Object.entries(bookingsByStatus).filter(([, n]) => n > 0);
    const statuses = entries.map(([k]) => k);
    const counts = entries.map(([, n]) => n);
    const labels = statuses.map((s) => capitalizeStatus(s));
    const colors = statuses.map((s, i) => getStatusColor(s, i));
    const seriesTotal = counts.reduce((a, b) => a + b, 0);
    const totalLabel = bookingsTotal;

    const options: ApexOptions = {
      chart: {
        type: "pie",
        toolbar: { show: false },
      },
      labels,
      colors,
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
                  return totalLabel.toString();
                },
              },
            },
          },
        },
      },
      tooltip: {
        y: {
          formatter: function (val: number) {
            if (seriesTotal > 0) {
              const percentage = ((val / seriesTotal) * 100).toFixed(1);
              return `${val} bookings (${percentage}%)`;
            }
            return `${val} bookings`;
          },
        },
      },
    };

    return { series: counts, options };
  }, [bookingsByStatus, bookingsTotal]);

  if (loading) {
    return (
      <div className="w-full mx-auto flex items-center justify-center h-[400px]">
        <div className="text-gray-500">Loading chart data...</div>
      </div>
    );
  }

  if (chartData.series.length === 0) {
    return (
      <div className="w-full mx-auto flex items-center justify-center h-[400px]">
        <div className="text-gray-500">No booking status data for this period.</div>
      </div>
    );
  }

  return (
    <ApexCharts
      options={chartData.options}
      series={chartData.series}
      type="pie"
      height={340}
    />
  );
}
