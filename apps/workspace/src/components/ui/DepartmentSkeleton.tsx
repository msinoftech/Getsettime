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

type DepartmentTableRowsSkeletonProps = {
  showActions?: boolean;
  rows?: number;
};

/** Table body rows that match the departments list columns. */
export function DepartmentTableRowsSkeleton({
  showActions = true,
  rows = SKELETON_ROWS,
}: DepartmentTableRowsSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <tr key={i} className="border-b border-slate-100 last:border-b-0">
          <td className="px-4 py-3.5">
            <div className="flex items-start gap-3">
              <SkeletonBar className="mt-0.5 h-9 w-9 shrink-0 rounded-xl" />
              <div className="min-w-0 flex-1 space-y-1.5 pt-0.5">
                <SkeletonBar className="h-4 w-36 max-w-full" />
                <SkeletonBar className="h-3 w-24 max-w-full" />
              </div>
            </div>
          </td>
          <td className="px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center">
                <SkeletonBar className="h-7 w-7 rounded-full" />
                <SkeletonBar className="-ml-2 h-7 w-7 rounded-full" />
              </div>
              <SkeletonBar className="h-4 w-24" />
            </div>
          </td>
          <td className="px-4 py-3.5">
            <SkeletonBar className="h-4 w-16" />
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

/** Pagination footer placeholder. */
export function DepartmentPaginationSkeleton() {
  return (
    <div className="flex items-center justify-between gap-3">
      <SkeletonBar className="h-4 w-32" />
      <div className="flex gap-2">
        <SkeletonBar className="h-8 w-8 rounded-lg" />
        <SkeletonBar className="h-8 w-8 rounded-lg" />
        <SkeletonBar className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}
