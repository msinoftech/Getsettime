'use client';

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`rounded bg-slate-200 animate-pulse ${className ?? ''}`}
    />
  );
}

const SKELETON_ROWS = 5;

export function DepartmentSkeleton() {
  return (
    <div className="rounded-2xl bg-white shadow-md p-6">
      <div className="space-y-3">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div
            key={i}
            className="flex flex-wrap items-start justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-white"
          >
            <div className="flex-grow space-y-2">
              <SkeletonBar className="h-5 w-40" />
              <SkeletonBar className="h-4 w-64" />
              <div className="flex gap-2 mt-2">
                <SkeletonBar className="h-5 w-20 rounded-full" />
                <SkeletonBar className="h-5 w-24 rounded-full" />
              </div>
              <SkeletonBar className="h-3 w-28 mt-2" />
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <SkeletonBar className="h-7 w-14 rounded-md" />
              <SkeletonBar className="h-7 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
