"use client";

function SkeletonBar({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className ?? ""}`} />;
}

const CARD_COUNT = 2;

function IntegrationCardSkeleton() {
  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <SkeletonBar className="h-14 w-14 shrink-0 rounded-2xl" />
        <SkeletonBar className="h-7 w-28 rounded-full" />
      </div>
      <SkeletonBar className="mt-6 h-3 w-20" />
      <SkeletonBar className="mt-3 h-6 w-48" />
      <SkeletonBar className="mt-3 h-4 w-full max-w-sm" />
      <SkeletonBar className="mt-2 h-4 w-full max-w-xs" />
      <SkeletonBar className="mt-6 h-12 w-full rounded-2xl" />
    </div>
  );
}

function FilterBarSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-[2rem] border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center lg:justify-between">
      <div className="h-12 w-full max-w-md animate-pulse rounded-2xl bg-slate-100 lg:max-w-md" />
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 w-24 animate-pulse rounded-2xl bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export function IntegrationsSkeleton({ withHeader = false }: { withHeader?: boolean }) {
  const grid = (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: CARD_COUNT }).map((_, i) => (
        <IntegrationCardSkeleton key={i} />
      ))}
    </div>
  );

  if (withHeader) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-8 text-slate-900">
        <div className="mx-auto max-w-7xl space-y-8">
          <div className="overflow-hidden rounded-[2rem] border border-white bg-white/90 p-6 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="w-full max-w-xl space-y-3">
                <SkeletonBar className="h-9 w-48 rounded-full" />
                <SkeletonBar className="h-9 w-56" />
                <SkeletonBar className="h-5 w-full max-w-lg" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-slate-50 px-5 py-4 text-center">
                  <SkeletonBar className="mx-auto h-8 w-10" />
                  <SkeletonBar className="mx-auto mt-2 h-3 w-16" />
                </div>
                <div className="rounded-2xl bg-emerald-50 px-5 py-4 text-center">
                  <SkeletonBar className="mx-auto h-8 w-10 bg-emerald-200/60" />
                  <SkeletonBar className="mx-auto mt-2 h-3 w-16 bg-emerald-200/60" />
                </div>
                <div className="rounded-2xl bg-indigo-50 px-5 py-4 text-center">
                  <SkeletonBar className="mx-auto h-8 w-10 bg-indigo-200/60" />
                  <SkeletonBar className="mx-auto mt-2 h-3 w-14 bg-indigo-200/60" />
                </div>
              </div>
            </div>
          </div>
          <FilterBarSkeleton />
          {grid}
        </div>
      </div>
    );
  }

  return grid;
}
