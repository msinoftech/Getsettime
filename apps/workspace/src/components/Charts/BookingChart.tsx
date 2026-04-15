"use client";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { ApexOptions } from "apexcharts";

const ApexCharts = dynamic(() => import("react-apexcharts"), { ssr: false });

export type BookingChartProps = {
  loading: boolean;
  weekDayLabels: string[];
  bookingsByDay: number[];
};

export default function BookingChart({ loading, weekDayLabels, bookingsByDay }: BookingChartProps) {
  const chartData = useMemo(() => {
    const labels =
      weekDayLabels.length === 7
        ? weekDayLabels
        : [...weekDayLabels, ...Array(7 - weekDayLabels.length).fill("")].slice(0, 7);
    const data =
      bookingsByDay.length === 7
        ? bookingsByDay
        : [...bookingsByDay, ...Array(7 - bookingsByDay.length).fill(0)].slice(0, 7);

    const options: ApexOptions = {
      chart: {
        type: "area",
        toolbar: { show: false },
      },
      stroke: {
        curve: "smooth",
      },
      xaxis: {
        categories: labels,
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
    };

    return {
      series: [{ name: "Bookings", data }],
      options,
    };
  }, [weekDayLabels, bookingsByDay]);

  if (loading) {
    return (
      <div className="w-full mx-auto flex items-center justify-center h-[350px]">
        <div className="text-gray-500">Loading chart data...</div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto">
      <ApexCharts
        options={chartData.options}
        series={chartData.series}
        type="area"
        height={330}
      />
    </div>
  );
}