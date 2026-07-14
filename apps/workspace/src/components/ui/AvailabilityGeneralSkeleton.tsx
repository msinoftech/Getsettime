"use client";

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-200 ${className ?? ""}`}
      aria-hidden
    />
  );
}

const DAY_ROW_COUNT = 7;

function DayRowSkeleton() {
  return (
    <tr className="border-b border-slate-100 last:border-b-0">
      <td className="px-4 py-3.5">
        <SkeletonBar className="h-4 w-20" />
      </td>
      <td className="px-4 py-3.5">
        <SkeletonBar className="h-5 w-12 rounded-full" />
      </td>
      <td className="px-4 py-3.5">
        <SkeletonBar className="h-4 w-36" />
      </td>
      <td className="px-4 py-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <SkeletonBar className="h-5 w-24 rounded-md" />
          <SkeletonBar className="h-5 w-24 rounded-md" />
          <SkeletonBar className="h-6 w-6 rounded-md" />
        </div>
      </td>
      <td className="px-4 py-3.5 text-right">
        <SkeletonBar className="ml-auto h-8 w-16 rounded-lg" />
      </td>
    </tr>
  );
}

export function AvailabilityGeneralSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading availability">
      <SkeletonBar className="h-4 w-full max-w-xl" />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3">
                  <SkeletonBar className="h-3 w-10" />
                </th>
                <th className="px-4 py-3">
                  <SkeletonBar className="h-3 w-14" />
                </th>
                <th className="px-4 py-3">
                  <SkeletonBar className="h-3 w-24" />
                </th>
                <th className="px-4 py-3">
                  <SkeletonBar className="h-3 w-14" />
                </th>
                <th className="px-4 py-3">
                  <SkeletonBar className="ml-auto h-3 w-12" />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Array.from({ length: DAY_ROW_COUNT }).map((_, i) => (
                <DayRowSkeleton key={i} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
