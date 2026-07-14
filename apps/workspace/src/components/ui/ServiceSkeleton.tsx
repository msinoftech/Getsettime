"use client";

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-200 ${className ?? ""}`}
    />
  );
}

const SKELETON_ROWS = 6;

function StatCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <SkeletonBar className="h-11 w-11 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonBar className="h-6 w-10" />
        <SkeletonBar className="h-3.5 w-28" />
      </div>
    </div>
  );
}

function TableRowSkeleton() {
  return (
    <div className="flex items-center gap-4 border-b border-slate-100 px-4 py-3.5 last:border-b-0">
      <SkeletonBar className="hidden h-6 w-24 rounded-full sm:block" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <SkeletonBar className="h-4 w-36" />
        <SkeletonBar className="h-3 w-48 max-w-full" />
      </div>
      <SkeletonBar className="hidden h-4 w-14 md:block" />
      <div className="hidden min-w-[8rem] items-center gap-2 lg:flex">
        <SkeletonBar className="h-7 w-7 rounded-full" />
        <SkeletonBar className="h-7 w-7 rounded-full" />
        <SkeletonBar className="h-4 w-16" />
      </div>
      <SkeletonBar className="h-6 w-16 rounded-full" />
      <div className="flex items-center gap-1.5">
        <SkeletonBar className="h-8 w-14 rounded-lg" />
        <SkeletonBar className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

export function ServiceSkeleton() {
  return (
    <div className="min-h-screen">
      <div className="mx-auto space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <SkeletonBar className="h-8 w-36 md:h-9 md:w-44" />
            <SkeletonBar className="h-4 w-72 max-w-full sm:w-96" />
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <SkeletonBar className="h-10 w-40 rounded-xl" />
            <SkeletonBar className="h-10 w-36 rounded-xl" />
            <SkeletonBar className="h-10 w-32 rounded-xl" />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <SkeletonBar className="h-5 w-32" />
              <SkeletonBar className="h-4 w-64 max-w-full" />
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <SkeletonBar className="h-10 w-full rounded-xl sm:w-64" />
              <SkeletonBar className="h-10 w-24 rounded-xl" />
            </div>
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBar
                key={i}
                className={`h-8 shrink-0 rounded-full ${i === 0 ? "w-32" : "w-24"}`}
              />
            ))}
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3">
              <div className="flex gap-4">
                <SkeletonBar className="hidden h-3 w-24 sm:block" />
                <SkeletonBar className="h-3 w-20" />
                <SkeletonBar className="hidden h-3 w-16 md:block" />
                <SkeletonBar className="hidden h-3 w-28 lg:block" />
                <SkeletonBar className="h-3 w-14" />
                <SkeletonBar className="h-3 w-14" />
              </div>
            </div>
            <div>
              {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
                <TableRowSkeleton key={i} />
              ))}
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3">
              <SkeletonBar className="h-4 w-28" />
              <div className="flex gap-2">
                <SkeletonBar className="h-8 w-8 rounded-lg" />
                <SkeletonBar className="h-8 w-8 rounded-lg" />
                <SkeletonBar className="h-8 w-8 rounded-lg" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
