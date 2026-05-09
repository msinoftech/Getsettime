"use client";

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`rounded bg-slate-200 animate-pulse ${className ?? ""}`}
    />
  );
}

const SKELETON_ROWS = 8;

export function ContactTableSkeleton() {
  return (
    <table className="w-full min-w-[1050px] text-left">
      <thead className="bg-slate-50 text-sm font-bold text-slate-500">
        <tr>
          <th className="px-5 py-4">Contact</th>
          <th className="px-5 py-4">Email</th>
          <th className="px-5 py-4">Phone</th>
          <th className="px-5 py-4">Location</th>
          <th className="px-5 py-4">Source</th>
          <th className="px-5 py-4">Last Booking</th>
          <th className="px-5 py-4">Status</th>
          <th className="px-5 py-4 text-right">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <tr key={i} className="bg-white">
            <td className="px-5 py-5">
              <div className="flex items-center gap-3">
                <SkeletonBar className="h-12 w-12 shrink-0 rounded-2xl" />
                <div className="space-y-2">
                  <SkeletonBar className="h-4 w-28" />
                  <SkeletonBar className="h-5 w-24 rounded-full" />
                </div>
              </div>
            </td>
            <td className="px-5 py-5">
              <SkeletonBar className="h-4 w-40" />
            </td>
            <td className="px-5 py-5">
              <SkeletonBar className="h-4 w-28" />
            </td>
            <td className="px-5 py-5">
              <SkeletonBar className="h-4 w-32" />
            </td>
            <td className="px-5 py-5">
              <SkeletonBar className="h-6 w-16 rounded-full" />
            </td>
            <td className="px-5 py-5">
              <SkeletonBar className="h-4 w-24" />
            </td>
            <td className="px-5 py-5">
              <SkeletonBar className="h-6 w-14 rounded-full" />
            </td>
            <td className="px-5 py-5">
              <div className="flex items-center justify-end gap-2">
                <SkeletonBar className="h-10 w-10 rounded-xl" />
                <SkeletonBar className="h-10 w-10 rounded-xl" />
                <SkeletonBar className="h-10 w-10 rounded-xl" />
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
