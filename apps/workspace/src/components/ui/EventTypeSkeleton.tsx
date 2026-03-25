'use client';

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`rounded bg-slate-200 animate-pulse ${className ?? ''}`}
    />
  );
}

const SKELETON_CARDS = 6;

export function EventTypeSkeleton() {
  return (
    <div className="grid gap-5 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: SKELETON_CARDS }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-slate-100 bg-white shadow-md"
        >
          <div className="p-5 space-y-3">
            <SkeletonBar className="h-5 w-3/4" />
            <div className="space-y-1.5">
              <SkeletonBar className="h-4 w-1/2" />
              <SkeletonBar className="h-4 w-2/3" />
            </div>
            <div className="flex items-center gap-2 mt-3">
              <SkeletonBar className="h-6 w-16 rounded-md" />
              <SkeletonBar className="h-6 w-20 rounded-md" />
            </div>
            <div className="flex items-center gap-2 mt-5">
              <SkeletonBar className="h-7 w-12 rounded-md" />
              <SkeletonBar className="h-7 w-20 rounded-md" />
              <SkeletonBar className="h-7 w-16 rounded-md" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
