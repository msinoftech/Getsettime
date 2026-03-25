'use client';

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`rounded bg-slate-200 animate-pulse ${className ?? ''}`}
    />
  );
}

const DAY_CARD_COUNT = 7;

function DayCardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-4 overflow-hidden shadow-sm border border-slate-100 relative">
      <div className="absolute z-0 inset-0 bg-slate-50/80" aria-hidden />
      <div className="flex flex-col gap-4 relative z-10">
        <div className="flex items-center gap-4">
          <SkeletonBar className="h-12 w-12 rounded-xl shrink-0" />
          <div className="space-y-2 flex-1 min-w-0">
            <SkeletonBar className="h-6 w-28" />
            <SkeletonBar className="h-4 w-40" />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <SkeletonBar className="h-4 w-20" />
          <SkeletonBar className="h-8 w-28 rounded-full" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <SkeletonBar className="h-4 w-12" />
            <SkeletonBar className="h-12 w-full rounded-2xl" />
          </div>
          <div className="space-y-2">
            <SkeletonBar className="h-4 w-10" />
            <SkeletonBar className="h-12 w-full rounded-2xl" />
          </div>
        </div>
        <div className="border border-slate-200 rounded-2xl p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <SkeletonBar className="h-4 w-16" />
              <SkeletonBar className="h-3 w-32" />
            </div>
            <SkeletonBar className="h-7 w-14 rounded-lg" />
          </div>
          <SkeletonBar className="h-3 w-36" />
        </div>
      </div>
    </div>
  );
}

export function AvailabilityGeneralSkeleton() {
  return (
    <div className="px-4 sm:px-6 pb-6">
      <div className="rounded-xl relative overflow-hidden p-4 mb-6 shadow-sm border border-slate-200 bg-slate-50/50">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <SkeletonBar className="h-7 w-24 rounded-full" />
              <SkeletonBar className="h-7 w-20 rounded-full" />
              <SkeletonBar className="h-7 w-36 rounded-full" />
            </div>
            <SkeletonBar className="h-4 w-64 max-w-full" />
          </div>
          <div className="flex flex-wrap gap-3">
            <SkeletonBar className="h-10 w-28 rounded-lg" />
            <SkeletonBar className="h-10 w-28 rounded-lg" />
            <SkeletonBar className="h-10 w-32 rounded-lg" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {Array.from({ length: DAY_CARD_COUNT }).map((_, i) => (
          <DayCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
