'use client';

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`rounded bg-slate-200 animate-pulse ${className ?? ''}`}
    />
  );
}

const CARD_COUNT = 2;

function IntegrationCardSkeleton() {
  return (
    <div className="p-5 rounded-2xl border border-slate-100 bg-white shadow-md">
      <SkeletonBar className="h-5 w-44" />
      <SkeletonBar className="h-4 w-full mt-2 max-w-[280px]" />
      <SkeletonBar className="h-4 w-full mt-1 max-w-[220px]" />
      <div className="mt-4 flex flex-wrap gap-3 items-center justify-between">
        <SkeletonBar className="h-4 w-28" />
        <SkeletonBar className="h-8 w-24 rounded-xl" />
      </div>
    </div>
  );
}

export function IntegrationsSkeleton({ withHeader = false }: { withHeader?: boolean }) {
  const grid = (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {Array.from({ length: CARD_COUNT }).map((_, i) => (
        <IntegrationCardSkeleton key={i} />
      ))}
    </div>
  );

  if (withHeader) {
    return (
      <section className="space-y-6 mr-auto">
        <header className="flex flex-wrap justify-between relative gap-3">
          <div className="text-sm text-slate-500 space-y-2 w-full max-w-md">
            <SkeletonBar className="h-7 w-44" />
            <SkeletonBar className="h-3 w-full max-w-xs" />
          </div>
        </header>
        {grid}
      </section>
    );
  }

  return grid;
}
