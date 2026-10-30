"use client";

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-200 ${className ?? ""}`}
    />
  );
}

const SKELETON_ROWS = 6;

/** Pulsing placeholder for a dynamic numeric stat value. */
export function StatValueSkeleton({ className }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-pulse rounded bg-slate-200 ${className ?? "h-6 w-10"}`}
      aria-hidden
    />
  );
}

type ServiceTableRowsSkeletonProps = {
  showActions?: boolean;
  rows?: number;
};

/** Table body rows that match the services list columns. */
export function ServiceTableRowsSkeleton({
  showActions = true,
  rows = SKELETON_ROWS,
}: ServiceTableRowsSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr
          key={i}
          className="border-b border-slate-100 last:border-b-0"
          aria-hidden
        >
          <td className="px-4 py-3.5">
            <SkeletonBar className="h-6 w-24 rounded-full" />
          </td>
          <td className="px-4 py-3.5">
            <div className="space-y-1.5">
              <SkeletonBar className="h-4 w-36 max-w-full" />
              <SkeletonBar className="h-3 w-20 max-w-full" />
            </div>
          </td>
          <td className="px-4 py-3.5">
            <SkeletonBar className="h-4 w-14" />
          </td>
          <td className="px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center">
                <SkeletonBar className="h-7 w-7 rounded-full" />
                <SkeletonBar className="-ml-2 h-7 w-7 rounded-full" />
              </div>
              <SkeletonBar className="h-4 w-20" />
            </div>
          </td>
          <td className="px-4 py-3.5">
            <SkeletonBar className="h-6 w-16 rounded-full" />
          </td>
          {showActions ? (
            <td className="px-4 py-3.5">
              <div className="flex items-center gap-1.5">
                <SkeletonBar className="h-8 w-14 rounded-lg" />
                <SkeletonBar className="h-8 w-8 rounded-lg" />
              </div>
            </td>
          ) : null}
        </tr>
      ))}
    </>
  );
}

/** Department tab chips placeholder. */
export function ServiceDepartmentTabsSkeleton({
  count = 4,
}: {
  count?: number;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" aria-hidden>
      <SkeletonBar className="h-8 w-32 shrink-0 rounded-full" />
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBar
          key={i}
          className={`h-8 shrink-0 rounded-full ${i % 2 === 0 ? "w-28" : "w-24"}`}
        />
      ))}
    </div>
  );
}

/** Pagination footer placeholder. */
export function ServicePaginationSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3">
      <SkeletonBar className="h-4 w-28" />
      <div className="flex gap-2">
        <SkeletonBar className="h-8 w-8 rounded-lg" />
        <SkeletonBar className="h-8 w-8 rounded-lg" />
        <SkeletonBar className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}
