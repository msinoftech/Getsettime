"use client";

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-slate-200 ${className ?? ""}`}
    />
  );
}

const SKELETON_ROWS = 5;

/** Pulsing placeholder for a dynamic numeric stat value. */
export function StatValueSkeleton({ className }: { className?: string }) {
  return (
    <span
      className={`inline-block animate-pulse rounded bg-slate-200 ${className ?? "h-7 w-10"}`}
      aria-hidden
    />
  );
}

type TeamMemberCardsSkeletonProps = {
  showActions?: boolean;
  rows?: number;
};

/** Member card list placeholders matching the team members layout. */
export function TeamMemberCardsSkeleton({
  showActions = true,
  rows = SKELETON_ROWS,
}: TeamMemberCardsSkeletonProps) {
  return (
    <div className="grid gap-4" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-[24px] border border-slate-200 bg-white shadow-sm"
        >
          <div className="p-5 md:p-6">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 flex-1 gap-4">
                <SkeletonBar className="h-14 w-14 shrink-0 rounded-2xl" />
                <div className="min-w-0 flex-1 space-y-3">
                  <SkeletonBar className="h-5 w-40 max-w-full" />
                  <div className="grid gap-2 md:grid-cols-2">
                    <SkeletonBar className="h-4 w-44 max-w-full" />
                    <SkeletonBar className="h-4 w-28 max-w-full" />
                    <SkeletonBar className="h-4 w-36 max-w-full" />
                    <SkeletonBar className="h-4 w-32 max-w-full" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <SkeletonBar className="h-6 w-24 rounded-full" />
                    <SkeletonBar className="h-6 w-20 rounded-full" />
                  </div>
                </div>
              </div>
              {showActions ? (
                <div className="flex flex-wrap items-start justify-end gap-2 xl:min-w-[280px]">
                  <SkeletonBar className="h-10 w-20 rounded-xl" />
                  <SkeletonBar className="h-10 w-20 rounded-xl" />
                  <SkeletonBar className="h-10 w-28 rounded-xl" />
                  <SkeletonBar className="h-10 w-10 rounded-xl" />
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** @deprecated Prefer in-page static chrome + TeamMemberCardsSkeleton. */
export function TeamMemberSkeleton() {
  return <TeamMemberCardsSkeleton />;
}
